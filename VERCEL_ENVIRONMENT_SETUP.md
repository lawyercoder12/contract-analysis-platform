# Vercel Environment Variables Setup

## Overview
This guide explains how to set up environment variables on Vercel to enable Bedrock and WatsonX Llama models without requiring users to provide API keys.

## Environment Variables

### For AWS Bedrock (Llama 3.3 70B)
Add these environment variables in your Vercel project settings:

- `VITE_BEDROCK_ACCESS_KEY_ID`: Your AWS Access Key ID
- `VITE_BEDROCK_SECRET_ACCESS_KEY`: Your AWS Secret Access Key

### For IBM WatsonX (Llama 3.3 70B)
Add this environment variable in your Vercel project settings:

- `VITE_WATSONX_API_KEY`: Your IBM WatsonX API Key

## Setup Instructions

1. Go to your Vercel project dashboard
2. Navigate to Settings > Environment Variables
3. Add each environment variable with the appropriate value
4. Deploy your project

## How It Works

When these environment variables are set:
- Users can select Bedrock or WatsonX Llama models without entering API keys
- The application automatically uses the environment variables for authentication
- Other models (Gemini, OpenAI, Groq) still require user-provided API keys

## Security Notes

- Environment variables are encrypted and secure
- They are only accessible on the server side
- Users cannot see or access these credentials
- The `VITE_` prefix makes them available to the client-side code

## Testing

After deployment:
1. Visit your Vercel deployment URL
2. Select "Llama" as the provider
3. Choose either "Llama 3.3 70B (Bedrock)" or "Llama 3.3 70B (WatsonX)"
4. The application should skip the API key input step and proceed directly to file upload

## Troubleshooting

- **Environment variables not working**: Ensure the variables are properly set in Vercel and the deployment has been completed
- **Model not available**: Verify your AWS/IBM credentials have the necessary permissions
- **Authentication errors**: Check that your API keys are valid and have the required permissions 