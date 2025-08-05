import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-vercel-protection-bypass, x-vercel-set-bypass-cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Bedrock API called with headers:', req.headers);
    
    const { systemMessage, userMessage } = req.body;

    if (!systemMessage || !userMessage) {
      console.log('Missing parameters:', { systemMessage, userMessage });
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get AWS credentials from environment variables
    const accessKeyId = process.env.VITE_BEDROCK_ACCESS_KEY_ID;
    const secretAccessKey = process.env.VITE_BEDROCK_SECRET_ACCESS_KEY;

    console.log('AWS credentials check:', { 
      hasAccessKeyId: !!accessKeyId, 
      hasSecretAccessKey: !!secretAccessKey,
      accessKeyIdLength: accessKeyId?.length,
      secretAccessKeyLength: secretAccessKey?.length
    });

    if (!accessKeyId || !secretAccessKey) {
      console.log('AWS credentials not configured');
      return res.status(500).json({ error: 'AWS credentials not configured' });
    }

    // Initialize Bedrock client with us-west-2 region (where Bedrock is available)
    const bedrockClient = new BedrockRuntimeClient({
      region: 'us-west-2', // Changed from us-east-1 to us-west-2
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey
      }
    });

    console.log('Bedrock client initialized, making API call...');

    // Create the prompt for Llama 3.3 70B
    const prompt = `<|system|>
${systemMessage}
<|user|>
${userMessage}
<|assistant|>`;

    const requestBody = {
      prompt: prompt,
      max_gen_len: 8000,
      temperature: 0.1,
      top_p: 0.9
    };

    // Try a different model ID that might be more commonly available
    const modelId = "meta.llama3-3-70b-instruct-v1:0";
    console.log('Trying model ID:', modelId);

    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      body: JSON.stringify(requestBody)
    });

    console.log('Sending Bedrock command with modelId:', command.input.modelId);
    
    try {
      const response = await bedrockClient.send(command);
      console.log('Bedrock response received');
      
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      if (responseBody.error) {
        console.log('Bedrock API error:', responseBody.error);
        return res.status(500).json({ error: responseBody.error });
      }

      const content = responseBody.generation;
      if (!content) {
        console.log('Empty response from Bedrock');
        return res.status(500).json({ error: 'Empty response from Bedrock' });
      }

      console.log('Bedrock content received, length:', content.length);

      // Parse the JSON response from the model
      try {
        // Extract JSON from markdown code blocks if present
        let jsonContent = content.trim();
        
        // First, try to find JSON within markdown code blocks
        const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1];
        } else {
          // Try to find JSON object anywhere in the text
          const jsonObjectMatch = jsonContent.match(/\{[\s\S]*\}/);
          if (jsonObjectMatch) {
            jsonContent = jsonObjectMatch[0];
          } else {
            // Remove markdown code block markers if no match found
            if (jsonContent.startsWith('```json')) {
              jsonContent = jsonContent.substring(7);
            }
            if (jsonContent.startsWith('```')) {
              jsonContent = jsonContent.substring(3);
            }
            if (jsonContent.endsWith('```')) {
              jsonContent = jsonContent.substring(0, jsonContent.length - 3);
            }
          }
        }
        
        // Clean up any remaining whitespace and try to parse
        jsonContent = jsonContent.trim();
        
        // Additional cleanup: remove any text before the first {
        const firstBraceIndex = jsonContent.indexOf('{');
        if (firstBraceIndex > 0) {
          jsonContent = jsonContent.substring(firstBraceIndex);
        }
        
        // Additional cleanup: remove any text after the last }
        const lastBraceIndex = jsonContent.lastIndexOf('}');
        if (lastBraceIndex >= 0 && lastBraceIndex < jsonContent.length - 1) {
          jsonContent = jsonContent.substring(0, lastBraceIndex + 1);
        }
        
        // Additional cleanup: remove Python-style tags and other non-JSON content
        jsonContent = jsonContent.replace(/<\|[^|]*\|>/g, '');
        jsonContent = jsonContent.replace(/^[^{]*/, '');
        jsonContent = jsonContent.replace(/}[^}]*$/, '}');
        
        console.log('Parsed JSON content:', jsonContent.substring(0, 200) + '...');
        
        const parsedResponse = JSON.parse(jsonContent);
        console.log('Successfully parsed JSON response');
        return res.status(200).json(parsedResponse);
      } catch (parseError) {
        console.warn('Failed to parse JSON response from Bedrock:', content);
        return res.status(500).json({ 
          error: `JSON parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Response was: ${content.substring(0, 200)}...` 
        });
      }
    } catch (bedrockError) {
      console.error('Bedrock API call failed:', bedrockError);
      
      // Return a more detailed error message
      return res.status(500).json({ 
        error: `Bedrock API call failed: ${bedrockError instanceof Error ? bedrockError.message : 'Unknown error'}. This might be due to: 1) AWS credentials not having Bedrock permissions, 2) Model not available in your AWS account, 3) Bedrock service not enabled in your AWS account.` 
      });
    }
  } catch (error) {
    console.error('Bedrock API error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    });
  }
} 