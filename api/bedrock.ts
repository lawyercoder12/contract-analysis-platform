import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple test function to check if the API route is accessible
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { systemMessage, userMessage } = req.body;

    if (!systemMessage || !userMessage) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // For now, just return a test response to see if the API route is working
    return res.status(200).json({ 
      message: 'API route is working',
      systemMessage,
      userMessage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    });
  }
} 