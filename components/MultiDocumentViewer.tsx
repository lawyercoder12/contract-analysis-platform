import React, { useState, useMemo } from 'react';
import { DocumentViewer } from './DocumentViewer';
import { DocumentMetadata, AnalysisResult, DocumentTab } from '../types';
import { XIcon, SplitScreenIcon, MaximizeIcon } from './Icons';

interface MultiDocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentMetadata[];
  results: Map<string, AnalysisResult>;
  activeDocumentId: string | null;
  onSetActiveDocument: (documentId: string) => void;
  targetParagraphId: string | null;
  viewTrigger: number;
  viewMode?: 'modal' | 'inline' | 'inline-content-only';
  onToggleSplitView?: () => void;
  onGoToModalView?: () => void;
}

export const MultiDocumentViewer: React.FC<MultiDocumentViewerProps> = ({
  isOpen,
  onClose,
  documents,
  results,
  activeDocumentId,
  onSetActiveDocument,
  targetParagraphId,
  viewTrigger,
  viewMode = 'modal',
  onToggleSplitView,
  onGoToModalView
}) => {
  const documentTabs = useMemo((): DocumentTab[] => {
    return documents
      .filter(doc => doc.status === 'completed')
      .map(doc => ({
        id: doc.id,
        name: doc.name,
        status: doc.status,
        hasResults: results.has(doc.id)
      }));
  }, [documents, results]);

  const activeResult = useMemo(() => {
    return activeDocumentId ? results.get(activeDocumentId) : undefined;
  }, [activeDocumentId, results]);

  const activeDocument = useMemo(() => {
    return documents.find(doc => doc.id === activeDocumentId);
  }, [documents, activeDocumentId]);

  if (!isOpen || documentTabs.length === 0) {
    return null;
  }

  // If no active document or active document doesn't have results, set first available
  if (!activeDocumentId || !results.has(activeDocumentId)) {
    const firstAvailable = documentTabs.find(tab => tab.hasResults);
    if (firstAvailable && firstAvailable.id !== activeDocumentId) {
      onSetActiveDocument(firstAvailable.id);
      return null; // Will re-render with correct active document
    }
  }

  if (!activeResult) {
    return null;
  }

  const TabButton: React.FC<{ tab: DocumentTab; isActive: boolean }> = ({ tab, isActive }) => {
    const truncatedName = tab.name.length > 20 ? `${tab.name.substring(0, 20)}...` : tab.name;
    
    return (
      <button
        onClick={() => onSetActiveDocument(tab.id)}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors duration-200 ${
          isActive
            ? 'bg-white dark:bg-midnight-light text-teal dark:text-lilac border-teal dark:border-lilac'
            : 'bg-gray-100 dark:bg-midnight-lighter text-gray-600 dark:text-cloud/60 border-transparent hover:text-gray-800 dark:hover:text-cloud hover:bg-gray-200 dark:hover:bg-midnight'
        }`}
        title={tab.name}
      >
        {truncatedName}
      </button>
    );
  };

  const TabBar: React.FC = () => (
    <div className="flex items-center space-x-1 bg-gray-50 dark:bg-midnight border-b border-gray-200 dark:border-midnight-lighter px-4 pt-2">
      <div className="flex space-x-1 overflow-x-auto scrollbar-thin scrollbar-track-gray-100 dark:scrollbar-track-midnight scrollbar-thumb-gray-300 dark:scrollbar-thumb-midnight-lighter">
        {documentTabs.map(tab => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeDocumentId}
          />
        ))}
      </div>
      {documentTabs.length > 1 && (
        <div className="text-xs text-gray-500 dark:text-cloud/60 ml-4 whitespace-nowrap">
          {documentTabs.findIndex(tab => tab.id === activeDocumentId) + 1} of {documentTabs.length}
        </div>
      )}
    </div>
  );

  const mainContent = (
    <>
      <TabBar />
      <DocumentViewer
        isOpen={true}
        onClose={() => {}} // Handled by parent
        paragraphs={activeResult.paragraphs}
        definitions={activeResult.definitions}
        usages={activeResult.usages}
        suggestions={activeResult.suggestions}
        crossReferences={activeResult.crossReferences}
        targetParagraphId={targetParagraphId}
        maxLevel={activeResult.maxLevel}
        viewTrigger={viewTrigger}
        viewMode="inline-content-only"
      />
    </>
  );

  if (viewMode === 'inline-content-only') {
    return <div className="h-full flex flex-col">{mainContent}</div>;
  }

  const fullHeader = (
    <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-midnight-lighter flex-shrink-0">
      <div className="flex items-center space-x-3">
        <h2 id="multi-document-viewer-title" className="text-xl font-bold text-gray-900 dark:text-cloud">
          Document Viewer
        </h2>
        {activeDocument && (
          <span className="text-sm text-gray-500 dark:text-cloud/60 bg-gray-100 dark:bg-midnight-lighter px-2 py-1 rounded">
            {activeDocument.name}
          </span>
        )}
      </div>
      <div className="flex items-center space-x-2">
        {viewMode === 'inline' && onGoToModalView && (
          <button 
            onClick={onGoToModalView} 
            className="p-2 rounded-md transition-colors bg-gray-100 dark:bg-midnight-lighter text-gray-800 dark:text-cloud hover:bg-gray-200 dark:hover:bg-midnight-light" 
            title="Switch to Focused View" 
            aria-label="Switch to Focused View"
          >
            <MaximizeIcon className="h-5 w-5" />
          </button>
        )}
        {viewMode === 'modal' && onToggleSplitView && (
          <button 
            onClick={onToggleSplitView} 
            className="p-2 rounded-md transition-colors bg-gray-100 dark:bg-midnight-lighter text-gray-800 dark:text-cloud hover:bg-gray-200 dark:hover:bg-midnight-light" 
            title="Switch to Split View" 
            aria-label="Switch to Split View"
          >
            <SplitScreenIcon className="h-5 w-5" />
          </button>
        )}
        <button 
          onClick={onClose} 
          className="text-gray-500 dark:text-cloud/60 hover:text-gray-800 dark:hover:text-cloud transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-midnight-lighter"
        >
          <XIcon className="w-6 h-6" />
          <span className="sr-only">Close document viewer</span>
        </button>
      </div>
    </header>
  );

  if (viewMode === 'modal') {
    return (
      <div 
        className="fixed inset-0 bg-gray-900/60 dark:bg-midnight/80 backdrop-blur-sm z-40 flex items-center justify-center p-4 animate-fade-in"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="multi-document-viewer-title"
      >
        <style>{`
          .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
        <div 
          className="bg-white dark:bg-midnight-light border border-gray-200 dark:border-midnight-lighter rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {fullHeader}
          {mainContent}
        </div>
      </div>
    );
  }
  
  // Inline view
  return (
    <div className="h-full bg-white dark:bg-midnight-light border border-gray-200 dark:border-midnight-lighter rounded-lg shadow-xl overflow-hidden flex flex-col">
      {fullHeader}
      {mainContent}
    </div>
  );
};