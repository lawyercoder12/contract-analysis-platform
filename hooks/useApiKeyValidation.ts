import { useState, useCallback } from 'react';
import { ModelProviderId } from '../types';
import { validateApiKey } from '../services/contractAnalyzer';

export interface UseApiKeyValidationReturn {
  keyValidationError: string | null;
  isKeyValidating: boolean;
  setKeyValidationError: (error: string | null) => void;
  validateAndStoreKey: (key: string, providerId: ModelProviderId, modelId: string) => Promise<boolean>;
  clearValidationState: () => void;
}

export const useApiKeyValidation = (): UseApiKeyValidationReturn => {
  const [keyValidationError, setKeyValidationError] = useState<string | null>(null);
  const [isKeyValidating, setIsKeyValidating] = useState(false);

  const validateAndStoreKey = useCallback(async (
    key: string, 
    providerId: ModelProviderId, 
    modelId: string
  ): Promise<boolean> => {
    if (!providerId || !modelId) return false;

    setIsKeyValidating(true);
    setKeyValidationError(null);
    
    try {
      await validateApiKey(key, providerId, modelId);
      sessionStorage.setItem(`${providerId}_api_key`, key);
      return true;
    } catch (e) {
      const errorMessage = e instanceof Error 
        ? e.message 
        : 'An unknown error occurred during validation.';
      setKeyValidationError(errorMessage);
      return false;
    } finally {
      setIsKeyValidating(false);
    }
  }, []);

  const clearValidationState = useCallback(() => {
    setKeyValidationError(null);
    setIsKeyValidating(false);
  }, []);

  return {
    keyValidationError,
    isKeyValidating,
    setKeyValidationError,
    validateAndStoreKey,
    clearValidationState,
  };
};