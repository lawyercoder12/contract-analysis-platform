import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { DocumentMetadata, AnalysisResult, GroupedDefinition, UndefinedTermGroup, SummaryCounts, IssueType, Classification, Usage, Definition, Suggestion, CrossReference } from '../types';
import { DefinitionsTable } from './DefinitionsTable';
import { UndefinedTable } from './UndefinedTable';
import { SuggestionsTable } from './SuggestionsTable';
import { CrossReferencesTable } from './CrossReferencesTable';
import { NumberingTable } from './NumberingTable';
import { UsagePanel } from './UsagePanel';
import { SummaryChips } from './SummaryChips';
import { DocumentIcon, SplitScreenIcon, XIcon, MaximizeIcon, FolderIcon } from './Icons';
import { MultiDocumentViewer } from './MultiDocumentViewer';
import { DocumentList } from './DocumentList';
import { EmptyState } from './EmptyState';
import { ErrorBoundary } from './ErrorBoundary';

interface MultiDocumentResultsDisplayProps {
  documents: DocumentMetadata[];
  results: Map<string, AnalysisResult>;
  activeDocumentId: string | null;
  onSetActiveDocument: (documentId: string) => void;
  onRemoveDocument: (documentId: string) => void;
  onRetryAnalysis: (documentId: string) => void;
  onReset: () => void;
  onFullReset: () => void;
}

type Tab = 'definitions' | 'undefined' | 'suggestions' | 'cross-references' | 'numbering';
type ViewScope = 'active' | 'all';

export const MultiDocumentResultsDisplay: React.FC<MultiDocumentResultsDisplayProps> = ({
  documents,
  results,
  activeDocumentId,
  onSetActiveDocument,
  onRemoveDocument,
  onRetryAnalysis,
  onReset,
  onFullReset
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('definitions');
  const [viewScope, setViewScope] = useState<ViewScope>('active');
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<IssueType[]>([]);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerTarget, setViewerTarget] = useState<string | null>(null);
  const [isSplitView, setIsSplitView] = useState(false);
  const [viewTrigger, setViewTrigger] = useState(0);
  const [pendingParagraphId, setPendingParagraphId] = useState<string | null>(null);
  const [showDocumentList, setShowDocumentList] = useState(false);

  const completedDocuments = useMemo(() => {
    return documents.filter(doc => doc.status === 'completed' && results.has(doc.id));
  }, [documents, results]);

  const activeResult = useMemo(() => {
    return activeDocumentId ? results.get(activeDocumentId) : undefined;
  }, [activeDocumentId, results]);

  const activeDocument = useMemo(() => {
    return documents.find(doc => doc.id === activeDocumentId);
  }, [documents, activeDocumentId]);

  // Combine results from all documents or just active document based on viewScope
  const combinedResults = useMemo(() => {
    if (viewScope === 'active' && activeResult) {
      return activeResult;
    }

    if (viewScope === 'all') {
      const allResults = Array.from(results.values());
      if (allResults.length === 0) return null;

      return {
        paragraphs: allResults.flatMap(r => r.paragraphs),
        definitions: allResults.flatMap(r => r.definitions),
        usages: allResults.flatMap(r => r.usages),
        suggestions: allResults.flatMap(r => r.suggestions),
        crossReferences: allResults.flatMap(r => r.crossReferences),
        numberingDiscrepancies: allResults.flatMap(r => r.numberingDiscrepancies),
        maxLevel: Math.max(...allResults.map(r => r.maxLevel), 0),
        documentId: 'combined' // Special ID for combined view
      };
    }

    return null;
  }, [viewScope, activeResult, results]);

  const { groupedDefinitions, undefinedTermGroups, summaryCounts } = useMemo(() => {
    if (!combinedResults) {
      return {
        groupedDefinitions: [],
        undefinedTermGroups: [],
        summaryCounts: {
          definitions: 0,
          undefinedTerms: 0,
          suggestions: 0,
          crossReferences: 0,
          numberingDiscrepancies: 0,
          issues: {} as Record<IssueType, number>,
          totalIssues: 0,
          documentsAnalyzed: completedDocuments.length
        }
      };
    }

    // Group definitions by canonical term
    const defMap = new Map<string, Definition[]>();
    combinedResults.definitions.forEach(def => {
      const existing = defMap.get(def.term_canonical) || [];
      defMap.set(def.term_canonical, [...existing, def]);
    });

    const groupedDefs: GroupedDefinition[] = Array.from(defMap.entries()).map(([canonical, allDefs]) => {
      const allUsages = combinedResults.usages.filter(u => u.canonical === canonical);
      const issues = new Set<IssueType>();
      allDefs.forEach(d => d.issues.forEach(i => issues.add(i)));
      allUsages.forEach(u => u.issues.forEach(i => issues.add(i)));
      
      // Track which documents this term appears in
      const documentIds = Array.from(new Set([
        ...allDefs.map(d => d.documentId),
        ...allUsages.map(u => u.documentId)
      ]));
      
      return {
        canonical,
        allDefs,
        allUsages,
        issues: Array.from(issues),
        documentIds
      };
    });

    // Group undefined usages by token
    const undefinedUsages = combinedResults.usages.filter(u => u.classification === Classification.Undefined);
    const undefinedMap = new Map<string, Usage[]>();
    undefinedUsages.forEach(usage => {
      const existing = undefinedMap.get(usage.token) || [];
      undefinedMap.set(usage.token, [...existing, usage]);
    });

    const undefinedGroups: UndefinedTermGroup[] = Array.from(undefinedMap.entries()).map(([token, usages]) => {
      const issues = new Set<IssueType>();
      usages.forEach(u => u.issues.forEach(i => issues.add(i)));
      
      // Track which documents this term appears in
      const documentIds = Array.from(new Set(usages.map(u => u.documentId)));
      
      return {
        token,
        usages,
        issues: Array.from(issues),
        documentIds
      };
    });

    // Calculate summary
    const issueCounts = {} as Record<IssueType, number>;
    const allIssues = [...groupedDefs.flatMap(g => g.issues), ...undefinedGroups.flatMap(g => g.issues)];
    
    for (const issue of Object.values(IssueType)) {
      issueCounts[issue] = allIssues.filter(i => i === issue).length;
    }

    const totalIssues = Object.values(issueCounts).reduce((a, b) => a + b, 0);

    const summary: SummaryCounts = {
      definitions: groupedDefs.length,
      undefinedTerms: undefinedGroups.length,
      suggestions: combinedResults.suggestions.length,
      crossReferences: combinedResults.crossReferences.length,
      numberingDiscrepancies: combinedResults.numberingDiscrepancies.length,
      issues: issueCounts,
      totalIssues: totalIssues,
      documentsAnalyzed: completedDocuments.length
    };

    return { groupedDefinitions: groupedDefs, undefinedTermGroups: undefinedGroups, summaryCounts: summary };
  }, [combinedResults, completedDocuments.length]);

  const handleFilterToggle = useCallback((issue: IssueType) => {
    setActiveFilters(prev => 
      prev.includes(issue) ? prev.filter(i => i !== issue) : [...prev, issue]
    );
  }, []);

  const filteredDefinitions = useMemo(() => {
    if (activeFilters.length === 0) return groupedDefinitions;
    return groupedDefinitions.filter(g => activeFilters.some(f => g.issues.includes(f)));
  }, [groupedDefinitions, activeFilters]);

  const filteredUndefinedTerms = useMemo(() => {
    if (activeFilters.length === 0) return undefinedTermGroups;
    return undefinedTermGroups.filter(g => activeFilters.some(f => g.issues.includes(f)));
  }, [undefinedTermGroups, activeFilters]);

  const handleSelectTerm = (term: string | null) => {
    if (term === selectedTerm) {
      setSelectedTerm(null);
    } else {
      setSelectedTerm(term);
      if (isSplitView && combinedResults) {
        const def = combinedResults.definitions.find(d => d.term_canonical === term || d.term_raw === term);
        if (def) {
          handleViewParagraph(def.paragraphId, def.documentId);
        }
      }
    }
  };

  const handleViewParagraph = useCallback((paragraphId: string | null, documentId?: string) => {
    console.log('🔥 handleViewParagraph CALLED with paragraphId:', paragraphId, 'documentId:', documentId);
    console.log('=== handleViewParagraph DEBUG ===');
    console.log('paragraphId:', paragraphId);
    console.log('documentId:', documentId);
    console.log('viewScope:', viewScope);
    console.log('activeDocumentId:', activeDocumentId);
    console.log('completedDocuments:', completedDocuments.map(d => ({ id: d.id, name: d.name })));
    
    if (!paragraphId) {
      console.log('No paragraphId, clearing viewer');
      setPendingParagraphId(null);
      setViewerTarget(paragraphId);
      setViewTrigger(v => v + 1);
      if (!isSplitView) {
        setIsViewerOpen(true);
      }
      return;
    }

    // Determine target document ID
    let targetDocumentId: string | null = null;
    
    if (documentId) {
      // If documentId is provided directly, use it
      targetDocumentId = documentId;
      console.log('Using provided documentId:', targetDocumentId);
    } else {
      // Fallback to old logic for backward compatibility
      if (viewScope === 'active' && activeResult) {
        // In active view, check if paragraph exists in active document
        const paragraphExists = activeResult.paragraphs.some(p => p.id === paragraphId);
        console.log('Active view - paragraphExists:', paragraphExists);
        if (paragraphExists) {
          targetDocumentId = activeDocumentId;
        }
      } else if (viewScope === 'all') {
        // In all documents view, find which document contains this paragraph
        for (const doc of completedDocuments) {
          const result = results.get(doc.id);
          const paragraphExists = result?.paragraphs.some(p => p.id === paragraphId);
          console.log(`Checking doc ${doc.id}: paragraphExists = ${paragraphExists}`);
          if (paragraphExists) {
            targetDocumentId = doc.id;
            console.log('Found paragraph in document:', doc.id);
            break;
          }
        }
      }
    }
    
    console.log('targetDocumentId:', targetDocumentId);
    console.log('current activeDocumentId:', activeDocumentId);
    
    // If we need to switch documents
    if (targetDocumentId && targetDocumentId !== activeDocumentId) {
      console.log('Switching to document:', targetDocumentId);
      // Store the paragraph ID to be handled after document switch
      setPendingParagraphId(paragraphId);
      onSetActiveDocument(targetDocumentId);
    } else {
      console.log('No document switch needed or targetDocumentId not found');
      // No document switch needed, set viewer target immediately
      setPendingParagraphId(null);
      setViewerTarget(paragraphId);
      setViewTrigger(v => v + 1);
      if (!isSplitView) {
        setIsViewerOpen(true);
      }
    }
  }, [viewScope, activeDocumentId, activeResult, completedDocuments, onSetActiveDocument, isSplitView]);

  // Handle pending paragraph navigation after document switch
  useEffect(() => {
    if (pendingParagraphId && activeDocumentId && activeResult) {
      console.log('🔥 useEffect: Handling pending paragraph after document switch');
      console.log('pendingParagraphId:', pendingParagraphId);
      console.log('new activeDocumentId:', activeDocumentId);
      console.log('activeResult available:', !!activeResult);
      
      // Use setTimeout to ensure state has fully settled
      const timeoutId = setTimeout(() => {
        console.log('🔥 useEffect: Setting viewer target after timeout');
        // Clear the pending paragraph and set the viewer target
        setPendingParagraphId(null);
        setViewerTarget(pendingParagraphId);
        setViewTrigger(v => v + 1);
        if (!isSplitView) {
          setIsViewerOpen(true);
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [activeDocumentId, pendingParagraphId, isSplitView, activeResult]);
  
  const handleToggleSplitView = useCallback(() => {
    setIsSplitView(prevIsSplit => {
      const newIsSplit = !prevIsSplit;
      if (newIsSplit) {
        setIsViewerOpen(false);
      } else {
        setSelectedTerm(null);
      }
      return newIsSplit;
    });
  }, []);

  const handleGoToModalView = useCallback(() => {
    setIsSplitView(false);
    setIsViewerOpen(true);
  }, []);

  if (completedDocuments.length === 0) {
    return (
      <EmptyState 
        title="No Analysis Results" 
        message="Upload and analyze documents to see results here." 
      />
    );
  }

  // Auto-select first completed document if none is active
  if (!activeDocumentId || !results.has(activeDocumentId)) {
    const firstCompleted = completedDocuments[0];
    if (firstCompleted) {
      onSetActiveDocument(firstCompleted.id);
      return null; // Will re-render with correct active document
    }
  }

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'definitions', label: 'Definitions', count: summaryCounts.definitions },
    { id: 'undefined', label: 'Undefined Terms', count: summaryCounts.undefinedTerms },
    { id: 'suggestions', label: 'Suggestions', count: summaryCounts.suggestions },
    { id: 'cross-references', label: 'Cross-references', count: summaryCounts.crossReferences },
    { id: 'numbering', label: 'Numbering', count: summaryCounts.numberingDiscrepancies },
  ];
  
  const tableContent = (isUsagePanel: boolean = false) => {
    if (!combinedResults) return null;

    if (isUsagePanel && selectedTerm) {
      return (
        <UsagePanel
          selectedTerm={selectedTerm}
          allUsages={combinedResults.usages}
          allDefinitions={combinedResults.definitions}
          paragraphs={combinedResults.paragraphs}
          onClose={() => setSelectedTerm(null)}
          onViewParagraph={handleViewParagraph}
          isInline={true}
          documents={completedDocuments.map(d => ({ id: d.id, name: d.name }))}
          showDocumentInfo={viewScope === 'all' && completedDocuments.length > 1}
        />
      );
    }

    if (activeTab === 'definitions') {
      return filteredDefinitions.length > 0
        ? <ErrorBoundary><DefinitionsTable 
            definitions={filteredDefinitions} 
            paragraphs={combinedResults.paragraphs} 
            onSelectTerm={handleSelectTerm} 
            selectedTerm={selectedTerm} 
            onViewParagraph={handleViewParagraph} 
            isSplitView={isSplitView}
            documents={completedDocuments.map(d => ({ id: d.id, name: d.name }))}
            showDocumentInfo={viewScope === 'all' && completedDocuments.length > 1}
          /></ErrorBoundary>
        : <EmptyState title="No Definitions Found" message={activeFilters.length > 0 ? "No definitions match the current filters." : "The analysis did not identify any formal definitions."} />;
    }
    if (activeTab === 'undefined') {
      return filteredUndefinedTerms.length > 0
        ? <ErrorBoundary><UndefinedTable terms={filteredUndefinedTerms} onSelectTerm={handleSelectTerm} selectedTerm={selectedTerm} onViewParagraph={handleViewParagraph} /></ErrorBoundary>
        : <EmptyState title="No Undefined Terms Found" message={activeFilters.length > 0 ? "No undefined terms match the current filters." : "All capitalized terms appear to be correctly defined."} />;
    }
    if (activeTab === 'suggestions') {
      return combinedResults.suggestions.length > 0
        ? <ErrorBoundary><SuggestionsTable suggestions={combinedResults.suggestions} onViewParagraph={handleViewParagraph} /></ErrorBoundary>
        : <EmptyState title="No Suggestions Found" message="The AI did not identify any common terms that might warrant a formal definition." />;
    }
    if (activeTab === 'cross-references') {
      return combinedResults.crossReferences.length > 0
        ? <ErrorBoundary><CrossReferencesTable crossReferences={combinedResults.crossReferences} onViewParagraph={handleViewParagraph} /></ErrorBoundary>
        : <EmptyState title="No Cross-references Found" message="The document does not appear to contain references like 'Section 1.2' or 'Exhibit A'." />;
    }
    if (activeTab === 'numbering') {
      return combinedResults.numberingDiscrepancies.length > 0
        ? <ErrorBoundary><NumberingTable discrepancies={combinedResults.numberingDiscrepancies} onViewParagraph={handleViewParagraph} /></ErrorBoundary>
        : <EmptyState title="No Numbering Discrepancies Found" message="The document's automated numbering appears to be consistent." />;
    }
    return null;
  };

  const renderTopBar = () => (
    <div className="flex flex-col lg:flex-row justify-between lg:items-center mb-4 flex-shrink-0">
      <div className="flex items-center space-x-3 min-w-0 mb-4 lg:mb-0">
        <DocumentIcon className="h-6 w-6 text-gray-500 dark:text-cloud/60 flex-shrink-0" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-cloud">
          Analysis Results
        </h2>
        <span className="text-sm text-gray-500 dark:text-cloud/60 bg-gray-100 dark:bg-midnight-lighter px-2 py-1 rounded">
          {completedDocuments.length} document{completedDocuments.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
        {/* View Scope Toggle */}
        <div className="flex bg-gray-100 dark:bg-midnight-lighter rounded-md p-1">
          <button
            onClick={() => setViewScope('active')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              viewScope === 'active'
                ? 'bg-white dark:bg-midnight-light text-teal dark:text-lilac shadow-sm'
                : 'text-gray-600 dark:text-cloud/60 hover:text-gray-800 dark:hover:text-cloud'
            }`}
          >
            Active Doc
          </button>
          <button
            onClick={() => setViewScope('all')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              viewScope === 'all'
                ? 'bg-white dark:bg-midnight-light text-teal dark:text-lilac shadow-sm'
                : 'text-gray-600 dark:text-cloud/60 hover:text-gray-800 dark:hover:text-cloud'
            }`}
          >
            All Docs
          </button>
        </div>

        {/* Document List Toggle */}
        <button
          onClick={() => setShowDocumentList(!showDocumentList)}
          className="p-2 bg-gray-100 dark:bg-midnight-lighter text-gray-800 dark:text-cloud rounded-md hover:bg-gray-200 dark:hover:bg-midnight-light transition-colors"
          title="Toggle Document List"
        >
          <FolderIcon className="h-4 w-4" />
        </button>

        {/* View Document Button */}
        {!isSplitView && combinedResults && (
          <button
            onClick={() => handleViewParagraph(combinedResults.paragraphs.length > 0 ? combinedResults.paragraphs[0].id : null, combinedResults.paragraphs.length > 0 ? combinedResults.paragraphs[0].documentId : undefined)}
            className="px-4 py-2 bg-gray-100 dark:bg-midnight-lighter text-gray-800 dark:text-cloud font-semibold rounded-md hover:bg-gray-200 dark:hover:bg-midnight-light transition-colors text-sm"
          >
            View Document{viewScope === 'all' ? 's' : ''}
          </button>
        )}

        {/* Split View Toggle */}
        <button
          onClick={handleToggleSplitView}
          aria-pressed={isSplitView}
          className={`p-2 rounded-md transition-colors ${
            isSplitView 
              ? 'bg-teal text-white hover:bg-teal-dark' 
              : 'bg-gray-100 dark:bg-midnight-lighter text-gray-800 dark:text-cloud hover:bg-gray-200 dark:hover:bg-midnight-light'
          }`}
          title="Toggle Split View"
        >
          <SplitScreenIcon className="h-5 w-5" />
        </button>

        {/* Action Buttons */}
        <button
          onClick={onReset}
          className="px-4 py-2 bg-teal text-white font-semibold rounded-md hover:bg-teal-dark transition-colors text-sm"
        >
          Analyze More
        </button>
        <button
          onClick={onFullReset}
          className="px-4 py-2 bg-gray-600 dark:bg-midnight-lighter text-white dark:text-cloud font-semibold rounded-md hover:bg-gray-700 dark:hover:bg-midnight-light transition-colors text-sm"
        >
          Change Model
        </button>
      </div>
    </div>
  );

  if (isSplitView) {
    return (
      <div className="flex-grow flex flex-col min-h-0 bg-white dark:bg-midnight-light/50 rounded-lg border border-gray-200 dark:border-midnight-lighter shadow-xl">
        <div className="p-4 sm:p-6 lg:p-8 flex-shrink-0">
          {renderTopBar()}
          {showDocumentList && (
            <div className="mt-4">
              <DocumentList
                documents={documents}
                activeDocumentId={activeDocumentId}
                onSetActiveDocument={onSetActiveDocument}
                onRemoveDocument={onRemoveDocument}
                onRetryAnalysis={onRetryAnalysis}
                showActiveSelection={true}
              />
            </div>
          )}
        </div>
        <div className="px-4 sm:px-6 lg:px-8 flex-shrink-0">
          <SummaryChips counts={summaryCounts} activeFilters={activeFilters} onFilterToggle={handleFilterToggle} />
        </div>

        <div className="sticky top-[68px] z-10 flex bg-white/80 dark:bg-midnight-light/80 backdrop-blur-sm border-y border-gray-200 dark:border-midnight-lighter">
          <div className="w-1/2 border-r border-gray-200 dark:border-midnight-lighter">
            <nav className="-mb-px flex space-x-8 overflow-x-auto px-6" aria-label="Tabs">
              {TABS.map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => { setActiveTab(tab.id); setSelectedTerm(null); }}
                  className={`${activeTab === tab.id ? 'border-teal dark:border-lilac text-teal dark:text-lilac' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-cloud/60 dark:hover:text-cloud/80 dark:hover:border-midnight-light'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </nav>
          </div>
          <div className="w-1/2 flex items-center justify-between pl-6 pr-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-cloud">Document Viewer</h2>
            <div className="flex items-center space-x-2">
              <button 
                onClick={handleGoToModalView} 
                className="p-2 rounded-md transition-colors bg-gray-100 dark:bg-midnight-light text-gray-800 dark:text-cloud hover:bg-gray-200 dark:hover:bg-midnight-lighter/50" 
                title="Switch to Focused View"
              >
                <MaximizeIcon className="h-5 w-5" />
              </button>
              <button 
                onClick={handleToggleSplitView} 
                className="p-2 rounded-md transition-colors bg-gray-100 dark:bg-midnight-light text-gray-800 dark:text-cloud hover:bg-gray-200 dark:hover:bg-midnight-lighter/50" 
                title="Close Split View"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-grow flex lg:flex-row min-h-0 h-[calc(100vh-125px)]">
          <div className="w-1/2 border-r border-gray-200 dark:border-midnight-lighter overflow-y-auto">
            {tableContent(!!selectedTerm)}
          </div>
          <div className="w-1/2 overflow-y-auto">
            <MultiDocumentViewer
              isOpen={true}
              viewMode="inline-content-only"
              onClose={() => {}}
              documents={documents}
              results={results}
              activeDocumentId={activeDocumentId}
              onSetActiveDocument={onSetActiveDocument}
              targetParagraphId={viewerTarget}
              viewTrigger={viewTrigger}
            />
          </div>
        </div>
      </div>
    );
  }

  // Default (non-split) view
  const showUsagePanel = !isSplitView && selectedTerm;
  return (
    <>
      <div className="flex-grow flex flex-col min-h-0 bg-white dark:bg-midnight-light/50 rounded-lg border border-gray-200 dark:border-midnight-lighter shadow-xl p-4 sm:p-6 lg:p-8">
        {renderTopBar()}
        
        {showDocumentList && (
          <div className="mb-4">
            <DocumentList
              documents={documents}
              activeDocumentId={activeDocumentId}
              onSetActiveDocument={onSetActiveDocument}
              onRemoveDocument={onRemoveDocument}
              onRetryAnalysis={onRetryAnalysis}
              showActiveSelection={true}
            />
          </div>
        )}
        
        <SummaryChips counts={summaryCounts} activeFilters={activeFilters} onFilterToggle={handleFilterToggle} />
        
        <div className="flex-grow min-h-0 flex flex-col lg:flex-row gap-8 relative">
          <div className={`w-full min-w-0 flex flex-col ${showUsagePanel ? 'lg:w-2/3' : 'lg:w-full'}`}>
            <div className="border-b border-gray-200 dark:border-midnight-lighter flex-shrink-0">
              <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                {TABS.map(tab => (
                  <button 
                    key={tab.id} 
                    onClick={() => { setActiveTab(tab.id); setSelectedTerm(null); }}
                    className={`${activeTab === tab.id ? 'border-teal dark:border-lilac text-teal dark:text-lilac' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-cloud/60 dark:hover:text-cloud/80 dark:hover:border-midnight-light'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex-grow overflow-y-auto">
              {tableContent()}
            </div>
          </div>
          
          {showUsagePanel && combinedResults && (
            <div className="lg:w-1/3 xl:w-2/5 flex-shrink-0 lg:sticky lg:top-20 lg:h-full lg:max-h-[calc(100vh-280px)]">
              <UsagePanel
                selectedTerm={selectedTerm}
                allUsages={combinedResults.usages}
                allDefinitions={combinedResults.definitions}
                paragraphs={combinedResults.paragraphs}
                onClose={() => setSelectedTerm(null)}
                onViewParagraph={handleViewParagraph}
                documents={completedDocuments.map(d => ({ id: d.id, name: d.name }))}
                showDocumentInfo={viewScope === 'all' && completedDocuments.length > 1}
              />
            </div>
          )}
        </div>
      </div>
      
      <MultiDocumentViewer
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        documents={documents}
        results={results}
        activeDocumentId={activeDocumentId}
        onSetActiveDocument={onSetActiveDocument}
        targetParagraphId={viewerTarget}
        viewTrigger={viewTrigger}
        viewMode="modal"
        onToggleSplitView={handleToggleSplitView}
        onGoToModalView={handleGoToModalView}
      />
    </>
  );
};