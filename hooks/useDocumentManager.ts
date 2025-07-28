import { useState, useCallback } from 'react';
import { DocumentMetadata, AnalysisResult, MultiDocumentAnalysisResult } from '../types';

export const useDocumentManager = () => {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [results, setResults] = useState<Map<string, AnalysisResult>>(new Map());
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  const addDocuments = useCallback((files: File[]): string[] => {
    const newDocuments: DocumentMetadata[] = [];
    const newDocumentIds: string[] = [];

    files.forEach(file => {
      const id = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const document: DocumentMetadata = {
        id,
        name: file.name,
        size: file.size,
        uploadedAt: new Date(),
        status: 'pending'
      };
      newDocuments.push(document);
      newDocumentIds.push(id);
    });

    setDocuments(prev => [...prev, ...newDocuments]);
    
    // Set first document as active if none is currently active
    if (activeDocumentId === null && newDocuments.length > 0) {
      setActiveDocumentId(newDocuments[0].id);
    }

    return newDocumentIds;
  }, [activeDocumentId]);

  const updateDocumentStatus = useCallback((documentId: string, status: DocumentMetadata['status'], progress?: string, error?: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === documentId 
        ? { ...doc, status, progress, error }
        : doc
    ));
  }, []);

  const removeDocument = useCallback((documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    setResults(prev => {
      const newResults = new Map(prev);
      newResults.delete(documentId);
      return newResults;
    });
    
    // Update active document if removed document was active
    if (activeDocumentId === documentId) {
      const remainingDocs = documents.filter(doc => doc.id !== documentId);
      setActiveDocumentId(remainingDocs.length > 0 ? remainingDocs[0].id : null);
    }
  }, [documents, activeDocumentId]);

  const setAnalysisResult = useCallback((documentId: string, result: AnalysisResult) => {
    setResults(prev => new Map(prev).set(documentId, result));
    updateDocumentStatus(documentId, 'completed');
  }, [updateDocumentStatus]);

  const setAnalysisError = useCallback((documentId: string, error: string) => {
    updateDocumentStatus(documentId, 'error', undefined, error);
  }, [updateDocumentStatus]);

  const retryAnalysis = useCallback((documentId: string) => {
    updateDocumentStatus(documentId, 'pending');
  }, [updateDocumentStatus]);

  const getAnalysisResult = useCallback((documentId: string): AnalysisResult | undefined => {
    return results.get(documentId);
  }, [results]);

  const getActiveResult = useCallback((): AnalysisResult | undefined => {
    return activeDocumentId ? results.get(activeDocumentId) : undefined;
  }, [activeDocumentId, results]);

  const getAllResults = useCallback((): MultiDocumentAnalysisResult => {
    return {
      documents,
      results,
      activeDocumentId
    };
  }, [documents, results, activeDocumentId]);

  const hasCompletedDocuments = useCallback((): boolean => {
    return documents.some(doc => doc.status === 'completed' && results.has(doc.id));
  }, [documents, results]);

  const getCompletedDocuments = useCallback((): DocumentMetadata[] => {
    return documents.filter(doc => doc.status === 'completed' && results.has(doc.id));
  }, [documents, results]);

  const getTotalAnalysisProgress = useCallback((): { completed: number; total: number; percentage: number } => {
    const total = documents.length;
    const completed = documents.filter(doc => doc.status === 'completed').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  }, [documents]);

  const clearAllDocuments = useCallback(() => {
    setDocuments([]);
    setResults(new Map());
    setActiveDocumentId(null);
  }, []);

  return {
    // State
    documents,
    results,
    activeDocumentId,
    
    // Actions
    addDocuments,
    removeDocument,
    updateDocumentStatus,
    setAnalysisResult,
    setAnalysisError,
    retryAnalysis,
    setActiveDocumentId,
    clearAllDocuments,
    
    // Getters
    getAnalysisResult,
    getActiveResult,
    getAllResults,
    hasCompletedDocuments,
    getCompletedDocuments,
    getTotalAnalysisProgress
  };
};

export default useDocumentManager;