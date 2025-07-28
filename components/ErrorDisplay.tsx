import React from 'react';
import { ErrorIcon } from './Icons';

interface ErrorDisplayProps {
  message: string | null;
  onReset: () => void;
  onKeyReset: () => void;
  onFullReset: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, onReset, onKeyReset, onFullReset }) => {
    const isAuthError = message?.toLowerCase().includes('api key') || message?.toLowerCase().includes('quota') || message?.toLowerCase().includes('authentication');
    
    return (
      <div className="flex-grow flex flex-col items-center justify-center text-center p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/50 rounded-lg">
        <ErrorIcon className="w-16 h-16 text-red-500 dark:text-red-400" />
        <h3 className="mt-4 text-xl font-bold text-red-900 dark:text-white">Analysis Failed</h3>
        <div className="mt-2 max-w-lg text-left text-red-700 dark:text-red-200 bg-red-100/50 dark:bg-red-900/30 p-4 rounded-md border border-red-200 dark:border-red-500/50">
          <pre className="whitespace-pre-wrap break-words font-sans text-sm">
            {message || 'An unknown error occurred.'}
          </pre>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row gap-4">
             <button
              onClick={onReset}
              className="px-5 py-2.5 bg-gray-200 text-gray-800 dark:bg-midnight-lighter dark:text-cloud font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-midnight-light transition-colors"
            >
              Try Again
            </button>
            {isAuthError && (
                 <button
                  onClick={onKeyReset}
                  className="px-5 py-2.5 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 dark:bg-red-600/50 dark:text-red-100 dark:hover:bg-red-600/80 transition-colors"
                >
                  Enter New API Key
                </button>
            )}
             <button
              onClick={onFullReset}
              className="px-5 py-2.5 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 transition-colors"
            >
              Change Model
            </button>
        </div>
      </div>
    );
}