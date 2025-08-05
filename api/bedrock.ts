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
    console.log('=== BEDROCK API CALLED ===');
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    
    const { systemMessage, userMessage, responseSchema } = req.body;

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
      secretAccessKeyLength: secretAccessKey?.length,
      accessKeyIdPrefix: accessKeyId?.substring(0, 5) + '...',
      secretAccessKeyPrefix: secretAccessKey?.substring(0, 5) + '...'
    });

    if (!accessKeyId || !secretAccessKey) {
      console.log('❌ AWS credentials not configured');
      return res.status(500).json({ error: 'AWS credentials not configured' });
    }

    // Initialize Bedrock client with us-west-2 region (same as local implementation)
    const bedrockClient = new BedrockRuntimeClient({
      region: 'us-west-2',
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey
      }
    });

    console.log('✅ Bedrock client initialized for region: us-west-2');

    // Use the exact same model as local implementation
    const modelId = "meta.llama3-3-70b-instruct-v1:0";
    console.log('Using model:', modelId);

    // Create the prompt exactly as in local implementation
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

    console.log('Sending request to Bedrock...');
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      body: JSON.stringify(requestBody)
    });

    console.log('Command created, sending to Bedrock...');
    
    try {
      const response = await bedrockClient.send(command);
      console.log('✅ Bedrock response received');
      
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      if (responseBody.error) {
        console.log('❌ Bedrock API error:', responseBody.error);
        return res.status(500).json({ error: responseBody.error });
      }

      const content = responseBody.generation;
      if (!content) {
        console.log('❌ Empty response from Bedrock');
        return res.status(500).json({ error: 'Empty response from Bedrock' });
      }

      console.log('✅ Bedrock content received, length:', content.length);
      console.log('Content preview:', content.substring(0, 200) + '...');

      // Parse the JSON response from the model (same as local implementation)
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
        console.log('✅ Successfully parsed JSON response');
        return res.status(200).json(parsedResponse);
      } catch (parseError) {
        console.warn('Failed to parse JSON response from Bedrock:', content);
        return res.status(500).json({ 
          error: `JSON parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Response was: ${content.substring(0, 200)}...` 
        });
      }
    } catch (bedrockError) {
      console.error('❌ Bedrock API call failed:', {
        error: bedrockError instanceof Error ? bedrockError.message : 'Unknown error',
        code: (bedrockError as any)?.code,
        name: (bedrockError as any)?.name,
        stack: bedrockError instanceof Error ? bedrockError.stack : undefined
      });
      
      // Return a more detailed error message with specific troubleshooting steps
      return res.status(500).json({ 
        error: `Bedrock API call failed: ${bedrockError instanceof Error ? bedrockError.message : 'Unknown error'}. 
        
TROUBLESHOOTING STEPS:
1. Go to AWS Bedrock Console: https://console.aws.amazon.com/bedrock/
2. Click "Get started" or "Enable Bedrock" if not already enabled
3. Go to "Model access" and request access to "Meta Llama 3.3 70B Instruct"
4. Check IAM permissions - your user needs: bedrock:InvokeModel, bedrock:InvokeModelWithResponseStream
5. Verify the model is available in us-west-2 region

The error suggests AWS credentials lack Bedrock permissions or Bedrock is not enabled in your AWS account.`,
        details: {
          modelId,
          region: 'us-west-2',
          errorCode: (bedrockError as any)?.code,
          errorName: (bedrockError as any)?.name,
          troubleshootingUrl: 'https://console.aws.amazon.com/bedrock/'
        }
      });
    }
  } catch (error) {
    console.error('=== CRITICAL ERROR ===');
    console.error('Unexpected error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code,
      name: (error as any)?.name,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({ 
      error: `Critical error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error instanceof Error ? error.stack : undefined
    });
  }
} 