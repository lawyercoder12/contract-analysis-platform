import React, { useState } from 'react';
import { GroupedDefinition, Paragraph, Definition } from '../types';
import { IssueBadge } from './IssueBadge';
import { ChevronDownIcon, PlusCircleIcon, MinusCircleIcon } from './Icons';
import { getHighlightClassForIssue } from '../utils/highlighting';

interface DefinitionsTableProps {
  definitions: GroupedDefinition[];
  paragraphs: Paragraph[];
  onSelectTerm: (canonical: string) => void;
  selectedTerm: string | null;
  onViewParagraph: (paragraphId: string) => void;
  isSplitView: boolean;
  documents?: { id: string; name: string }[];
  showDocumentInfo?: boolean;
}

interface DefinitionRowProps {
    group: GroupedDefinition;
    paragraphs: Paragraph[];
    onSelectTerm: (c:string) => void;
    isSelected: boolean;
    onViewParagraph: (id: string) => void;
    isSplitView: boolean;
    documents?: { id: string; name: string }[];
    showDocumentInfo?: boolean;
}

const DefinitionRow: React.FC<DefinitionRowProps> = ({ group, paragraphs, onSelectTerm, isSelected, onViewParagraph, isSplitView, documents = [], showDocumentInfo = false }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const primaryDef = group.allDefs[0];
    const primaryParaNum = parseInt(primaryDef.paragraphId.replace('para-', '')) + 1;
    
    // Get document names for this definition group
    const getDocumentName = (documentId: string) => {
        const doc = documents.find(d => d.id === documentId);
        return doc ? doc.name : `Document ${documentId}`;
    };
    
    const uniqueDocuments = Array.from(new Set(group.documentIds || []));
    const isMultiDocument = uniqueDocuments.length > 1;

    const highlightInParagraph = (paragraphText: string, definition: Definition) => {
        if (!definition.def_text) return paragraphText;

        const highlightClass = getHighlightClassForIssue(new Set(definition.issues), 'def');

        try {
            const regex = new RegExp(`(${definition.def_text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'i');
            const parts = paragraphText.split(regex);
            return (
                <>
                    {parts.map((part, i) =>
                        i % 2 === 1 ? (
                            <mark key={i} className={`${highlightClass} px-1 rounded mx-[-1px] font-semibold`}>
                                {part}
                            </mark>
                        ) : ( part )
                    )}
                </>
            );
        } catch (e) {
            console.error("Regex error on highlight:", e);
            return paragraphText;
        }
    };

    return (
        <>
            <tr className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-midnight-light/50 ${isSelected ? 'bg-teal-50 dark:bg-lilac/20' : ''}`} onClick={() => onSelectTerm(group.canonical)}>
              {!isSplitView && (
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} 
                        className="text-gray-500 dark:text-cloud/60 hover:text-gray-800 dark:hover:text-cloud p-1 rounded-full hover:bg-gray-100 dark:hover:bg-midnight-light"
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Collapse definition context' : 'Expand definition context'}
                      >
                          <ChevronDownIcon className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                  </td>
              )}
              <td className={isSplitView ? "whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-teal dark:text-lilac sm:pl-6" : "whitespace-nowrap py-4 px-3 text-sm font-medium text-teal dark:text-lilac"}>{group.canonical}</td>
              <td className="py-4 px-3 text-sm text-gray-700 dark:text-cloud/80">
                <code className="bg-gray-100 dark:bg-midnight-light rounded px-1.5 py-0.5">{primaryDef.term_raw}</code>
                {group.allDefs.length > 1 && <span className="text-xs text-gray-500 dark:text-cloud/40 ml-2">({group.allDefs.length} versions)</span>}
              </td>
              <td className="py-4 px-3 text-sm text-gray-700 dark:text-cloud/80">
                {isSplitView ? (
                  <div className="flex items-start gap-2">
                    <p className={`flex-grow min-w-0 truncate`} title={primaryDef.def_text}>
                      {primaryDef.def_text}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                      }}
                      className="flex-shrink-0 text-gray-400 hover:text-gray-500 dark:text-cloud/60 dark:hover:text-cloud/80 p-0.5 mt-0.5"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Collapse definition' : 'Expand definition'}
                    >
                      {isExpanded ? <MinusCircleIcon className="w-5 h-5" /> : <PlusCircleIcon className="w-5 h-5" />}
                    </button>
                  </div>
                ) : (
                  <span className="whitespace-normal break-words">{primaryDef.def_text}</span>
                )}
              </td>
              <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-500 dark:text-cloud/60 font-mono">
                  <button onClick={(e) => { e.stopPropagation(); onViewParagraph(primaryDef.paragraphId); }} className="hover:underline hover:text-teal dark:hover:text-lilac transition-colors" title={`Go to Para ${primaryParaNum}`}>
                      {`Para ${primaryParaNum}`}
                  </button>
              </td>
              <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-700 dark:text-cloud/80 text-center">{group.allUsages.length}</td>
              {showDocumentInfo && (
                <td className="py-4 px-3 text-sm text-gray-700 dark:text-cloud/80">
                  <div className="flex flex-wrap gap-1">
                    {uniqueDocuments.map((docId, index) => (
                      <span
                        key={docId}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${ 
                          isMultiDocument
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                        title={getDocumentName(docId)}
                      >
                        {getDocumentName(docId).length > 15 
                          ? `${getDocumentName(docId).substring(0, 15)}...`
                          : getDocumentName(docId)
                        }
                      </span>
                    ))}
                    {isMultiDocument && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        Cross-doc
                      </span>
                    )}
                  </div>
                </td>
              )}
              <td className="py-4 pl-3 pr-4 text-sm text-gray-700 dark:text-cloud/80 sm:pr-6">
                <div className="flex flex-wrap gap-1">
                  {group.issues.length > 0 ? group.issues.map(issue => <IssueBadge key={issue} issue={issue} />) : <span className="text-gray-400 dark:text-cloud/40">None</span>}
                </div>
              </td>
            </tr>
            {isExpanded && (
                <tr className={isSelected ? 'bg-teal-50/50 dark:bg-lilac/10' : 'bg-gray-50 dark:bg-midnight/60'}>
                    <td colSpan={isSplitView ? (showDocumentInfo ? 7 : 6) : (showDocumentInfo ? 8 : 7)} className="p-0">
                        <div className="p-4 sm:p-6 bg-white/50 dark:bg-black/20">
                            <h4 className="text-sm font-semibold text-gray-800 dark:text-cloud mb-3">{group.allDefs.length > 1 ? 'Found Definitions:' : 'Definition Context:'}</h4>
                            <ul className="space-y-4">
                                {group.allDefs.map((def, idx) => {
                                    const paragraph = paragraphs.find(p => p.id === def.paragraphId);
                                    if (!paragraph) return null;
                                    const paraNum = parseInt(paragraph.id.replace('para-', '')) + 1;
                                    return (
                                        <li key={idx} className="p-4 bg-white dark:bg-midnight-light/70 rounded-lg border border-gray-200 dark:border-midnight-lighter/70 shadow-sm">
                                            <p className="text-sm text-gray-800 dark:text-cloud/90 leading-relaxed whitespace-normal break-words">{highlightInParagraph(paragraph.text, def)}</p>
                                            <div className="text-xs text-gray-500 dark:text-cloud/50 mt-3 flex justify-between items-center">
                                                <div className="flex items-center space-x-2">
                                                    <span>Defined as <code className="bg-gray-100 dark:bg-midnight rounded px-1.5 py-0.5">{def.term_raw}</code></span>
                                                    {showDocumentInfo && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                                            {getDocumentName(def.documentId)}
                                                        </span>
                                                    )}
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); onViewParagraph(def.paragraphId); }} className="font-mono text-teal dark:text-lilac hover:underline" title={`Go to Para ${paraNum} in document viewer`}>
                                                    View in Document &rarr;
                                                </button>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}


export const DefinitionsTable: React.FC<DefinitionsTableProps> = ({ definitions, paragraphs, onSelectTerm, selectedTerm, onViewParagraph, isSplitView, documents = [], showDocumentInfo = false }) => {
  return (
      <table className="w-full divide-y divide-gray-200 dark:divide-midnight-lighter border-separate border-spacing-0 table-fixed">
        <thead className="bg-gray-50 dark:bg-midnight-light sticky top-0 z-10">
          <tr>
            {!isSplitView && (
                <th scope="col" className="relative py-3.5 pl-4 pr-3 sm:pl-6">
                    <span className="sr-only">Expand</span>
                </th>
            )}
            <th scope="col" className={isSplitView ? "py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud sm:pl-6" : "py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud"}>Canonical Term</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">Primary Raw Term</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">Primary Definition</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">Locator</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">Uses</th>
            {showDocumentInfo && (
              <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">Documents</th>
            )}
            <th scope="col" className="py-3.5 pl-3 pr-4 text-left text-sm font-semibold text-gray-800 dark:text-cloud sm:pr-6">Issues</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-midnight-light bg-white dark:bg-midnight">
          {definitions.map((group) => (
            <DefinitionRow 
                key={group.canonical} 
                group={group}
                paragraphs={paragraphs}
                onSelectTerm={onSelectTerm}
                isSelected={selectedTerm === group.canonical}
                onViewParagraph={onViewParagraph}
                isSplitView={isSplitView}
                documents={documents}
                showDocumentInfo={showDocumentInfo}
            />
          ))}
        </tbody>
      </table>
  );
};