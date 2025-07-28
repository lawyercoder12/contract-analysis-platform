import { useCallback, useState } from 'react';
import { ContractAnalyzer } from '../services/contractAnalyzer';
import { ModelProviderId } from '../types';

interface BatchAnalysisHook {
  isAnalyzing: boolean;
  analyzeDocuments: (
    files: File[],
    documentIds: string[],
    apiKey: string,
    provider: ModelProviderId,
    model: string,
    onDocumentProgress: (documentId: string, message: string) => void,
    onDocumentComplete: (documentId: string, result: any) => void,
    onDocumentError: (documentId: string, error: string) => void,
    onBatchComplete: () => void
  ) => Promise<void>;
  cancelAnalysis: () => void;
}

export const useBatchAnalysis = (): BatchAnalysisHook => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [shouldCancel, setShouldCancel] = useState(false);

  const analyzeDocuments = useCallback(async (
    files: File[],
    documentIds: string[],
    apiKey: string,
    provider: ModelProviderId,
    model: string,
    onDocumentProgress: (documentId: string, message: string) => void,
    onDocumentComplete: (documentId: string, result: any) => void,
    onDocumentError: (documentId: string, error: string) => void,
    onBatchComplete: () => void
  ) => {
    if (files.length !== documentIds.length) {
      throw new Error('Files and document IDs arrays must have the same length');
    }

    setIsAnalyzing(true);
    setShouldCancel(false);

    try {
      const analyzer = new ContractAnalyzer(apiKey, provider, model);

      // Process documents sequentially to avoid overwhelming the API
      for (let i = 0; i < files.length; i++) {
        if (shouldCancel) {
          break;
        }

        const file = files[i];
        const documentId = documentIds[i];

        try {
          onDocumentProgress(documentId, 'Starting analysis...');
          
          const result = await analyzer.analyzeContract(
            file,
            documentId,
            (message: string) => onDocumentProgress(documentId, message)
          );

          if (!shouldCancel) {
            onDocumentComplete(documentId, result);
          }
        } catch (error) {
          if (!shouldCancel) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            onDocumentError(documentId, errorMessage);
          }
        }
      }

      if (!shouldCancel) {
        onBatchComplete();
      }
    } finally {
      setIsAnalyzing(false);
      setShouldCancel(false);
    }
  }, [shouldCancel]);

  const cancelAnalysis = useCallback(() => {
    setShouldCancel(true);
  }, []);

  return {
    isAnalyzing,
    analyzeDocuments,
    cancelAnalysis
  };
};

export default useBatchAnalysis;