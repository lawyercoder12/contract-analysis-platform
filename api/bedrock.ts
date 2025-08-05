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
    console.log('=== BEDROCK API DIAGNOSTIC TEST STARTED ===');
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    
    const { systemMessage, userMessage } = req.body;

    if (!systemMessage || !userMessage) {
      console.log('Missing parameters:', { systemMessage, userMessage });
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Test 1: Environment Variables Check
    console.log('=== TEST 1: Environment Variables ===');
    const accessKeyId = process.env.VITE_BEDROCK_ACCESS_KEY_ID;
    const secretAccessKey = process.env.VITE_BEDROCK_SECRET_ACCESS_KEY;
    const nodeEnv = process.env.NODE_ENV;
    const vercelEnv = process.env.VERCEL_ENV;

    console.log('Environment check:', { 
      hasAccessKeyId: !!accessKeyId, 
      hasSecretAccessKey: !!secretAccessKey,
      accessKeyIdLength: accessKeyId?.length,
      secretAccessKeyLength: secretAccessKey?.length,
      nodeEnv,
      vercelEnv,
      accessKeyIdPrefix: accessKeyId?.substring(0, 5) + '...',
      secretAccessKeyPrefix: secretAccessKey?.substring(0, 5) + '...'
    });

    if (!accessKeyId || !secretAccessKey) {
      console.log('❌ AWS credentials not configured');
      return res.status(500).json({ error: 'AWS credentials not configured' });
    }

    // Test 2: AWS SDK Version Check
    console.log('=== TEST 2: AWS SDK Version ===');
    try {
      const { version } = require('@aws-sdk/client-bedrock-runtime/package.json');
      console.log('AWS SDK Bedrock Runtime version:', version);
    } catch (e) {
      console.log('Could not determine AWS SDK version:', e);
    }

    // Test 3: Different Regions
    const regions = ['us-west-2', 'us-east-1', 'eu-west-1'];
    
    for (const region of regions) {
      console.log(`=== TEST 3: Testing Region ${region} ===`);
      
      try {
        // Initialize Bedrock client with current region
        const bedrockClient = new BedrockRuntimeClient({
          region: region,
          credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey
          },
          // Add timeout and retry configuration
          maxAttempts: 1,
          requestHandler: {
            httpOptions: {
              timeout: 10000 // 10 seconds
            }
          }
        });

        console.log(`✅ Bedrock client initialized for region: ${region}`);

        // Test 4: Different Models
        const models = [
          "meta.llama3-3-70b-instruct-v1:0",
          "meta.llama3-3-8b-instruct-v1:0", 
          "anthropic.claude-3-sonnet-20240229-v1:0",
          "amazon.titan-text-express-v1"
        ];

        for (const modelId of models) {
          console.log(`=== TEST 4: Testing Model ${modelId} in ${region} ===`);
          
          try {
            // Create a simple test prompt
            const testPrompt = `<|system|>
You are a helpful assistant. Respond with exactly the word "Working" and nothing else.
<|user|>
Just say the word Working
<|assistant|>`;

            const requestBody = {
              prompt: testPrompt,
              max_gen_len: 100,
              temperature: 0.1,
              top_p: 0.9
            };

            console.log(`Sending test request to ${modelId} in ${region}...`);
            console.log('Request body:', JSON.stringify(requestBody, null, 2));

            const command = new InvokeModelCommand({
              modelId: modelId,
              contentType: "application/json",
              body: JSON.stringify(requestBody)
            });

            console.log(`Command created for ${modelId}`);
            
            // Test the actual API call
            const response = await bedrockClient.send(command);
            console.log(`✅ SUCCESS: ${modelId} in ${region} responded!`);
            
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            console.log('Response body:', JSON.stringify(responseBody, null, 2));

            if (responseBody.error) {
              console.log(`❌ Model ${modelId} returned error:`, responseBody.error);
              continue;
            }

            const content = responseBody.generation;
            if (!content) {
              console.log(`❌ Model ${modelId} returned empty response`);
              continue;
            }

            console.log(`✅ Model ${modelId} content:`, content.substring(0, 200));
            
            // If we get here, we found a working model!
            return res.status(200).json({ 
              success: true,
              model: modelId,
              region: region,
              content: content,
              message: "Found working model configuration!"
            });

          } catch (modelError) {
            console.log(`❌ Model ${modelId} in ${region} failed:`, {
              error: modelError instanceof Error ? modelError.message : 'Unknown error',
              code: (modelError as any)?.code,
              name: (modelError as any)?.name,
              stack: modelError instanceof Error ? modelError.stack : undefined
            });
            continue;
          }
        }
      } catch (regionError) {
        console.log(`❌ Region ${region} failed:`, {
          error: regionError instanceof Error ? regionError.message : 'Unknown error',
          code: (regionError as any)?.code,
          name: (regionError as any)?.name,
          stack: regionError instanceof Error ? regionError.stack : undefined
        });
        continue;
      }
    }

    // Test 5: Network Connectivity Test
    console.log('=== TEST 5: Network Connectivity ===');
    try {
      const https = require('https');
      const testUrl = 'https://bedrock-runtime.us-west-2.amazonaws.com';
      
      const testRequest = https.get(testUrl, (response: any) => {
        console.log(`Network test to ${testUrl}:`, response.statusCode);
      });
      
      testRequest.on('error', (error: any) => {
        console.log(`Network test failed:`, error.message);
      });
      
      testRequest.setTimeout(5000, () => {
        console.log('Network test timeout');
        testRequest.destroy();
      });
    } catch (networkError) {
      console.log('Network test error:', networkError);
    }

    // If we get here, no model worked
    console.log('=== ALL TESTS FAILED ===');
    return res.status(500).json({ 
      error: 'All Bedrock models and regions failed. This suggests: 1) AWS credentials lack Bedrock permissions, 2) Bedrock not enabled in AWS account, 3) Network connectivity issues on Vercel, 4) Model access not granted.',
      diagnostic: {
        hasCredentials: !!accessKeyId && !!secretAccessKey,
        regionsTested: regions,
        modelsTested: ["meta.llama3-3-70b-instruct-v1:0", "meta.llama3-3-8b-instruct-v1:0", "anthropic.claude-3-sonnet-20240229-v1:0", "amazon.titan-text-express-v1"],
        environment: { nodeEnv, vercelEnv }
      }
    });

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