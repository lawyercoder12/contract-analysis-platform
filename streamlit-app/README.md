# Contract Analysis Platform - Streamlit Version

This is a Streamlit web application version of the Contract Analysis Platform that provides AI-powered analysis of legal documents.

## Features

🔍 **Comprehensive Analysis**
- Definition extraction (inline and dedicated clauses)
- Term usage tracking and validation
- Undefined term identification
- Cross-reference detection
- Improvement suggestions

🤖 **Multi-AI Provider Support**
- Google Gemini (gemini-2.5-flash)
- OpenAI GPT (gpt-4.1-mini)

📊 **Interactive Results**
- Tabbed interface for organized results
- Expandable cards for detailed information
- Issue badges for quick problem identification
- Progress tracking during analysis

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Set Up API Keys
Create a `.env` file with your API keys:
```
VITE_OPENAI_API_KEY=your_openai_key_here
VITE_GEMINI_API_KEY=your_gemini_key_here
```

### 3. Run the Application
```bash
streamlit run app.py
```

### 4. Open in Browser
The app will automatically open at `http://localhost:8501`

## Usage

1. **Configure**: Select your AI provider and enter API key in the sidebar
2. **Upload**: Upload a DOCX contract file
3. **Analyze**: Click "Analyze Contract" and wait for processing
4. **Review**: Explore results in the tabbed interface

## Deployment Options

### Streamlit Cloud
1. Push to GitHub repository
2. Connect to [share.streamlit.io](https://share.streamlit.io)
3. Add secrets for API keys in Streamlit Cloud dashboard

### Local Deployment
```bash
# Install dependencies
pip install -r requirements.txt

# Run locally
streamlit run app.py --server.port 8501
```

### Docker Deployment
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8501

CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
```

## API Key Configuration

The app will automatically detect API keys from:
1. Environment variables (`.env` file)
2. Streamlit secrets (for cloud deployment)
3. Manual input in sidebar

## Supported File Formats

- **DOCX**: Microsoft Word documents (primary support)
- **Future**: PDF support planned

## Technical Details

- **Framework**: Streamlit
- **AI Providers**: Google Gemini AI, OpenAI GPT
- **Document Processing**: python-docx for DOCX parsing
- **State Management**: Streamlit session state
- **Styling**: Custom CSS for professional appearance

## Troubleshooting

**API Key Issues**
- Ensure API keys are valid and have sufficient quota
- Check for proper environment variable names
- Verify network connectivity

**File Upload Issues**
- Only DOCX files are supported
- Ensure file is not corrupted or password-protected
- Check file size limits (Streamlit default: 200MB)

**Analysis Errors**
- Try smaller documents for testing
- Check API provider status
- Verify model availability

## Contributing

This is a Python port of the original React/TypeScript application. Both versions maintain feature parity for contract analysis capabilities.

---
Built with ❤️ using Streamlit • Powered by AI