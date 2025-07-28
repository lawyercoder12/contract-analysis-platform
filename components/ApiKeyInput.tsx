import React, { useState } from 'react';
import { KeyIcon, LoadingIcon } from './Icons';
import { Provider } from '../types';

interface ApiKeyInputProps {
  provider: Provider;
  onSubmit: (apiKey: string) => void;
  isLoading: boolean;
  error: string | null;
}

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ provider, onSubmit, isLoading, error }) => {
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onSubmit(apiKey.trim());
    }
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-midnight-light border border-gray-200 dark:border-midnight-lighter rounded-lg p-8 shadow-xl">
        <div className="flex flex-col items-center">
          <div className="bg-teal-100 dark:bg-lilac/20 p-3 rounded-full border border-teal-200 dark:border-lilac/40">
            <KeyIcon className="w-8 h-8 text-teal dark:text-lilac" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-cloud">Enter Your {provider.apiKeyName}</h2>
          <p className="mt-2 text-gray-600 dark:text-cloud/70">
            Your API key is required to analyze documents using the {provider.name} models. It is only stored for your current session.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="relative">
             <input
                id="api-key"
                name="api-key"
                type="password"
                autoComplete="off"
                required
                className="block w-full px-4 py-3 bg-white dark:bg-midnight border border-gray-300 dark:border-midnight-lighter rounded-md shadow-sm placeholder-gray-400 dark:placeholder-cloud/40 text-gray-900 dark:text-cloud focus:outline-none focus:ring-2 focus:ring-teal dark:focus:ring-lilac focus:border-transparent sm:text-sm"
                placeholder={`Enter your ${provider.apiKeyName}`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isLoading}
             />
          </div>
          
          {error && (
             <div className="text-sm text-left text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded-md border border-red-300 dark:border-red-500/50">
                <p className="font-bold text-center mb-2 text-red-800 dark:text-white">Validation Failed</p>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs">{error}</pre>
             </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading || !apiKey.trim()}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal hover:bg-teal-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-midnight focus:ring-teal dark:focus:ring-lilac disabled:bg-gray-300 dark:disabled:bg-midnight-lighter disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <LoadingIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Validating...
                </>
              ) : (
                'Save & Continue'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};