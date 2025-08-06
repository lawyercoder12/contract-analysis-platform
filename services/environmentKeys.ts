// Environment-based API key management for Bedrock and WatsonX Llama models
export interface EnvironmentKeys {
  BEDROCK_ACCESS_KEY_ID?: string;
  BEDROCK_SECRET_ACCESS_KEY?: string;
  WATSONX_API_KEY?: string;
  GROQ_API_KEY?: string;
}

// Get environment variables (works in both browser and Node.js environments)
function getEnvironmentVariable(key: string): string | undefined {
  // Check for process.env first (Vite defines these)
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  
  // Fallback to import.meta.env for Vite's default behavior
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key];
  }
  
  return undefined;
}

export function getEnvironmentKeys(): EnvironmentKeys {
  return {
    BEDROCK_ACCESS_KEY_ID: getEnvironmentVariable('VITE_BEDROCK_ACCESS_KEY_ID'),
    BEDROCK_SECRET_ACCESS_KEY: getEnvironmentVariable('VITE_BEDROCK_SECRET_ACCESS_KEY'),
    WATSONX_API_KEY: getEnvironmentVariable('VITE_WATSONX_API_KEY'),
    GROQ_API_KEY: getEnvironmentVariable('VITE_GROQ_API_KEY'),
  };
}

export function hasBedrockCredentials(): boolean {
  const keys = getEnvironmentKeys();
  return !!(keys.BEDROCK_ACCESS_KEY_ID && keys.BEDROCK_SECRET_ACCESS_KEY);
}

export function hasWatsonXCredentials(): boolean {
  const keys = getEnvironmentKeys();
  return !!keys.WATSONX_API_KEY;
}

export function hasGroqCredentials(): boolean {
  const keys = getEnvironmentKeys();
  return !!keys.GROQ_API_KEY;
}

export function getBedrockCredentials(): { accessKeyId: string; secretAccessKey: string } | null {
  const keys = getEnvironmentKeys();
  if (keys.BEDROCK_ACCESS_KEY_ID && keys.BEDROCK_SECRET_ACCESS_KEY) {
    return {
      accessKeyId: keys.BEDROCK_ACCESS_KEY_ID,
      secretAccessKey: keys.BEDROCK_SECRET_ACCESS_KEY,
    };
  }
  return null;
}

export function getWatsonXApiKey(): string | null {
  const keys = getEnvironmentKeys();
  return keys.WATSONX_API_KEY || null;
}

export function getGroqApiKey(): string | null {
  const keys = getEnvironmentKeys();
  return keys.GROQ_API_KEY || null;
}

// Check if a model can use environment variables instead of user API key
export function canUseEnvironmentKey(providerId: string, modelId: string): boolean {
  if (providerId === 'openai' && modelId === 'gpt-oss-120b-groq') {
    return hasGroqCredentials();
  }
  if (providerId === 'llama') {
    if (modelId === 'llama-3.3-70b-bedrock') {
      return hasBedrockCredentials();
    }
    if (modelId === 'llama-3.3-70b-watsonx') {
      return hasWatsonXCredentials();
    }
    if (modelId === 'llama-3.3-70b-versatile') {
      return hasGroqCredentials();
    }
  }
  return false;
}

// Get the appropriate API key for a model (environment or user-provided)
export function getApiKeyForModel(
  providerId: string, 
  modelId: string, 
  userApiKey?: string
): string | null {
  if (canUseEnvironmentKey(providerId, modelId)) {
    if (providerId === 'openai' && modelId === 'gpt-oss-120b-groq') {
      return getGroqApiKey();
    }
    if (providerId === 'llama') {
      if (modelId === 'llama-3.3-70b-bedrock') {
        const credentials = getBedrockCredentials();
        return credentials ? `${credentials.accessKeyId}|${credentials.secretAccessKey}` : null;
      }
      if (modelId === 'llama-3.3-70b-watsonx') {
        return getWatsonXApiKey();
      }
      if (modelId === 'llama-3.3-70b-versatile') {
        return getGroqApiKey();
      }
    }
  }
  
  return userApiKey || null;
} 