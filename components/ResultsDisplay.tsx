import React, { useState, useMemo, useCallback } from 'react';
import { AnalysisResult, GroupedDefinition, UndefinedTermGroup, SummaryCounts, IssueType, Classification, Usage, Definition, Suggestion, CrossReference } from '../types';
import { DefinitionsTable } from './DefinitionsTable';
import { UndefinedTable } from './UndefinedTable';
import { SuggestionsTable } from './SuggestionsTable';
import { CrossReferencesTable } from './CrossReferencesTable';
import { NumberingTable } from './NumberingTable';
import { UsagePanel } from './UsagePanel';
import { SummaryChips } from './SummaryChips';
import { DocumentIcon, SplitScreenIcon, XIcon, MaximizeIcon } from './Icons';
import { DocumentViewer } from './DocumentViewer';
import { EmptyState } from './EmptyState';
import { ErrorBoundary } from './ErrorBoundary';

interface ResultsDisplayProps {
  results: AnalysisResult;
  fileName: string;
  onReset: () => void;
  onFullReset: () => void;
}

type Tab = 'definitions' | 'undefined' | 'suggestions' | 'cross-references' | 'numbering';

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, fileName, onReset, onFullReset }) => {
  const [activeTab, setActiveTab] = useState<Tab>('definitions');
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<IssueType[]>([]);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerTarget, setViewerTarget] = useState<string | null>(null);
  const [isSplitView, setIsSplitView] = useState(false);
  const [viewTrigger, setViewTrigger] = useState(0);

  const { groupedDefinitions, undefinedTermGroups, summaryCounts } = useMemo(() => {
    // Group definitions by canonical term
    const defMap = new Map<string, Definition[]>();
    results.definitions.forEach(def => {
        const existing = defMap.get(def.term_canonical) || [];
        defMap.set(def.term_canonical, [...existing, def]);
    });

    const groupedDefs: GroupedDefinition[] = Array.from(defMap.entries()).map(([canonical, allDefs]) => {
        const allUsages = results.usages.filter(u => u.canonical === canonical);
        const issues = new Set<IssueType>();
        allDefs.forEach(d => d.issues.forEach(i => issues.add(i)));
        allUsages.forEach(u => u.issues.forEach(i => issues.add(i)));
        
        return {
            canonical,
            allDefs,
            allUsages,
            issues: Array.from(issues),
        }
    });

    // Group undefined usages by token
    const undefinedUsages = results.usages.filter(u => u.classification === Classification.Undefined);
    const undefinedMap = new Map<string, Usage[]>();
    undefinedUsages.forEach(usage => {
        const existing = undefinedMap.get(usage.token) || [];
        undefinedMap.set(usage.token, [...existing, usage]);
    });

    const undefinedGroups: UndefinedTermGroup[] = Array.from(undefinedMap.entries()).map(([token, usages]) => {
        const issues = new Set<IssueType>();
        usages.forEach(u => u.issues.forEach(i => issues.add(i)));
        return {
            token,
            usages,
            issues: Array.from(issues)
        }
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
        suggestions: results.suggestions.length,
        crossReferences: results.crossReferences.length,
        numberingDiscrepancies: results.numberingDiscrepancies.length,
        issues: issueCounts,
        totalIssues: totalIssues
    };

    return { groupedDefinitions: groupedDefs, undefinedTermGroups: undefinedGroups, summaryCounts: summary };
  }, [results]);

  const handleFilterToggle = useCallback((issue: IssueType) => {
      setActiveFilters(prev => 
          prev.includes(issue) ? prev.filter(i => i !== issue) : [...prev, issue]
      );
  }, []);

  const filteredDefinitions = useMemo(() => {
      if(activeFilters.length === 0) return groupedDefinitions;
      return groupedDefinitions.filter(g => activeFilters.some(f => g.issues.includes(f)));
  }, [groupedDefinitions, activeFilters]);

  const filteredUndefinedTerms = useMemo(() => {
      if(activeFilters.length === 0) return undefinedTermGroups;
      return undefinedTermGroups.filter(g => activeFilters.some(f => g.issues.includes(f)));
  }, [undefinedTermGroups, activeFilters]);

  const handleSelectTerm = (term: string | null) => {
      if(term === selectedTerm) {
          setSelectedTerm(null);
      } else {
          setSelectedTerm(term);
          if (isSplitView) {
            const def = results.definitions.find(d => d.term_canonical === term || d.term_raw === term);
            if (def) {
                handleViewParagraph(def.paragraphId);
            }
          }
      }
  }

  const handleViewParagraph = useCallback((paragraphId: string | null, _documentId?: string) => {
    // Note: documentId is ignored in single-document view since there's only one document
    setViewerTarget(paragraphId);
    setViewTrigger(v => v + 1);
    if (!isSplitView) {
        setIsViewerOpen(true);
    }
  }, [isSplitView]);
  
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

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'definitions', label: 'Definitions', count: summaryCounts.definitions },
    { id: 'undefined', label: 'Undefined Terms', count: summaryCounts.undefinedTerms },
    { id: 'suggestions', label: 'Suggestions', count: summaryCounts.suggestions },
    { id: 'cross-references', label: 'Cross-references', count: summaryCounts.crossReferences },
    { id: 'numbering', label: 'Numbering', count: summaryCounts.numberingDiscrepancies },
  ];
  
  const tableContent = (isUsagePanel: boolean = false) => {
    if (isUsagePanel && selectedTerm) {
        return (
            <UsagePanel
                selectedTerm={selectedTerm}
                allUsages={results.usages}
                allDefinitions={results.definitions}
                paragraphs={results.paragraphs}
                onClose={() => setSelectedTerm(null)}
                onViewParagraph={handleViewParagraph}
                isInline={true}
            />
        );
    }

    if (activeTab === 'definitions') {
        return filteredDefinitions.length > 0
            ? <ErrorBoundary><DefinitionsTable definitions={filteredDefinitions} paragraphs={results.paragraphs} onSelectTerm={handleSelectTerm} selectedTerm={selectedTerm} onViewParagraph={handleViewParagraph} isSplitView={isSplitView} /></ErrorBoundary>
            : <EmptyState title="No Definitions Found" message={activeFilters.length > 0 ? "No definitions match the current filters." : "The analysis did not identify any formal definitions."} />;
    }
    if (activeTab === 'undefined') {
        return filteredUndefinedTerms.length > 0
            ? <ErrorBoundary><UndefinedTable terms={filteredUndefinedTerms} onSelectTerm={handleSelectTerm} selectedTerm={selectedTerm} onViewParagraph={handleViewParagraph} /></ErrorBoundary>
            : <EmptyState title="No Undefined Terms Found" message={activeFilters.length > 0 ? "No undefined terms match the current filters." : "All capitalized terms appear to be correctly defined."} />;
    }
    if (activeTab === 'suggestions') {
        return results.suggestions.length > 0
            ? <ErrorBoundary><SuggestionsTable suggestions={results.suggestions} onViewParagraph={handleViewParagraph} /></ErrorBoundary>
            : <EmptyState title="No Suggestions Found" message="The AI did not identify any common terms that might warrant a formal definition." />;
    }
    if (activeTab === 'cross-references') {
        return results.crossReferences.length > 0
            ? <ErrorBoundary><CrossReferencesTable crossReferences={results.crossReferences} onViewParagraph={handleViewParagraph} /></ErrorBoundary>
            : <EmptyState title="No Cross-references Found" message="The document does not appear to contain references like 'Section 1.2' or 'Exhibit A'." />;
    }
    if (activeTab === 'numbering') {
        return results.numberingDiscrepancies.length > 0
            ? <ErrorBoundary><NumberingTable discrepancies={results.numberingDiscrepancies} onViewParagraph={handleViewParagraph} /></ErrorBoundary>
            : <EmptyState title="No Numbering Discrepancies Found" message="The document's automated numbering appears to be consistent." />;
    }
    return null;
  }

  const renderTopBar = () => (
    <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 flex-shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
            <DocumentIcon className="h-6 w-6 text-gray-500 dark:text-cloud/60 flex-shrink-0" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-cloud truncate" title={fileName}>{fileName}</h2>
        </div>
        <div className="flex items-center space-x-2 mt-4 md:mt-0 flex-shrink-0">
          {!isSplitView && (
            <button
                onClick={() => handleViewParagraph(results.paragraphs.length > 0 ? results.paragraphs[0].id : null)}
                className="px-4 py-2 bg-gray-100 dark:bg-midnight-lighter text-gray-800 dark:text-cloud font-semibold rounded-md hover:bg-gray-200 dark:hover:bg-midnight-light transition-colors text-sm"
            >
                View Document
            </button>
          )}
           <button
            onClick={handleToggleSplitView}
            aria-pressed={isSplitView}
            className={`p-2 rounded-md transition-colors ${isSplitView ? 'bg-teal text-white hover:bg-teal-dark' : 'bg-gray-100 dark:bg-midnight-lighter text-gray-800 dark:text-cloud hover:bg-gray-200 dark:hover:bg-midnight-light'}`}
            title="Toggle Split View"
          >
            <SplitScreenIcon className="h-5 w-5" />
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 bg-teal text-white font-semibold rounded-md hover:bg-teal-dark transition-colors text-sm"
          >
            Analyze Another
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
        <div className="p-4 sm:p-6 lg:p-8 flex-shrink-0">{renderTopBar()}</div>
        <div className="px-4 sm:px-6 lg:px-8 flex-shrink-0"><SummaryChips counts={summaryCounts} activeFilters={activeFilters} onFilterToggle={handleFilterToggle} /></div>

        <div className="sticky top-[68px] z-10 flex bg-white/80 dark:bg-midnight-light/80 backdrop-blur-sm border-y border-gray-200 dark:border-midnight-lighter">
            <div className="w-1/2 border-r border-gray-200 dark:border-midnight-lighter">
                <nav className="-mb-px flex space-x-8 overflow-x-auto px-6" aria-label="Tabs">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedTerm(null); }}
                            className={`${activeTab === tab.id ? 'border-teal dark:border-lilac text-teal dark:text-lilac' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-cloud/60 dark:hover:text-cloud/80 dark:hover:border-midnight-light'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                            aria-current={activeTab === tab.id ? 'page' : undefined}>
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </nav>
            </div>
            <div className="w-1/2 flex items-center justify-between pl-6 pr-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-cloud">Document Viewer</h2>
                <div className="flex items-center space-x-2">
                    <button onClick={handleGoToModalView} className="p-2 rounded-md transition-colors bg-gray-100 dark:bg-midnight-light text-gray-800 dark:text-cloud hover:bg-gray-200 dark:hover:bg-midnight-lighter/50" title="Switch to Focused View">
                        <MaximizeIcon className="h-5 w-5" />
                    </button>
                    <button onClick={handleToggleSplitView} className="p-2 rounded-md transition-colors bg-gray-100 dark:bg-midnight-light text-gray-800 dark:text-cloud hover:bg-gray-200 dark:hover:bg-midnight-lighter/50" title="Close Split View">
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
                <DocumentViewer isOpen={true} viewMode="inline-content-only" onClose={() => {}} paragraphs={results.paragraphs} definitions={results.definitions} usages={results.usages} suggestions={results.suggestions} crossReferences={results.crossReferences} targetParagraphId={viewerTarget} maxLevel={results.maxLevel} viewTrigger={viewTrigger} />
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
        <SummaryChips counts={summaryCounts} activeFilters={activeFilters} onFilterToggle={handleFilterToggle} />
        
        <div className="flex-grow min-h-0 flex flex-col lg:flex-row gap-8">
            <div className={`w-full min-w-0 flex flex-col ${showUsagePanel ? 'lg:w-2/3' : 'lg:w-full'}`}>
                <div className="border-b border-gray-200 dark:border-midnight-lighter flex-shrink-0">
                    <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                        {TABS.map(tab => (
                            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedTerm(null); }}
                                className={`${activeTab === tab.id ? 'border-teal dark:border-lilac text-teal dark:text-lilac' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-cloud/60 dark:hover:text-cloud/80 dark:hover:border-midnight-light'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                                aria-current={activeTab === tab.id ? 'page' : undefined}>
                                {tab.label} ({tab.count})
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {tableContent()}
                </div>
            </div>
            
            {showUsagePanel && (
                <UsagePanel
                    selectedTerm={selectedTerm}
                    allUsages={results.usages}
                    allDefinitions={results.definitions}
                    paragraphs={results.paragraphs}
                    onClose={() => setSelectedTerm(null)}
                    onViewParagraph={handleViewParagraph}
                />
            )}
        </div>
      </div>
      
      <DocumentViewer
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        paragraphs={results.paragraphs}
        definitions={results.definitions}
        usages={results.usages}
        suggestions={results.suggestions}
        crossReferences={results.crossReferences}
        targetParagraphId={viewerTarget}
        maxLevel={results.maxLevel}
        viewTrigger={viewTrigger}
        viewMode="modal"
        onToggleSplitView={handleToggleSplitView}
      />
    </>
  );
};