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

# Flask app setup
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# ------------------ Config ------------------
UPLOAD_FOLDER = 'uploads'
INDEX_FILE = "faiss_index"
DOCS_FILE = "docs.pkl"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'docx'}

# Ollama settings
EMBEDDING_MODEL = "nomic-embed-text"  # Try: all-minilm, mxbai-embed-large
CHAT_MODEL = "llama3.2"  # Try: llama3.2, phi3, qwen2
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds

# Create upload directory
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ------------------ Helpers ------------------
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def chunk_text(text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_size)
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

def extract_text_from_file(file_path):
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

def ollama_embeddings_with_retry(text, max_retries=MAX_RETRIES):
    """Get embeddings with retry logic"""
    for attempt in range(max_retries):
        try:
            logger.debug(f"Embedding attempt {attempt + 1}/{max_retries}")
            response = ollama.embeddings(model=EMBEDDING_MODEL, prompt=text)
            return response["embedding"]
        except Exception as e:
            logger.warning(f"Embedding attempt {attempt + 1} failed: {str(e)}")
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
            else:
                raise e

def ollama_chat_with_retry(messages, max_retries=MAX_RETRIES):
    """Get chat response with retry logic"""
    for attempt in range(max_retries):
        try:
            logger.debug(f"Chat attempt {attempt + 1}/{max_retries}")
            response = ollama.chat(model=CHAT_MODEL, messages=messages)
            return response["message"]["content"]
        except Exception as e:
            logger.warning(f"Chat attempt {attempt + 1} failed: {str(e)}")
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
            else:
                raise e

def test_ollama_connection():
    """Test if Ollama is working properly"""
    try:
        logger.info("Testing embedding model...")
        emb = ollama_embeddings_with_retry("test")
        logger.info(f"✅ Embedding model working - dimension: {len(emb)}")
        
        logger.info("Testing chat model...")
        answer = ollama_chat_with_retry([{"role": "user", "content": "Say 'Hello, I am working!'"}])
        logger.info(f"✅ Chat model working - response: {answer[:50]}...")
        
        return True, "All models working"
    except Exception as e:
        logger.error(f"❌ Ollama test failed: {str(e)}")
        return False, str(e)

# ------------------ API Routes ------------------

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    ollama_status, ollama_msg = test_ollama_connection()
    return jsonify({
        "status": "healthy" if ollama_status else "degraded",
        "message": "Flask RAG API is running",
        "ollama_status": ollama_msg,
        "embedding_model": EMBEDDING_MODEL,
        "chat_model": CHAT_MODEL
    })

@app.route('/upload', methods=['POST'])
def upload_file():
    """Upload and process a file to create FAISS index"""
    try:
        logger.info("Upload request received")
        
        # Check if file is present
        if 'file' not in request.files:
            logger.error("No file in request")
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            logger.error("Empty filename")
            return jsonify({"error": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            logger.error(f"File type not allowed: {file.filename}")
            return jsonify({"error": f"File type not allowed. Supported: {', '.join(ALLOWED_EXTENSIONS)}"}), 400
        
        # Save uploaded file
        filename = secure_filename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        logger.info(f"File saved to: {file_path}")
        
        # Extract text from file
        try:
            text = extract_text_from_file(file_path)
            logger.info(f"Extracted text length: {len(text)} characters")
        except Exception as e:
            logger.error(f"Error extracting text: {str(e)}")
            os.remove(file_path)
            return jsonify({"error": f"Error extracting text: {str(e)}"}), 400
        
        if not text.strip():
            logger.error("No text found in file")
            os.remove(file_path)
            return jsonify({"error": "No text found in the file"}), 400
        
        # Split into chunks
        chunks = chunk_text(text)
        logger.info(f"Created {len(chunks)} chunks")
        
        # Create embeddings with retry logic
        vectors = []
        failed_chunks = []
        
        for i, chunk in enumerate(chunks):
            try:
                logger.debug(f"Creating embedding for chunk {i+1}/{len(chunks)}")
                emb = ollama_embeddings_with_retry(chunk)
                vectors.append(emb)
            except Exception as e:
                logger.error(f"Failed to create embedding for chunk {i}: {str(e)}")
                failed_chunks.append(i)
                # Continue with other chunks instead of failing completely
                continue
        
        if not vectors:
            logger.error("No embeddings could be created")
            os.remove(file_path)
            return jsonify({"error": "Failed to create any embeddings. Check Ollama status."}), 500
        
        if failed_chunks:
            logger.warning(f"Failed to process {len(failed_chunks)} chunks: {failed_chunks}")
        
        vectors = np.array(vectors).astype("float32")
        logger.info(f"Created embeddings matrix: {vectors.shape}")
        
        # Initialize FAISS index
        dimension = vectors.shape[1]
        index = faiss.IndexFlatL2(dimension)
        index.add(vectors)
        logger.info(f"Created FAISS index with {index.ntotal} vectors")
        
        # Only keep chunks that have embeddings
        successful_chunks = [chunk for i, chunk in enumerate(chunks) if i not in failed_chunks]
        
        # Save FAISS index + chunks
        faiss.write_index(index, INDEX_FILE)
        with open(DOCS_FILE, "wb") as f:
            pickle.dump(successful_chunks, f)
        logger.info("Saved index and chunks to disk")
        
        # Clean up uploaded file
        os.remove(file_path)
        
        return jsonify({
            "success": True,
            "message": f"Successfully processed {len(successful_chunks)} chunks from {filename}",
            "chunks_count": len(successful_chunks),
            "failed_chunks": len(failed_chunks),
            "filename": filename
        })
        
    except Exception as e:
        logger.error(f"Unexpected error in upload: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/query', methods=['POST'])
def query_documents():
    """Query the indexed documents"""
    try:
        logger.info("Query request received")
        
        # Check if index exists
        if not os.path.exists(INDEX_FILE) or not os.path.exists(DOCS_FILE):
            logger.error("Index files don't exist")
            return jsonify({"error": "No documents indexed. Please upload a file first."}), 400
        
        # Get question from request
        data = request.get_json()
        logger.info(f"Request data: {data}")
        
        if not data or 'question' not in data:
            logger.error("No question in request data")
            return jsonify({"error": "No question provided"}), 400
        
        question = data['question'].strip()
        if not question:
            logger.error("Empty question")
            return jsonify({"error": "Empty question provided"}), 400
        
        logger.info(f"Processing question: {question}")
        
        # Load FAISS index and documents
        logger.info("Loading FAISS index and documents")
        index = faiss.read_index(INDEX_FILE)
        with open(DOCS_FILE, "rb") as f:
            docs = pickle.load(f)
        
        logger.info(f"Loaded index with {index.ntotal} vectors and {len(docs)} document chunks")
        
        # Embed the question with retry logic
        try:
            logger.info("Creating question embedding")
            q_emb = ollama_embeddings_with_retry(question)
            q_emb = np.array([q_emb]).astype("float32")
            logger.info(f"Question embedding shape: {q_emb.shape}")
        except Exception as e:
            logger.error(f"Error creating question embedding: {str(e)}")
            return jsonify({
                "success": False,
                "error": f"Failed to create question embedding. Ollama might be busy or down. Error: {str(e)}"
            }), 500
        
        # Search in FAISS
        k = min(3, len(docs))  # Get top 3 or less if fewer docs
        logger.info(f"Searching for top {k} similar chunks")
        D, I = index.search(q_emb, k=k)
        retrieved = [docs[i] for i in I[0]]
        logger.info(f"Retrieved {len(retrieved)} chunks with distances: {D[0].tolist()}")
        
        # Get answer from Ollama with retry logic
        context = "\n\n".join(retrieved)
        prompt = f"Based on the following medical document context, please answer the question. Be specific and cite relevant information from the context.\n\nContext:\n{context}\n\nQuestion: {question}\n\nAnswer:"
        
        logger.info("Sending request to Ollama chat")
        
        try:
            answer = ollama_chat_with_retry([{"role": "user", "content": prompt}])
            logger.info(f"Received answer from Ollama: {answer[:100]}...")
        except Exception as e:
            logger.error(f"Error getting answer from Ollama: {str(e)}")
            return jsonify({
                "success": False,
                "error": f"Failed to get answer from chat model. Ollama might be busy or the model is not available. Error: {str(e)}"
            }), 500
        
        return jsonify({
            "success": True,
            "question": question,
            "answer": answer,
            "retrieved_chunks": retrieved,
            "similarity_scores": D[0].tolist()
        })
        
    except Exception as e:
        logger.error(f"Unexpected error in query: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }), 500

@app.route('/status', methods=['GET'])
def get_status():
    """Get current index status"""
    index_exists = os.path.exists(INDEX_FILE) and os.path.exists(DOCS_FILE)
    
    if index_exists:
        try:
            with open(DOCS_FILE, "rb") as f:
                docs = pickle.load(f)
            chunks_count = len(docs)
        except:
            chunks_count = 0
    else:
        chunks_count = 0
    
    ollama_status, ollama_msg = test_ollama_connection()
    
    return jsonify({
        "index_exists": index_exists,
        "chunks_count": chunks_count,
        "supported_formats": list(ALLOWED_EXTENSIONS),
        "ollama_working": ollama_status,
        "ollama_message": ollama_msg,
        "embedding_model": EMBEDDING_MODEL,
        "chat_model": CHAT_MODEL
    })

@app.route('/models', methods=['GET'])
def list_models():
    """List available Ollama models"""
    try:
        models = ollama.list()
        return jsonify({
            "success": True,
            "models": models,
            "current_embedding": EMBEDDING_MODEL,
            "current_chat": CHAT_MODEL
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        })

@app.route('/clear', methods=['POST'])
def clear_index():
    """Clear the current index"""
    try:
        files_to_remove = [INDEX_FILE, DOCS_FILE]
        removed_files = []
        
        for file in files_to_remove:
            if os.path.exists(file):
                os.remove(file)
                removed_files.append(file)
        
        return jsonify({
            "success": True,
            "message": "Index cleared successfully",
            "removed_files": removed_files
        })
        
    except Exception as e:
        return jsonify({"error": f"Error clearing index: {str(e)}"}), 500

# Error handlers
@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "File too large. Maximum size is 16MB."}), 413

@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Internal server error: {str(e)}")
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    print("🚀 Starting Flask RAG API Server...")
    print("📋 Available endpoints:")
    print("  GET  /health  - Health check with Ollama status")
    print("  GET  /status  - Get index and Ollama status")
    print("  GET  /models  - List available Ollama models")
    print("  POST /upload  - Upload and process file")
    print("  POST /query   - Query documents")
    print("  POST /clear   - Clear index")
    print(f"📁 Supported file types: {', '.join(ALLOWED_EXTENSIONS)}")
    print(f"🤖 Using models: {EMBEDDING_MODEL} (embedding), {CHAT_MODEL} (chat)")
    
    # Test Ollama connection on startup
    test_ollama_connection()
    
    app.run(debug=True, host='0.0.0.0', port=5001)