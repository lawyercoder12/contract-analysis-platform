import React, { useCallback, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { ResultsDisplay } from './components/ResultsDisplay';
import { Loader } from './components/Loader';
import { ContractAnalyzer, AnalysisError } from './services/contractAnalyzer';
import { ModelProviderId } from './types';
import { Header } from './components/Header';
import { ErrorDisplay } from './components/ErrorDisplay';
import { WelcomeSplash } from './components/WelcomeSplash';
import { ApiKeyInput } from './components/ApiKeyInput';
import { ModelSelector } from './components/ModelSelector';
import { MODELS_CONFIG } from './config/models';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useModelSelection } from './hooks/useModelSelection';
import { useAnalysisState } from './hooks/useAnalysisState';
import { useApiKeyValidation } from './hooks/useApiKeyValidation';

const App: React.FC = () => {
  const { 
    providerId, 
    modelId, 
    apiKey, 
    setApiKey,
    handleModelSelect: modelSelectHandler,
    clearSelection 
  } = useModelSelection();
  
  const {
    appState,
    results,
    error,
    fileName,
    progressMessage,
    setAppState,
    setProgressMessage,
    startAnalysis,
    completeAnalysis,
    failAnalysis,
    resetToIdle
  } = useAnalysisState('needs_model_selection');
  
  const {
    keyValidationError,
    isKeyValidating,
    validateAndStoreKey,
    clearValidationState
  } = useApiKeyValidation();

  // Update app state based on model selection state
  useEffect(() => {
    if (!providerId || !modelId) {
      setAppState('needs_model_selection');
    } else if (!apiKey) {
      setAppState('needs_key');
    } else {
      setAppState('idle');
    }
  }, [providerId, modelId, apiKey, setAppState]);
  
  const handleModelSelect = useCallback((selectedProvider: ModelProviderId, selectedModel: string) => {
    modelSelectHandler(selectedProvider, selectedModel);
  }, [modelSelectHandler]);

  const handleKeySubmit = useCallback(async (key: string) => {
    if (!providerId || !modelId) return;

    const isValid = await validateAndStoreKey(key, providerId, modelId);
    if (isValid) {
      setApiKey(key);
    }
  }, [providerId, modelId, validateAndStoreKey, setApiKey]);

  const handleFileAnalysis = useCallback(async (file: File) => {
    if (!file || !apiKey || !providerId || !modelId) return;

    startAnalysis(file.name);

    try {
      const analyzer = new ContractAnalyzer(apiKey, providerId, modelId);
      const analysisResults = await analyzer.analyzeContract(file, setProgressMessage);
      completeAnalysis(analysisResults);
    } catch (e) {
      console.error(e);
      let errorMessage = 'An unknown error occurred during analysis.';
      
      if (e instanceof AnalysisError) {
        errorMessage = e.message;
      } else if (e instanceof Error) {
        errorMessage = `An unexpected error occurred: ${e.message}`;
      }
      
      failAnalysis(errorMessage);
    }
  }, [apiKey, providerId, modelId, startAnalysis, completeAnalysis, failAnalysis, setProgressMessage]);

  const handleIdleReset = useCallback(() => {
    resetToIdle();
  }, [resetToIdle]);
  
  const handleFullReset = useCallback(() => {
    clearSelection();
    resetToIdle();
    clearValidationState();
  }, [clearSelection, resetToIdle, clearValidationState]);
  
  const handleKeyReset = useCallback(() => {
    if(providerId) {
      sessionStorage.removeItem(`${providerId}_api_key`);
    }
    setApiKey(null);
    clearValidationState();
  }, [providerId, setApiKey, clearValidationState]);

  const renderContent = () => {
    const providerConfig = MODELS_CONFIG.find(p => p.id === providerId);
    
    switch (appState) {
      case 'needs_model_selection':
        return <ModelSelector onModelSelect={handleModelSelect} />;
      case 'needs_key':
        return providerConfig ? <ApiKeyInput provider={providerConfig} onSubmit={handleKeySubmit} error={keyValidationError} isLoading={isKeyValidating} /> : <ModelSelector onModelSelect={handleModelSelect} />;
      case 'loading':
        return <Loader message={`Analyzing "${fileName}"...`} progress={progressMessage} />;
      case 'success':
        return results && <ResultsDisplay results={results} fileName={fileName} onReset={handleIdleReset} onFullReset={handleFullReset} />;
      case 'error':
        return <ErrorDisplay message={error} onReset={handleIdleReset} onKeyReset={handleKeyReset} onFullReset={handleFullReset} />;
      case 'idle':
      default:
        return (
          <WelcomeSplash>
             <FileUpload onFileUpload={handleFileAnalysis} />
          </WelcomeSplash>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-midnight text-gray-900 dark:text-cloud flex flex-col">
      <ErrorBoundary>
        <Header />
      </ErrorBoundary>
      <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col">
        <ErrorBoundary>
          {renderContent()}
        </ErrorBoundary>
      </main>
    </div>
  );
};

export default App;