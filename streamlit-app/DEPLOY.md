# Deployment Guide for Contract Analysis Platform (Streamlit)

## 🚀 Quick Deploy Options

### Option 1: Streamlit Cloud (Recommended for Testing)

1. **Push to GitHub** (if not already done):
   ```bash
   git add streamlit-app/
   git commit -m "Add Streamlit version for testing"
   git push
   ```

2. **Deploy to Streamlit Cloud**:
   - Go to [share.streamlit.io](https://share.streamlit.io)
   - Click "New app"
   - Select your GitHub repo: `lawyercoder12/contract-analysis-platform`
   - Set main file path: `streamlit-app/app.py`
   - Click "Deploy"

3. **Add Secrets** (in Streamlit Cloud dashboard):
   ```toml
   VITE_OPENAI_API_KEY = "your_openai_key_here"
   VITE_GEMINI_API_KEY = "your_gemini_key_here"
   ```

### Option 2: Local Development

1. **Install Python** (3.9 or higher):
   - Download from [python.org](https://python.org)
   - Or use Microsoft Store on Windows

2. **Set up virtual environment**:
   ```bash
   cd streamlit-app
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the app**:
   ```bash
   streamlit run app.py
   ```

### Option 3: Docker Deployment

1. **Build Docker image**:
   ```bash
   cd streamlit-app
   docker build -t contract-analysis .
   ```

2. **Run container**:
   ```bash
   docker run -p 8501:8501 contract-analysis
   ```

## 🔑 API Key Setup

### For Streamlit Cloud:
Add as secrets in the Streamlit Cloud dashboard under "Secrets management"

### For Local Development:
Create `.env` file with your keys (already included)

### For Docker:
Pass as environment variables:
```bash
docker run -p 8501:8501 \
  -e VITE_OPENAI_API_KEY="your_key" \
  -e VITE_GEMINI_API_KEY="your_key" \
  contract-analysis
```

## 📊 Features Available

✅ **Core Features**:
- DOCX file upload and processing
- AI-powered definition extraction
- Term usage analysis
- Undefined term detection
- Cross-reference identification
- Improvement suggestions

✅ **UI Features**:
- Professional Streamlit interface
- Progress indicators
- Tabbed results display
- Issue badges and categorization
- Responsive design

✅ **AI Provider Support**:
- Google Gemini (gemini-2.5-flash)
- OpenAI GPT (gpt-4.1-mini)

## 🔧 Troubleshooting

**Import Errors**:
```bash
pip install --upgrade streamlit google-generativeai python-docx
```

**API Issues**:
- Verify API keys are valid
- Check API quotas and billing
- Test with smaller documents first

**File Upload Issues**:
- Ensure DOCX files are not password-protected
- Check file size (Streamlit limit: 200MB)

## 🚀 Production Deployment

For production use, consider:
- **Heroku**: Easy deployment with buildpacks
- **AWS/GCP/Azure**: Container services
- **Railway/Render**: Modern deployment platforms
- **Self-hosted**: VPS with Docker

## 📝 Monitoring

Streamlit Cloud provides:
- Usage analytics
- Error logging
- Performance metrics
- Resource usage tracking

---

Your Streamlit version is ready for deployment! 🎉