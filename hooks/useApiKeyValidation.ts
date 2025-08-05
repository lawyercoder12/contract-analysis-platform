import { useState, useCallback } from 'react';
import { ModelProviderId } from '../types';
import { validateApiKey } from '../services/contractAnalyzer';
import { canUseEnvironmentKey, getApiKeyForModel } from '../services/environmentKeys';

export interface UseApiKeyValidationReturn {
  keyValidationError: string | null;
  isKeyValidating: boolean;
  setKeyValidationError: (error: string | null) => void;
  validateAndStoreKey: (key: string, providerId: ModelProviderId, modelId: string) => Promise<boolean>;
  clearValidationState: () => void;
  canUseEnvironmentKey: (providerId: ModelProviderId, modelId: string) => boolean;
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
      // Check if we can use environment variables for this model
      if (canUseEnvironmentKey(providerId, modelId)) {
        const envApiKey = getApiKeyForModel(providerId, modelId);
        if (envApiKey) {
          await validateApiKey(envApiKey, providerId, modelId);
          // Store a flag indicating we're using environment variables
          sessionStorage.setItem(`${providerId}_env_key`, 'true');
          return true;
        } else {
          setKeyValidationError('Environment variables not configured for this model.');
          return false;
        }
      } else {
        // Use user-provided API key
        await validateApiKey(key, providerId, modelId);
        sessionStorage.setItem(`${providerId}_api_key`, key);
        return true;
      }
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

  const canUseEnvironmentKeyForModel = useCallback((providerId: ModelProviderId, modelId: string): boolean => {
    return canUseEnvironmentKey(providerId, modelId);
  }, []);

  return {
    keyValidationError,
    isKeyValidating,
    setKeyValidationError,
    validateAndStoreKey,
    clearValidationState,
    canUseEnvironmentKey: canUseEnvironmentKeyForModel,
  };
};