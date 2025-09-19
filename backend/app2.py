from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import tempfile
import traceback
from werkzeug.utils import secure_filename
import logging

# Import your existing medical analysis code
import re
import io
import json
import subprocess
from typing import List, Dict, Tuple, Optional

from pdf2image import convert_from_path
import pytesseract
try:
    import fitz  # PyMuPDF
except ImportError:
    import pymupdf as fitz

from PIL import Image
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
import requests

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for React Native

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}

# Create upload folder if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Configure Tesseract path (adjust as needed for your system)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# ---------- Medical Analysis Code (from your original file) ----------

def extract_text(path: str) -> str:
    """Extract text from either PDF or image (jpg/png). No Poppler required."""
    if path.lower().endswith(".pdf"):
        text = []
        doc = fitz.open(path)
        for page in doc:
            page_text = page.get_text().strip()
            if page_text:
                text.append(page_text)
        return "\n\n".join(text)
    elif path.lower().endswith((".jpg", ".jpeg", ".png")):
        img = Image.open(path)
        return pytesseract.image_to_string(img)
    else:
        raise ValueError("Unsupported file type. Use PDF, JPG, or PNG.")

# Lab patterns for parsing
LAB_PATTERNS = [
    (r"hemoglobin\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>g\/dL|gdl)", "hemoglobin"),
    (r"total cholesterol\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>mg\/dL)", "total cholesterol"),
    (r"hdl cholesterol\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>mg\/dL)", "hdl cholesterol"),
    (r"ldl cholesterol\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>mg\/dL)", "ldl cholesterol"),
    (r"triglycerides?\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>mg\/dL)", "triglycerides"),
    (r"platelet count\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>x\s*10³?\s*\/\s*μL)", "platelet count"),
    (r"total leucocyte count.*wbc\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>x\s*10³?\s*\/\s*μL)", "wbc"),
    (r"hba1c\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>%)", "hba1c"),
    (r"creatinine.*serum\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>mg\/dL)", "creatinine"),
    (r"blood urea nitrogen.*bun\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>mg\/dL)", "bun"),
    (r"vitamin\s+d.*total\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>ng\/mL)", "vitamin d"),
    (r"vitamin\s+b-?12\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>pg\/mL)", "vitamin b12"),
    (r"c-peptide\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>ng\/mL)", "c-peptide"),
    (r"tsh.*ultrasensitive\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>μIU\/mL)", "tsh"),
    (r"total thyroxine.*t4\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>μg\/dL)", "t4"),
    (r"total triiodothyronine.*t3\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>ng\/dL)", "t3"),
    (r"esr.*(?P<val>\d+)\s*(?P<unit>mm\s*\/\s*hr)", "esr"),
    (r"iron\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>μg\/dL)", "iron"),
    (r"calcium\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>mg\/dL)", "calcium"),
    (r"sodium\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>mmol\/L)", "sodium"),
    (r"chloride\s+(?P<val>\d+(\.\d+)?)\s*(?P<unit>mmol\/L)", "chloride"),
]

RADIOLOGY_PATTERNS = [
    (r"osteochondral\s+changes", r"(?P<finding>osteochondral\s+changes)\s+(?P<descriptor>noted|seen|present)?\s*(?P<location>in\s+[\w\s]+)?"),
    (r"chondromalacia", r"(?P<finding>chondromalacia\s+\w+)\s*\(?\s*(?P<grade>grade\s+\w+)?\)?"),
    (r"joint\s+effusion", r"(?P<finding>joint\s+effusion)\s+with\s+(?P<descriptor>[\w\s]+)?"),
    (r"subchondral\s+cystic\s+changes", r"(?P<finding>subchondral\s+cystic\s+changes)"),
    (r"joint\s+space\s+is\s+normal", r"(?P<finding>joint\s+space)\s+is\s+(?P<descriptor>normal)"),
    (r"menisci\s+is\s+normal", r"(?P<finding>menisci)\s+is\s+(?P<descriptor>normal\s+and\s+intact)"),
    (r"cruciate\s+ligaments\s+are\s+normal", r"(?P<finding>cruciate\s+ligaments)\s+are\s+(?P<descriptor>normal)"),
    (r"collateral\s+ligaments\s+are\s+normal", r"(?P<finding>collateral\s+ligaments)\s+are\s+(?P<descriptor>normal)"),
    (r"no\s+evidence\s+of", r"(?P<evidence>no\s+evidence\s+of)\s+(?P<finding>[\w\s]+)"),
    (r"normal\s+and\s+intact", r"(?P<finding>[\w\s]+)\s+(?P<descriptor>normal\s+and\s+intact)"),
    (r"changes\s+noted", r"(?P<finding>[\w\s]+\s+changes)\s+(?P<descriptor>noted)"),
    (r"osteophytes?", r"(?P<finding>osteophytes?)\s+(?P<descriptor>seen|present|noted|identified)?"),
    (r"lordosis", r"(?P<descriptor>normal|reduced|increased|loss\s+of)?\s*(?P<finding>lordosis)"),
    (r"disc\s+(?:herniation|bulge|protrusion)", r"(?P<finding>disc\s+(?:herniation|bulge|protrusion))\s*(?P<location>at\s+\w+)?"),
    (r"[\w\s]+\s+is\s+normal", r"(?P<finding>[\w\s]+)\s+is\s+(?P<descriptor>normal)"),
    (r"[\w\s]+\s+are\s+normal", r"(?P<finding>[\w\s]+)\s+are\s+(?P<descriptor>normal)"),
]

def detect_report_type(text: str) -> str:
    """Detect if this is a lab report or radiology report"""
    text_lower = text.lower()
    
    radiology_keywords = ['mri', 'ct', 'x-ray', 'ultrasound', 'scan', 'imaging', 
                         'vertebral', 'spine', 'disc', 'osteophytes', 'lordosis',
                         'protocol', 'sequences', 'sagittal', 'axial', 'coronal']
    
    lab_keywords = ['hemoglobin', 'cholesterol', 'glucose', 'creatinine', 'bilirubin',
                   'platelet', 'wbc', 'rbc', 'lab', 'laboratory', 'blood work']
    
    radiology_score = sum(1 for kw in radiology_keywords if kw in text_lower)
    lab_score = sum(1 for kw in lab_keywords if kw in text_lower)
    
    if radiology_score > lab_score:
        return "radiology"
    elif lab_score > radiology_score:
        return "laboratory" 
    else:
        return "unknown"

def parse_labs(text: str) -> List[Dict]:
    """Parse traditional lab values with numeric results"""
    text_lower = text.lower()
    rows = []
    seen_tests = set()
    
    table_pattern = r'(?P<test>hemoglobin|hba1c|creatinine|total cholesterol|hdl cholesterol|ldl cholesterol|triglycerides|platelet count|vitamin b-12|vitamin d|c-peptide|tsh|iron|calcium|sodium|chloride|esr)\s*(?:.*?)\s*(?P<val>\d+(?:\.\d+)?)\s*(?P<unit>[a-zA-Z\/μ%³°]+)'
    
    for match in re.finditer(table_pattern, text_lower, re.IGNORECASE):
        test_name = match.group('test')
        if test_name not in seen_tests:
            seen_tests.add(test_name)
            rows.append({
                "type": "lab_value",
                "test": test_name,
                "value": match.group('val'),
                "unit": match.group('unit'),
                "snippet": match.group(0).strip()
            })
    
    specific_patterns = [
        (r'hemoglobin\s+(\d+\.\d+)\s+(g/dl)', 'hemoglobin'),
        (r'hba1c\s+(\d+\.\d+)\s*(%)', 'hba1c'),
        (r'total cholesterol\s+(\d+)\s*(mg/dl)', 'total cholesterol'),
        (r'hdl cholesterol\s+(\d+)\s*(mg/dl)', 'hdl cholesterol'),
        (r'ldl cholesterol\s+(\d+\.\d+)\s*(mg/dl)', 'ldl cholesterol'),
        (r'triglycerides\s+(\d+)\s*(mg/dl)', 'triglycerides'),
        (r'vitamin d.*total\s+(\d+\.\d+)\s*(ng/ml)', 'vitamin d'),
        (r'vitamin b-12\s+(\d+)\s*(pg/ml)', 'vitamin b12'),
        (r'c-peptide\s+(\d+\.\d+)\s*(ng/ml)', 'c-peptide'),
        (r'creatinine.*serum\s+(\d+\.\d+)\s*(mg/dl)', 'creatinine'),
        (r'tsh.*ultrasensitive\s+(\d+\.\d+)\s*(μiu/ml)', 'tsh'),
    ]
    
    for pattern, test_name in specific_patterns:
        if test_name not in seen_tests:
            matches = re.finditer(pattern, text_lower)
            for match in matches:
                seen_tests.add(test_name)
                rows.append({
                    "type": "lab_value",
                    "test": test_name,
                    "value": match.group(1),
                    "unit": match.group(2),
                    "snippet": match.group(0).strip()
                })
                break
    
    return rows

def parse_radiology_findings(text: str) -> List[Dict]:
    """Parse radiology findings and descriptive results"""
    text_lower = text.lower()
    findings = []
    seen_findings = set()
    
    for name_re, finding_re in RADIOLOGY_PATTERNS:
        for m in re.finditer(name_re, text_lower):
            start = max(0, m.start()-100)
            end = m.end()+100
            snippet = text_lower[start:end]
            f = re.search(finding_re, snippet)
            if f:
                finding_text = f.group("finding") if "finding" in f.groupdict() else m.group(0)
                unique_key = finding_text.strip().lower()
                
                if unique_key not in seen_findings:
                    seen_findings.add(unique_key)
                    findings.append({
                        "type": "radiology_finding",
                        "finding": finding_text,
                        "descriptor": f.groupdict().get("descriptor", ""),
                        "evidence": f.groupdict().get("evidence", ""),
                        "details": f.groupdict().get("details", ""),
                        "snippet": snippet.strip()
                    })
    
    obs_match = re.search(r'observations?:(.*?)(?:\n\n|\n[A-Z]|$)', text_lower, re.DOTALL)
    if obs_match:
        obs_text = obs_match.group(1)
        sentences = re.split(r'[.!?]+', obs_text)
        for sent in sentences:
            sent = sent.strip()
            if len(sent) > 10 and any(kw in sent for kw in ['normal', 'abnormal', 'no evidence', 'seen', 'present']):
                unique_key = sent.lower()
                if unique_key not in seen_findings:
                    seen_findings.add(unique_key)
                    findings.append({
                        "type": "clinical_observation",
                        "finding": sent,
                        "descriptor": "",
                        "evidence": "",
                        "details": "",
                        "snippet": sent
                    })
    
    return findings

# Knowledge Base
KB = [
    {"id":"kb1", "text":"Low hemoglobin (Hb) may indicate anemia; common causes include iron deficiency, chronic disease, or blood loss. Symptoms: fatigue, pallor, shortness of breath."},
    {"id":"kb2", "text":"High white blood cell count (leukocytosis) may suggest infection, inflammation, leukemia, or stress response. Normal range: 4,000-11,000 cells/μL."},
    {"id":"kb3", "text":"Low platelet counts (thrombocytopenia) increase bleeding risk; causes include medications, infection, or immune conditions."},
    {"id":"kb6", "text":"High LDL cholesterol increases cardiovascular risk; lifestyle and lipid-lowering therapy may be indicated depending on level."},
    {"id":"kb7", "text":"Low HDL cholesterol (<40 mg/dL in men, <50 mg/dL in women) increases cardiovascular risk; exercise and niacin may help increase levels."},
    {"id":"kb8", "text":"High triglycerides (>150 mg/dL) associated with metabolic syndrome, diabetes, and pancreatitis risk. Dietary modification recommended."},
    {"id":"kb15", "text":"Elevated creatinine indicates decreased kidney function; normal varies by age, sex, and muscle mass. Used to calculate eGFR."},
    {"id":"kb23", "text":"Elevated HbA1c (>6.5%) indicates diabetes diagnosis; 5.7-6.4% suggests prediabetes. Target <7% for most diabetic patients."},
    {"id":"kb50", "text":"Normal menisci and ligaments indicate healthy joint structures with no tears or damage. This is a positive finding showing good joint stability."},
    {"id":"kb51", "text":"Osteochondral changes may indicate early arthritis or cartilage damage. When absent, it suggests healthy joint surfaces."},
    {"id":"kb52", "text":"Subchondral cystic changes can indicate joint degeneration or arthritis. These appear as fluid-filled spaces in the bone under cartilage."},
    {"id":"kb53", "text":"Chondromalacia patella is softening of cartilage behind the kneecap, often causing knee pain and stiffness."},
    {"id":"kb54", "text":"Joint effusion means fluid accumulation in the joint space, often due to injury, inflammation, or infection."},
    {"id":"kb55", "text":"Normal joint space indicates healthy cartilage thickness and no significant arthritis or joint degeneration."},
]

# Initialize embedding model (simplified for demo)
try:
    from sentence_transformers import SentenceTransformer
    embed_model = SentenceTransformer("pritamdeka/S-BioBert-snli-multinli-stsb")
    
    def embed_texts(texts: List[str]) -> np.ndarray:
        emb = embed_model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        return np.array(emb).astype('float32')
    
    def build_faiss_index(embeddings: np.ndarray):
        import faiss
        faiss.normalize_L2(embeddings)
        d = embeddings.shape[1]
        index = faiss.IndexFlatIP(d)
        index.add(embeddings)
        return index, embeddings
    
    def search_index(index, query_emb: np.ndarray, k=5):
        import faiss
        faiss.normalize_L2(query_emb)
        D, I = index.search(query_emb, k)
        return D, I
    
    KB_texts = [x["text"] for x in KB]
    KB_embs = embed_texts(KB_texts)
    KB_index, _ = build_faiss_index(KB_embs)
    
except Exception as e:
    logger.warning(f"Could not initialize embedding model: {e}")
    embed_model = None
    KB_index = None

def call_ollama_api(prompt: str, model: str = "llama2"):
    """Call Ollama API for generating explanations"""
    url = "http://localhost:11434/api/generate"
    data = {"model": model, "prompt": prompt, "stream": False}
    
    try:
        resp = requests.post(url, json=data, timeout=30)
        resp.raise_for_status()
        result = resp.json()
        return result.get("response", "No response generated")
    except requests.exceptions.RequestException as e:
        logger.warning(f"Ollama API not available: {e}")
        return None  # Return None to use fallback explanations

def clean_finding_name(finding: str) -> str:
    """Clean and format finding names for better display"""
    finding = re.sub(r'\s+', ' ', finding.strip())
    
    if 'menisci' in finding.lower():
        return 'Menisci'
    elif 'cruciate ligament' in finding.lower():
        return 'Cruciate Ligaments'
    elif 'collateral ligament' in finding.lower():
        return 'Collateral Ligaments'
    elif 'joint space' in finding.lower():
        return 'Joint Space'
    elif 'osteochondral' in finding.lower():
        return 'Osteochondral Changes'
    elif 'chondromalacia' in finding.lower():
        return 'Chondromalacia Patella'
    else:
        return finding.title() if finding else 'Unknown Finding'

def generate_fallback_explanation(parsed_item: Dict, kb_results: List[str]) -> str:
    """Generate detailed fallback explanations when Ollama is not available"""
    finding = parsed_item.get("finding", parsed_item.get("test", ""))
    descriptor = parsed_item.get("descriptor", "") or ""
    kb_context = kb_results[0] if kb_results else ""
    
    if parsed_item["type"] == "lab_value":
        test_name = parsed_item.get("test", "").lower()
        value = parsed_item.get("value", "")
        unit = parsed_item.get("unit", "")
        
        # Specific explanations for common lab tests
        lab_explanations = {
            "hemoglobin": f"Hemoglobin level of {value} {unit}. This protein in red blood cells carries oxygen throughout your body. Normal ranges vary by gender and age.",
            "hba1c": f"HbA1c level of {value}%. This test shows your average blood sugar over 2-3 months. Values under 5.7% are normal, 5.7-6.4% indicate prediabetes, and 6.5% or higher suggests diabetes.",
            "total cholesterol": f"Total cholesterol of {value} {unit}. This includes all types of cholesterol in your blood. Levels under 200 mg/dL are desirable.",
            "hdl cholesterol": f"HDL (good) cholesterol of {value} {unit}. Higher levels are better for heart health. Aim for 40+ mg/dL (men) or 50+ mg/dL (women).",
            "ldl cholesterol": f"LDL (bad) cholesterol of {value} {unit}. Lower levels reduce heart disease risk. Generally aim for under 100 mg/dL.",
            "triglycerides": f"Triglyceride level of {value} {unit}. These are blood fats that can affect heart health. Normal is under 150 mg/dL.",
            "creatinine": f"Creatinine level of {value} {unit}. This waste product indicates kidney function. Normal ranges vary but are typically 0.6-1.2 mg/dL.",
            "tsh": f"TSH level of {value} {unit}. This hormone regulates thyroid function. Normal range is typically 0.4-4.0 mIU/L.",
            "vitamin d": f"Vitamin D level of {value} {unit}. This vitamin is important for bone health. Levels above 20 ng/mL are generally adequate.",
            "vitamin b12": f"Vitamin B12 level of {value} {unit}. This vitamin is essential for nerve function and blood formation. Low levels can cause fatigue and neurological symptoms."
        }
        
        if test_name in lab_explanations:
            return lab_explanations[test_name]
        else:
            return f"Lab test result: {value} {unit}. {kb_context}" if kb_context else f"Lab value of {value} {unit} detected. This test measures specific substances in your blood to assess organ function and overall health."
    
    else:  # radiology finding
        finding_name = clean_finding_name(finding).lower()
        
        # Determine if finding is normal or concerning
        normal_indicators = ['normal', 'intact', 'no evidence', 'unremarkable']
        concerning_indicators = ['changes', 'effusion', 'cystic', 'herniation', 'tear']
        
        is_normal = any(indicator in f"{finding} {descriptor}".lower() for indicator in normal_indicators)
        is_concerning = any(indicator in f"{finding} {descriptor}".lower() for indicator in concerning_indicators)
        
        if is_normal:
            normal_explanations = {
                "menisci": "The menisci (cartilage cushions) in your joint appear normal and intact, which is good news for joint stability.",
                "cruciate ligaments": "The cruciate ligaments that provide knee stability appear normal with no tears or damage.",
                "collateral ligaments": "The collateral ligaments that provide side-to-side knee stability appear normal.",
                "joint space": "The joint space appears normal, indicating healthy cartilage thickness and no significant arthritis.",
                "osteochondral": "No osteochondral changes were detected, suggesting healthy joint surfaces without early arthritis signs."
            }
            
            for key, explanation in normal_explanations.items():
                if key in finding_name:
                    return explanation
            
            return f"The {clean_finding_name(finding)} appears normal, which is a positive finding indicating healthy structures."
        
        elif is_concerning:
            concerning_explanations = {
                "osteochondral changes": "Osteochondral changes may indicate early arthritis or cartilage damage in the joint area.",
                "chondromalacia": "Chondromalacia refers to softening of cartilage, often behind the kneecap, which can cause pain and stiffness.",
                "joint effusion": "Joint effusion means fluid has accumulated in the joint space, often due to injury, inflammation, or infection.",
                "subchondral cystic changes": "Subchondral cystic changes can indicate joint degeneration, appearing as fluid-filled spaces in bone under cartilage.",
                "disc herniation": "Disc herniation occurs when spinal disc material moves out of its normal position, potentially causing pain or nerve compression."
            }
            
            for key, explanation in concerning_explanations.items():
                if key in finding_name:
                    return explanation
            
            return f"Changes noted in {clean_finding_name(finding)}. This finding may require follow-up with your healthcare provider."
        
        else:
            return f"Finding: {clean_finding_name(finding)}. {kb_context}" if kb_context else f"Medical finding detected in imaging. This finding was identified during radiological examination and may provide important information about your health status."

def generate_patient_explanation(parsed_item: Dict, kb_results: List[str]) -> str:
    """Generate patient-friendly explanations with fallback support"""
    finding = parsed_item.get("finding", parsed_item.get("test", ""))
    descriptor = parsed_item.get("descriptor", "") or ""
    
    clean_name = clean_finding_name(finding)
    kb_context = kb_results[0] if kb_results else ""
    
    if parsed_item["type"] == "lab_value":
        value = parsed_item['value']
        unit = parsed_item.get('unit', '')
        
        prompt = f"""You are a medical assistant. Explain this lab result briefly and clearly.

Lab: {clean_name}
Value: {value} {unit}
Medical Info: {kb_context}

Provide ONLY a 1-2 sentence explanation in simple terms. Be direct and clear."""
        
    else:  # radiology finding
        normal_indicators = ['normal', 'intact', 'no evidence']
        is_normal = any(indicator in f"{finding} {descriptor}".lower() for indicator in normal_indicators)
        
        if is_normal:
            prompt = f"""You are a medical assistant. This is a NORMAL finding.

Finding: {clean_name} - {descriptor}
Medical Info: {kb_context}

Provide ONLY a 1-2 sentence explanation confirming this is normal/healthy. Be reassuring and direct."""
        else:
            prompt = f"""You are a medical assistant. This finding needs attention.

Finding: {clean_name} - {descriptor}  
Medical Info: {kb_context}

Provide ONLY a 1-2 sentence explanation of what this means. Be clear but not alarming."""
    
    # Try Ollama first
    ollama_response = call_ollama_api(prompt)
    
    # If Ollama is not available, use detailed fallback
    if ollama_response is None:
        return generate_fallback_explanation(parsed_item, kb_results)
    
    return ollama_response

def analyze_medical_report(file_path: str) -> Dict:
    """Main analysis function"""
    try:
        # Extract text
        raw_text = extract_text(file_path)
        report_type = detect_report_type(raw_text)
        
        # Parse based on report type
        if report_type == "laboratory":
            parsed = parse_labs(raw_text)
        elif report_type == "radiology":
            parsed = parse_radiology_findings(raw_text)
        else:
            parsed = parse_labs(raw_text) + parse_radiology_findings(raw_text)
        
        explanations = []
        for i, p in enumerate(parsed, 1):
            # Create search text
            if p["type"] == "lab_value":
                search_text = f"{p['test']} {p['value']} {p.get('unit','')}"
                display_name = clean_finding_name(p['test'])
                value_info = p['value']
                unit_info = p.get('unit', '')
            else:
                search_text = f"{p['finding']} {p.get('descriptor','')}"
                display_name = clean_finding_name(p['finding'])
                value_info = ""
                unit_info = ""
            
            # Get relevant knowledge
            kb_snips = []
            if KB_index and embed_model:
                try:
                    q_emb = embed_texts([search_text])
                    D, I = search_index(KB_index, q_emb, k=2)
                    kb_snips = [KB[idx]["text"] for idx in I[0] if idx < len(KB)]
                except:
                    kb_snips = ["General medical information available upon consultation."]
            
            # Generate explanation
            llm_out = generate_patient_explanation(p, kb_snips)
            
            explanations.append({
                "keyword_number": i,
                "keyword": display_name,
                "type": p["type"],
                "finding": p.get("finding", p.get("test", "")),
                "value": value_info,
                "unit": unit_info,
                "descriptor": p.get("descriptor", ""),
                "explanation": llm_out.strip(),
                "kb_matches": kb_snips[:1]
            })
        
        return {
            "success": True,
            "report_type": report_type,
            "total_findings": len(parsed),
            "explanations": explanations,
            "raw_text": raw_text[:1000] + "..." if len(raw_text) > 1000 else raw_text
        }
    
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        return {
            "success": False,
            "error": f"Analysis failed: {str(e)}",
            "report_type": "unknown",
            "total_findings": 0,
            "explanations": []
        }

# ---------- Flask Routes ----------

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "message": "Medical Report Analyzer API is running",
        "supported_formats": list(ALLOWED_EXTENSIONS)
    })

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        # Check if file is in request
        if 'file' not in request.files:
            return jsonify({
                "success": False,
                "error": "No file provided"
            }), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({
                "success": False,
                "error": "No file selected"
            }), 400
        
        if not allowed_file(file.filename):
            return jsonify({
                "success": False,
                "error": f"File type not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            }), 400
        
        # Save uploaded file
        filename = secure_filename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        
        logger.info(f"File uploaded: {filename}")
        
        # Analyze the report
        result = analyze_medical_report(file_path)
        
        # Clean up uploaded file
        try:
            os.remove(file_path)
        except:
            pass
        
        logger.info(f"Analysis complete: {result['total_findings']} findings")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}",
            "report_type": "unknown",
            "total_findings": 0,
            "explanations": []
        }), 500

@app.route('/test', methods=['GET'])
def test_endpoint():
    return jsonify({
        "message": "API is working",
        "embedding_model_loaded": embed_model is not None,
        "kb_index_loaded": KB_index is not None,
        "kb_entries": len(KB)
    })

if __name__ == '__main__':
    print("🏥 Medical Report Analyzer API")
    print("=" * 50)
    print(f"Supported file types: {', '.join(ALLOWED_EXTENSIONS)}")
    print(f"Max file size: {app.config['MAX_CONTENT_LENGTH'] // (1024*1024)}MB")
    print(f"Knowledge base entries: {len(KB)}")
    print(f"Embedding model loaded: {embed_model is not None}")
    print("=" * 50)
    
    app.run(host='0.0.0.0', port=5000, debug=True)