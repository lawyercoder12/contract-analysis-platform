import { useState, useCallback } from 'react';
import { AnalysisResult } from '../types';

export type AppState = 'needs_model_selection' | 'needs_key' | 'idle' | 'loading' | 'success' | 'multi_success' | 'error';

export interface UseAnalysisStateReturn {
  appState: AppState;
  results: AnalysisResult | null;
  error: string | null;
  fileName: string;
  progressMessage: string | null;
  setAppState: (state: AppState) => void;
  setResults: (results: AnalysisResult | null) => void;
  setError: (error: string | null) => void;
  setFileName: (name: string) => void;
  setProgressMessage: (message: string | null) => void;
  startAnalysis: (fileName: string) => void;
  completeAnalysis: (results: AnalysisResult) => void;
  failAnalysis: (error: string) => void;
  resetToIdle: () => void;
}

export const useAnalysisState = (initialState: AppState = 'needs_model_selection'): UseAnalysisStateReturn => {
  const [appState, setAppState] = useState<AppState>(initialState);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  const startAnalysis = useCallback((fileName: string) => {
    setAppState('loading');
    setResults(null);
    setError(null);
    setFileName(fileName);
    setProgressMessage('Initializing analysis...');
  }, []);

  const completeAnalysis = useCallback((analysisResults: AnalysisResult) => {
    setResults(analysisResults);
    setAppState('success');
    setProgressMessage(null);
  }, []);

  const failAnalysis = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setAppState('error');
    setProgressMessage(null);
  }, []);

  const resetToIdle = useCallback(() => {
    setAppState('idle');
    setResults(null);
    setError(null);
    setFileName('');
    setProgressMessage(null);
  }, []);

  return {
    appState,
    results,
    error,
    fileName,
    progressMessage,
    setAppState,
    setResults,
    setError,
    setFileName,
    setProgressMessage,
    startAnalysis,
    completeAnalysis,
    failAnalysis,
    resetToIdle,
  };
};