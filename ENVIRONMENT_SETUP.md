# Environment Variables Setup

## Overview
The contract analysis platform now supports automatic API key loading from environment variables, eliminating the need to manually enter API keys each time.

## Environment Variables

The following environment variables are automatically loaded from the `.env` file:

### API Keys
- `VITE_GEMINI_API_KEY` - Google Gemini API key
- `VITE_OPENAI_API_KEY` - OpenAI API key  
- `VITE_GROQ_API_KEY` - Groq API key for Llama models

### AWS Credentials (for Bedrock)
- `VITE_AWS_ACCESS_KEY_ID` - AWS Access Key ID
- `VITE_AWS_SECRET_ACCESS_KEY` - AWS Secret Access Key

## How It Works

### Automatic Loading
1. When you select a model, the application automatically checks for the corresponding environment variable
2. If found, the API key is automatically loaded and validated
3. No manual input required - you can proceed directly to file upload

### Model-Specific Behavior
- **Gemini**: Uses `VITE_GEMINI_API_KEY`
- **OpenAI**: Uses `VITE_OPENAI_API_KEY`
- **Llama (Groq)**: Uses `VITE_GROQ_API_KEY`
- **Llama (Bedrock)**: Combines `VITE_AWS_ACCESS_KEY_ID` and `VITE_AWS_SECRET_ACCESS_KEY` in format `accessKeyId|secretAccessKey`

### Fallback Behavior
- If environment variables are not available, the app falls back to manual API key input
- Previously stored API keys in session storage are still supported

## Security

### .env File Protection
- The `.env` file is automatically ignored by git (listed in `.gitignore`)
- API keys are never committed to version control
- Environment variables are only available in the browser during development/production

### Best Practices
- Keep your `.env` file secure and never share it
- Rotate API keys regularly
- Use different API keys for development and production environments

## Usage

### Development
1. The `.env` file is automatically loaded when you run `npm run dev`
2. Select any model and the API key will be automatically loaded
3. Proceed directly to file upload without manual key entry

### Production
- Set environment variables in your hosting platform (Vercel, Netlify, etc.)
- The same automatic loading behavior applies

## Troubleshooting

### Environment Variables Not Loading
1. Ensure the `.env` file exists in the project root
2. Check that variable names start with `VITE_`
3. Restart the development server after making changes

### API Key Validation Fails
1. Verify the API key is correct in the `.env` file
2. Check that the API key has the necessary permissions
3. Ensure the API key is not expired

### AWS Credentials Issues
1. Verify both `VITE_AWS_ACCESS_KEY_ID` and `VITE_AWS_SECRET_ACCESS_KEY` are set
2. Ensure the AWS credentials have Bedrock permissions
3. Check that the credentials are for the correct AWS region

## Example .env File

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_OPENAI_API_KEY=your_openai_api_key_here
VITE_GROQ_API_KEY=your_groq_api_key_here
VITE_AWS_ACCESS_KEY_ID=your_aws_access_key_id_here
VITE_AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here
```

## Benefits

✅ **No Manual Input**: API keys are automatically loaded  
✅ **Improved Security**: Keys are not stored in browser storage  
✅ **Better UX**: Seamless workflow from model selection to analysis  
✅ **Environment Support**: Works in development and production  
✅ **Fallback Support**: Manual input still available if needed  
✅ **Multi-Provider**: Supports all current providers (Gemini, OpenAI, Groq, AWS Bedrock) 