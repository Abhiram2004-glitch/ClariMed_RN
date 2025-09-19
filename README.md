# Medical Report Analyzer

A React Native mobile application with Flask backend that analyzes medical reports (PDFs and images) using AI to extract and explain medical findings in patient-friendly language.

## Features

- 📱 **React Native Mobile App** - Cross-platform mobile interface
- 🔍 **PDF & Image Analysis** - Supports PDF reports and medical images (JPG, PNG)
- 🤖 **AI-Powered Explanations** - Uses LLM to generate patient-friendly explanations
- 🏥 **Multi-Report Types** - Handles laboratory and radiology reports
- 📊 **Structured Output** - Organized findings with values, units, and descriptions
- 💾 **Knowledge Base Integration** - Medical knowledge base with semantic search
- 🔒 **File Validation** - Size limits and type checking for security

## Architecture

### Frontend (React Native)
- **HomeScreen.js** - Main interface for file upload and results display
- Custom hooks for API calls and file operations
- Optimized with memoized components for performance
- Pull-to-refresh and loading states

### Backend (Flask)
- **app.py** - Flask API server with medical analysis pipeline
- OCR text extraction from PDFs and images
- Pattern-based parsing for lab values and radiology findings
- Semantic search using sentence transformers
- LLM integration (Ollama) with fallback explanations

## Prerequisites

### Backend Dependencies
```bash
pip install flask flask-cors
pip install pdf2image pytesseract pillow
pip install pymupdf  # or fitz
pip install sentence-transformers faiss-cpu
pip install numpy requests
```

### System Requirements
- **Tesseract OCR** - For image text extraction
  - Windows: Download from [GitHub releases](https://github.com/UB-Mannheim/tesseract/wiki)
  - macOS: `brew install tesseract`
  - Linux: `apt-get install tesseract-ocr`

- **Ollama** (Optional) - For enhanced AI explanations
  - Install from [ollama.ai](https://ollama.ai/)
  - Pull model: `ollama pull llama2`

### Frontend Dependencies
```bash
npm install expo-document-picker expo-image-picker
npm install @expo/vector-icons
```

## Installation & Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd medical-report-analyzer
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Update Tesseract path in app.py if needed
# Windows: r"C:\Program Files\Tesseract-OCR\tesseract.exe"
# macOS/Linux: Usually auto-detected

# Create uploads directory
mkdir uploads
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

### 4. Configure Network
Update the API endpoint in `HomeScreen.js`:
```javascript
const result = await makeRequest('http://YOUR_IP_ADDRESS:5000/upload', {
```

## Usage

### Start Backend Server
```bash
cd backend
python app.py
```
Server runs on `http://0.0.0.0:5000`

### Start React Native App
```bash
cd frontend
npx expo start
```

### Using the App
1. **Select File** - Choose "Pick PDF Report" or "Pick Medical Image"
2. **Upload & Analyze** - Tap "Analyze Report" to process
3. **View Results** - See extracted findings with explanations
4. **Clear/Refresh** - Pull down to refresh or clear selected file

## API Endpoints

### `GET /`
Health check endpoint
```json
{
  "status": "healthy",
  "message": "Medical Report Analyzer API is running",
  "supported_formats": ["pdf", "png", "jpg", "jpeg"]
}
```

### `POST /upload`
Analyze medical report
- **Body**: `multipart/form-data` with `file` field
- **Max Size**: 16MB
- **Supported**: PDF, JPG, PNG, JPEG

**Response:**
```json
{
  "success": true,
  "report_type": "laboratory|radiology",
  "total_findings": 5,
  "explanations": [
    {
      "keyword_number": 1,
      "keyword": "Hemoglobin",
      "type": "lab_value",
      "value": "12.5",
      "unit": "g/dL",
      "explanation": "Your hemoglobin level is normal..."
    }
  ]
}
```

### `GET /test`
Test endpoint for system status

## Supported Medical Data

### Laboratory Tests
- Hemoglobin, HbA1c, Cholesterol (Total, HDL, LDL)
- Triglycerides, Creatinine, TSH, T3, T4
- Vitamins (D, B12), Electrolytes, Iron
- Complete Blood Count (WBC, Platelet)

### Radiology Findings
- Joint conditions (effusion, space, menisci)
- Bone changes (osteochondral, subchondral cysts)
- Cartilage issues (chondromalacia)
- Spinal findings (disc herniation, lordosis)
- Normal anatomy confirmations

## Error Handling

### Backend
- File validation (size, type)
- OCR fallbacks for difficult text
- LLM fallback explanations
- Comprehensive error logging

### Frontend
- Network timeout handling
- File picker error management
- Loading states and user feedback
- Graceful error display

## Security Considerations

- File size limits (16MB max)
- Allowed file type validation
- Secure filename handling
- Temporary file cleanup
- No persistent file storage

## Performance Optimizations

### Frontend
- Memoized components (`React.memo`)
- Custom hooks for state management
- Image compression for faster uploads
- Pull-to-refresh functionality

### Backend
- Efficient text extraction
- Optimized regex patterns
- FAISS vector search
- Request timeouts

## Development Tips

### Testing
- Use `/test` endpoint to verify setup
- Check Tesseract path configuration
- Test with sample medical reports
- Monitor server logs for errors

### Debugging
- Enable Flask debug mode: `app.run(debug=True)`
- Check Ollama connection: `curl http://localhost:11434/api/generate`
- Verify file permissions for uploads directory

## Troubleshooting

### Common Issues

**"Tesseract not found"**
- Verify installation and path in `app.py`
- Check PATH environment variable

**"Ollama connection failed"**
- Fallback explanations will be used
- Install Ollama for enhanced responses

**"File too large"**
- Maximum 16MB file size limit
- Compress images before upload

**"Network timeout"**
- Increase timeout in `makeRequest` function
- Check network connectivity

### File Format Issues
- PDFs: Use text-based PDFs when possible
- Images: Ensure clear text for better OCR
- Scanned reports may have lower accuracy

## Contributing

1. Follow existing code structure
2. Add comprehensive error handling
3. Update knowledge base for new findings
4. Test with various report formats
5. Document API changes

## License

This project is for educational and research purposes. Ensure compliance with medical data regulations in your jurisdiction.

## Disclaimer

This tool is for informational purposes only and should not replace professional medical advice. Always consult healthcare providers for medical interpretation and decisions.