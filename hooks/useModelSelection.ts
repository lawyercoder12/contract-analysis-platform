import { useState, useEffect, useCallback } from 'react';
import { ModelProviderId } from '../types';

export interface UseModelSelectionReturn {
  providerId: ModelProviderId | null;
  modelId: string | null;
  apiKey: string | null;
  setProviderId: (id: ModelProviderId | null) => void;
  setModelId: (id: string | null) => void;
  setApiKey: (key: string | null) => void;
  handleModelSelect: (provider: ModelProviderId, model: string) => void;
  clearSelection: () => void;
}

export const useModelSelection = (): UseModelSelectionReturn => {
  const [providerId, setProviderId] = useState<ModelProviderId | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Load from sessionStorage on mount
  useEffect(() => {
    const storedProvider = sessionStorage.getItem('selected_provider') as ModelProviderId | null;
    const storedModel = sessionStorage.getItem('selected_model');
    
    if (storedProvider && storedModel) {
      setProviderId(storedProvider);
      setModelId(storedModel);

      // Try to get API key from environment variables first
      const envKey = storedProvider === 'openai' 
        ? import.meta.env.VITE_OPENAI_API_KEY 
        : import.meta.env.VITE_GEMINI_API_KEY;
      
      if (envKey) {
        setApiKey(envKey);
      } else {
        // Fallback to stored key
        const storedKey = sessionStorage.getItem(`${storedProvider}_api_key`);
        if (storedKey) {
          setApiKey(storedKey);
        }
      }
    }
  }, []);

  const handleModelSelect = useCallback((selectedProvider: ModelProviderId, selectedModel: string) => {
    setProviderId(selectedProvider);
    setModelId(selectedModel);
    sessionStorage.setItem('selected_provider', selectedProvider);
    sessionStorage.setItem('selected_model', selectedModel);
    
    // Try to get API key from environment variables first
    const envKey = selectedProvider === 'openai' 
      ? import.meta.env.VITE_OPENAI_API_KEY 
      : import.meta.env.VITE_GEMINI_API_KEY;
    
    if (envKey) {
      setApiKey(envKey);
    }
  }, []);

  const clearSelection = useCallback(() => {
    sessionStorage.clear();
    setProviderId(null);
    setModelId(null);
    setApiKey(null);
  }, []);

  return {
    providerId,
    modelId,
    apiKey,
    setProviderId,
    setModelId,
    setApiKey,
    handleModelSelect,
    clearSelection,
  };
};