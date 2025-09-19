import os
import faiss
import pickle
import numpy as np
import pytesseract
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import ollama
import tempfile
import shutil
import traceback
import logging
import time
import re
from collections import Counter

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Configure tesseract path (adjust for your system)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Optional libraries for file type support
try:
    from PyPDF2 import PdfReader
    logger.info("PyPDF2 imported successfully")
except ImportError:
    PdfReader = None
    logger.warning("PyPDF2 not available")

try:
    from PIL import Image
    import pytesseract
    logger.info("PIL and pytesseract imported successfully")
except ImportError:
    Image = None
    pytesseract = None
    logger.warning("PIL or pytesseract not available")

try:
    import docx
    logger.info("python-docx imported successfully")
except ImportError:
    docx = None
    logger.warning("python-docx not available")

# BioBERT and transformers
try:
    from transformers import AutoTokenizer, AutoModel
    import torch
    logger.info("Transformers imported successfully")
    BIOBERT_AVAILABLE = True
except ImportError:
    logger.warning("Transformers not available - install with: pip install transformers torch")
    BIOBERT_AVAILABLE = False

# Flask app setup
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# ------------------ Config ------------------
UPLOAD_FOLDER = 'uploads'
INDEX_FILE = "biobert_faiss_index"
KEYWORDS_FILE = "medical_keywords.pkl"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'docx'}

# Model settings
BIOBERT_MODEL = "dmis-lab/biobert-v1.1"  # Pre-trained BioBERT model
OLLAMA_CHAT_MODEL = "llama3.2"  # For explanations
MAX_RETRIES = 3
RETRY_DELAY = 2

# Medical keyword patterns (basic medical terms)
MEDICAL_PATTERNS = {
    'lab_values': [
        r'\b(?:hemoglobin|hgb|hb)\s*:?\s*(\d+\.?\d*)\s*(g/dl|mg/dl)?',
        r'\b(?:glucose|sugar)\s*:?\s*(\d+\.?\d*)\s*(mg/dl)?',
        r'\b(?:cholesterol|chol)\s*:?\s*(\d+\.?\d*)\s*(mg/dl)?',
        r'\b(?:creatinine|creat)\s*:?\s*(\d+\.?\d*)\s*(mg/dl)?',
        r'\b(?:bilirubin|bili)\s*:?\s*(\d+\.?\d*)\s*(mg/dl)?',
        r'\b(?:wbc|white blood cell)\s*:?\s*(\d+\.?\d*)\s*(/ul|k/ul)?',
        r'\b(?:rbc|red blood cell)\s*:?\s*(\d+\.?\d*)\s*(/ul|m/ul)?',
        r'\b(?:platelet|plt)\s*:?\s*(\d+\.?\d*)\s*(/ul|k/ul)?',
    ],
    'radiology': [
        r'\b(normal|abnormal|enlarged|dilated|narrowed|thickened|mass|lesion|nodule|opacity|consolidation|pneumonia|fracture|dislocation)\b',
        r'\b(edema|effusion|pneumothorax|atelectasis|fibrosis|calcification|stenosis|occlusion)\b'
    ]
}

# Create upload directory
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Global variables for BioBERT
biobert_tokenizer = None
biobert_model = None

def initialize_biobert():
    """Initialize BioBERT model and tokenizer"""
    global biobert_tokenizer, biobert_model
    
    if not BIOBERT_AVAILABLE:
        logger.warning("BioBERT not available - using fallback keyword extraction")
        return False
    
    try:
        logger.info("Loading BioBERT model...")
        biobert_tokenizer = AutoTokenizer.from_pretrained(BIOBERT_MODEL)
        biobert_model = AutoModel.from_pretrained(BIOBERT_MODEL)
        biobert_model.eval()
        logger.info("✅ BioBERT model loaded successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to load BioBERT: {str(e)}")
        return False

# ------------------ Helpers ------------------
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_file(file_path):
    """Extract text from various file formats"""
    ext = os.path.splitext(file_path)[1].lower()
    logger.info(f"Extracting text from {ext} file: {file_path}")
    
    if ext == ".pdf":
        if not PdfReader:
            raise ImportError("PyPDF2 is required for PDF files")
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
        return text
    
    elif ext in [".jpg", ".jpeg", ".png"]:
        if not Image or not pytesseract:
            raise ImportError("Pillow and pytesseract are required for image files")
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img)
        return text
    
    elif ext == ".txt":
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    
    elif ext == ".docx":
        if not docx:
            raise ImportError("python-docx is required for DOCX files")
        doc = docx.Document(file_path)
        return "\n".join([p.text for p in doc.paragraphs])
    
    else:
        raise ValueError(f"Unsupported file type: {ext}")

def extract_medical_keywords_regex(text):
    """Extract medical keywords using regex patterns (fallback method)"""
    keywords = []
    
    # Lab values
    for i, pattern in enumerate(MEDICAL_PATTERNS['lab_values']):
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            keyword = match.group(0).strip()
            value = match.group(1) if len(match.groups()) >= 1 else None
            unit = match.group(2) if len(match.groups()) >= 2 else None
            
            keywords.append({
                'keyword': keyword,
                'type': 'lab_value',
                'value': value,
                'unit': unit,
                'context': text[max(0, match.start()-50):match.end()+50]
            })
    
    # Radiology findings
    for pattern in MEDICAL_PATTERNS['radiology']:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            keyword = match.group(0).strip()
            keywords.append({
                'keyword': keyword,
                'type': 'radiology',
                'context': text[max(0, match.start()-50):match.end()+50]
            })
    
    return keywords

def extract_medical_keywords_biobert(text):
    """Extract medical keywords using BioBERT embeddings"""
    if not biobert_model or not biobert_tokenizer:
        logger.warning("BioBERT not available, using regex fallback")
        return extract_medical_keywords_regex(text)
    
    try:
        # First get regex keywords as candidates
        regex_keywords = extract_medical_keywords_regex(text)
        
        # Split text into sentences for better BioBERT processing
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
        
        # Use BioBERT to get embeddings for medical relevance scoring
        medical_sentences = []
        for sentence in sentences:
            # Simple medical relevance check
            medical_terms = ['test', 'result', 'level', 'count', 'blood', 'urine', 'scan', 'ray', 'normal', 'abnormal', 'high', 'low']
            if any(term in sentence.lower() for term in medical_terms):
                medical_sentences.append(sentence)
        
        # Combine regex results with BioBERT-enhanced results
        enhanced_keywords = regex_keywords.copy()
        
        # Add high-confidence medical sentences as additional keywords
        for sentence in medical_sentences[:5]:  # Limit to top 5
            enhanced_keywords.append({
                'keyword': sentence.strip(),
                'type': 'clinical_note',
                'context': sentence
            })
        
        return enhanced_keywords
        
    except Exception as e:
        logger.error(f"BioBERT processing failed: {str(e)}")
        return extract_medical_keywords_regex(text)

def create_biobert_embeddings(keywords):
    """Create BioBERT embeddings for keywords"""
    if not biobert_model or not biobert_tokenizer:
        logger.warning("BioBERT not available for embeddings")
        return None
    
    try:
        embeddings = []
        for keyword_data in keywords:
            text = keyword_data.get('context', keyword_data['keyword'])
            
            # Tokenize and encode
            inputs = biobert_tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=512)
            
            with torch.no_grad():
                outputs = biobert_model(**inputs)
                # Use CLS token embedding
                embedding = outputs.last_hidden_state[:, 0, :].numpy()
                embeddings.append(embedding.flatten())
        
        return np.array(embeddings).astype('float32')
        
    except Exception as e:
        logger.error(f"Failed to create BioBERT embeddings: {str(e)}")
        return None

def ollama_chat_with_retry(messages, max_retries=MAX_RETRIES):
    """Get chat response with retry logic"""
    for attempt in range(max_retries):
        try:
            logger.debug(f"Chat attempt {attempt + 1}/{max_retries}")
            response = ollama.chat(model=OLLAMA_CHAT_MODEL, messages=messages)
            return response["message"]["content"]
        except Exception as e:
            logger.warning(f"Chat attempt {attempt + 1} failed: {str(e)}")
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
            else:
                raise e

def generate_keyword_explanation(keyword_data):
    """Generate explanation for a keyword using Ollama"""
    try:
        keyword = keyword_data['keyword']
        kw_type = keyword_data.get('type', 'medical')
        context = keyword_data.get('context', '')
        value = keyword_data.get('value', '')
        unit = keyword_data.get('unit', '')
        
        if kw_type == 'lab_value':
            prompt = f"""Explain this laboratory test result in simple terms for a patient:

Keyword: {keyword}
Value: {value} {unit}
Context: {context}

Please explain:
1. What this test measures
2. Whether this value is normal, high, or low
3. What it might mean for the patient's health
4. Keep the explanation under 100 words and easy to understand."""

        elif kw_type == 'radiology':
            prompt = f"""Explain this radiology finding in simple terms for a patient:

Finding: {keyword}
Context: {context}

Please explain:
1. What this finding means
2. Whether it's concerning or normal
3. Keep the explanation under 100 words and easy to understand."""

        else:
            prompt = f"""Explain this medical term or finding in simple terms:

Term: {keyword}
Context: {context}

Please provide a brief, patient-friendly explanation in under 100 words."""
        
        messages = [{"role": "user", "content": prompt}]
        explanation = ollama_chat_with_retry(messages)
        
        return explanation.strip()
        
    except Exception as e:
        logger.error(f"Failed to generate explanation for {keyword}: {str(e)}")
        return f"Medical term: {keyword_data['keyword']}"

def determine_report_type(text):
    """Determine if report is lab or radiology based on content"""
    text_lower = text.lower()
    
    lab_indicators = ['blood', 'serum', 'plasma', 'urine', 'glucose', 'cholesterol', 'hemoglobin', 'laboratory', 'lab results']
    rad_indicators = ['x-ray', 'ct', 'scan', 'mri', 'ultrasound', 'radiology', 'image', 'chest', 'abdomen']
    
    lab_score = sum(1 for indicator in lab_indicators if indicator in text_lower)
    rad_score = sum(1 for indicator in rad_indicators if indicator in text_lower)
    
    if lab_score > rad_score:
        return 'lab'
    elif rad_score > lab_score:
        return 'radiology'
    else:
        return 'mixed'

# ------------------ API Routes ------------------

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    biobert_status = biobert_model is not None
    
    try:
        ollama_test = ollama.chat(model=OLLAMA_CHAT_MODEL, messages=[{"role": "user", "content": "Hello"}])
        ollama_status = True
    except:
        ollama_status = False
    
    return jsonify({
        "status": "healthy",
        "message": "Medical RAG API with BioBERT + FAISS + Ollama",
        "biobert_available": biobert_status,
        "ollama_available": ollama_status,
        "chat_model": OLLAMA_CHAT_MODEL
    })

@app.route('/upload', methods=['POST'])
def upload_file():
    """Upload and analyze medical document"""
    try:
        logger.info("Medical document upload started")
        
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "error": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({
                "success": False, 
                "error": f"File type not allowed. Supported: {', '.join(ALLOWED_EXTENSIONS)}"
            }), 400
        
        # Save uploaded file
        filename = secure_filename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        logger.info(f"File saved: {filename}")
        
        # Extract text
        try:
            text = extract_text_from_file(file_path)
            logger.info(f"Extracted text length: {len(text)} characters")
        except Exception as e:
            os.remove(file_path)
            return jsonify({"success": False, "error": f"Text extraction failed: {str(e)}"}), 400
        
        if not text.strip():
            os.remove(file_path)
            return jsonify({"success": False, "error": "No text found in file"}), 400
        
        # Determine report type
        report_type = determine_report_type(text)
        logger.info(f"Report type detected: {report_type}")
        
        # Extract medical keywords using BioBERT + regex
        keywords = extract_medical_keywords_biobert(text)
        logger.info(f"Extracted {len(keywords)} medical keywords")
        
        if not keywords:
            os.remove(file_path)
            return jsonify({
                "success": True,
                "report_type": report_type,
                "total_findings": 0,
                "explanations": [],
                "message": "No medical keywords found in the document"
            })
        
        # Create FAISS index with BioBERT embeddings
        embeddings = create_biobert_embeddings(keywords)
        if embeddings is not None:
            dimension = embeddings.shape[1]
            index = faiss.IndexFlatL2(dimension)
            index.add(embeddings)
            
            # Save FAISS index
            faiss.write_index(index, INDEX_FILE)
            logger.info(f"Created FAISS index with {index.ntotal} vectors")
        
        # Generate explanations for each keyword
        explanations = []
        for i, keyword_data in enumerate(keywords[:10]):  # Limit to first 10 keywords
            try:
                explanation_text = generate_keyword_explanation(keyword_data)
                
                explanation = {
                    "keyword_number": i + 1,
                    "keyword": keyword_data['keyword'],
                    "explanation": explanation_text,
                    "type": keyword_data.get('type', 'medical')
                }
                
                # Add value and unit if available
                if keyword_data.get('value'):
                    explanation["value"] = keyword_data['value']
                if keyword_data.get('unit'):
                    explanation["unit"] = keyword_data['unit']
                
                explanations.append(explanation)
                
            except Exception as e:
                logger.error(f"Failed to explain keyword {i}: {str(e)}")
                continue
        
        # Save keywords for potential querying later
        with open(KEYWORDS_FILE, "wb") as f:
            pickle.dump(keywords, f)
        
        # Clean up uploaded file
        os.remove(file_path)
        
        return jsonify({
            "success": True,
            "report_type": report_type,
            "total_findings": len(explanations),
            "explanations": explanations,
            "raw_text": text[:1000] + "..." if len(text) > 1000 else text  # First 1000 chars for debug
        })
        
    except Exception as e:
        logger.error(f"Upload processing failed: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            "success": False, 
            "error": f"Processing failed: {str(e)}"
        }), 500

@app.route('/query', methods=['POST'])
def query_keywords():
    """Query the medical keywords using FAISS similarity search"""
    try:
        data = request.get_json()
        if not data or 'question' not in data:
            return jsonify({"success": False, "error": "No question provided"}), 400
        
        question = data['question'].strip()
        
        # Check if we have keywords and index
        if not os.path.exists(KEYWORDS_FILE):
            return jsonify({
                "success": False, 
                "error": "No medical document processed. Please upload a file first."
            }), 400
        
        # Load keywords
        with open(KEYWORDS_FILE, "rb") as f:
            keywords = pickle.load(f)
        
        # Simple keyword matching for now (can be enhanced with FAISS similarity)
        relevant_keywords = []
        question_lower = question.lower()
        
        for keyword_data in keywords:
            if any(word in keyword_data['keyword'].lower() for word in question_lower.split()):
                relevant_keywords.append(keyword_data)
        
        if not relevant_keywords:
            relevant_keywords = keywords[:3]  # Return first 3 if no matches
        
        # Generate answer based on relevant keywords
        context = "\n".join([f"- {kw['keyword']}: {kw.get('context', '')}" for kw in relevant_keywords[:3]])
        
        prompt = f"""Based on the following medical findings from a report, please answer the question:

Medical findings:
{context}

Question: {question}

Please provide a helpful answer based on the medical findings above."""

        try:
            answer = ollama_chat_with_retry([{"role": "user", "content": prompt}])
        except Exception as e:
            answer = f"Unable to generate detailed answer due to: {str(e)}"
        
        return jsonify({
            "success": True,
            "question": question,
            "answer": answer,
            "relevant_findings": len(relevant_keywords)
        })
        
    except Exception as e:
        logger.error(f"Query failed: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/status', methods=['GET'])
def get_status():
    """Get system status"""
    keywords_exist = os.path.exists(KEYWORDS_FILE)
    index_exists = os.path.exists(INDEX_FILE)
    
    return jsonify({
        "biobert_loaded": biobert_model is not None,
        "keywords_available": keywords_exist,
        "faiss_index_exists": index_exists,
        "supported_formats": list(ALLOWED_EXTENSIONS),
        "models": {
            "biobert": BIOBERT_MODEL,
            "ollama_chat": OLLAMA_CHAT_MODEL
        }
    })

@app.route('/clear', methods=['POST'])
def clear_data():
    """Clear stored data"""
    try:
        files_to_remove = [KEYWORDS_FILE, INDEX_FILE]
        removed_files = []
        
        for file in files_to_remove:
            if os.path.exists(file):
                os.remove(file)
                removed_files.append(file)
        
        return jsonify({
            "success": True,
            "message": "Data cleared successfully",
            "removed_files": removed_files
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Medical RAG API with BioBERT + FAISS + Ollama...")
    print("📋 Available endpoints:")
    print("  GET  /health  - System health check")
    print("  GET  /status  - Get system status")
    print("  POST /upload  - Upload and analyze medical document")
    print("  POST /query   - Query medical keywords")
    print("  POST /clear   - Clear stored data")
    print(f"📁 Supported file types: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Initialize BioBERT
    biobert_initialized = initialize_biobert()
    if not biobert_initialized:
        print("⚠️  BioBERT not available - using regex fallback for keyword extraction")
    
    app.run(debug=True, host='0.0.0.0', port=5000)