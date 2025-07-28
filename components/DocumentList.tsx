import React from 'react';
import { DocumentMetadata } from '../types';

interface DocumentListProps {
  documents: DocumentMetadata[];
  activeDocumentId?: string | null;
  onSetActiveDocument?: (documentId: string) => void;
  onRemoveDocument?: (documentId: string) => void;
  onRetryAnalysis?: (documentId: string) => void;
  className?: string;
  showActiveSelection?: boolean;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  activeDocumentId,
  onSetActiveDocument,
  onRemoveDocument,
  onRetryAnalysis,
  className = "",
  showActiveSelection = false
}) => {
  if (documents.length === 0) {
    return null;
  }

  const getStatusIcon = (status: DocumentMetadata['status']) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'analyzing':
        return '🔄';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '📄';
    }
  };

  const getStatusColor = (status: DocumentMetadata['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-600 dark:text-gray-400';
      case 'analyzing':
        return 'text-blue-600 dark:text-blue-400';
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Uploaded Documents ({documents.length})
      </h3>
      
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {documents.map((doc) => {
          const isActive = showActiveSelection && activeDocumentId === doc.id;
          const isClickable = showActiveSelection && doc.status === 'completed' && onSetActiveDocument;
          
          return (
            <div
              key={doc.id}
              onClick={() => isClickable ? onSetActiveDocument(doc.id) : undefined}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                isActive 
                  ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-300 dark:border-teal-700 ring-2 ring-teal-200 dark:ring-teal-800'
                  : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
              } ${
                isClickable 
                  ? 'hover:shadow-md hover:border-teal-200 dark:hover:border-teal-700 cursor-pointer'
                  : 'hover:shadow-sm'
              }`}
            >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {showActiveSelection && doc.status === 'completed' ? (
                <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors">
                  {isActive ? (
                    <div className="w-3 h-3 bg-teal-500 rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    </div>
                  ) : (
                    <div className={`w-3 h-3 rounded-full border border-gray-300 dark:border-gray-600 ${isClickable ? 'hover:border-teal-400' : ''}`}></div>
                  )}
                </div>
              ) : (
                <span className="text-lg" title={`Status: ${doc.status}`}>
                  {getStatusIcon(doc.status)}
                </span>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className={`text-sm font-medium truncate ${
                    isActive 
                      ? 'text-teal-900 dark:text-teal-100'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {doc.name}
                  </p>
                  {isActive && showActiveSelection && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200">
                      Active
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{formatFileSize(doc.size)}</span>
                  <span>•</span>
                  <span className={getStatusColor(doc.status)}>
                    {doc.status === 'analyzing' && doc.progress 
                      ? doc.progress 
                      : doc.status.charAt(0).toUpperCase() + doc.status.slice(1)
                    }
                  </span>
                </div>
                {doc.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">
                    {doc.error}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 ml-3">
              {doc.status === 'error' && onRetryAnalysis && (
                <button
                  onClick={() => onRetryAnalysis(doc.id)}
                  className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  title="Retry analysis"
                >
                  Retry
                </button>
              )}
              
              {onRemoveDocument && (
                <button
                  onClick={() => onRemoveDocument(doc.id)}
                  className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  title="Remove document"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};