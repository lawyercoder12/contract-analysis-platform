# AWS Bedrock Llama 3.3 70B Setup Guide

## Overview
The contract analysis platform now supports Llama 3.3 70B model hosted on AWS Bedrock. This provides an alternative to the Groq-hosted Llama model with robust error handling for JSON parsing issues.

## Setup Instructions

### 1. AWS Credentials
You'll need AWS credentials with access to Bedrock services. The credentials should be in the format:
```
accessKeyId|secretAccessKey
```

For example:
```
YOUR_ACCESS_KEY_ID|YOUR_SECRET_ACCESS_KEY
```

### 2. AWS Permissions
Your AWS account needs the following permissions for Bedrock:
- `bedrock:InvokeModel`
- Access to the `us.meta.llama3-3-70b-instruct-v1:0` inference profile

### 3. Using the Model
1. Select "Llama" as the provider
2. Choose "Llama 3.3 70B (Bedrock - use this)" as the model
3. Enter your AWS credentials in the format shown above
4. Upload and analyze your contract

## Features
- **Context Window**: Limited to 8000 tokens for optimal performance
- **Error Handling**: Robust JSON parsing error handling similar to WatsonX Llama
- **Retry Logic**: Automatic retry with exponential backoff for transient errors
- **JSON Schema Support**: Full support for structured JSON responses

## Error Handling
The Bedrock implementation includes comprehensive error handling for:
- JSON parsing failures (truncation, malformed responses)
- AWS authentication errors
- Network connectivity issues
- Rate limiting and quota exceeded errors

## Model Specifications
- **Model ID**: `us.meta.llama3-3-70b-instruct-v1:0`
- **Region**: `us-east-1` (default)
- **Max Tokens**: 8000
- **Temperature**: 0.1 (for consistent contract analysis)
- **Top-p**: 0.9

## Troubleshooting
- **Invalid credentials format**: Ensure credentials are in `accessKeyId|secretAccessKey` format
- **Access denied**: Verify your AWS account has Bedrock permissions
- **Model not available**: Ensure the Llama 3.3 70B model is available in your AWS region 