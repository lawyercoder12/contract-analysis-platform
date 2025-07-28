import React, { useState } from 'react';
import { Usage, Definition, Paragraph } from '../types';
import { XIcon, ChevronDownIcon } from './Icons';

interface UsagePanelProps {
    selectedTerm: string | null;
    allUsages: Usage[];
    allDefinitions: Definition[];
    paragraphs: Paragraph[];
    onClose: () => void;
    onViewParagraph: (paragraphId: string) => void;
    isInline?: boolean;
}

export const UsagePanel: React.FC<UsagePanelProps> = ({ selectedTerm, allUsages, allDefinitions, paragraphs, onClose, onViewParagraph, isInline = false }) => {
    if (!selectedTerm) return null;

    const [isDefExpanded, setIsDefExpanded] = useState(false);

    const relevantUsages = allUsages.filter(u => u.canonical === selectedTerm || u.token === selectedTerm);
    const primaryDefinition = allDefinitions.find(d => d.term_canonical === selectedTerm);
    const primaryPara = primaryDefinition ? paragraphs.find(p => p.id === primaryDefinition.paragraphId) : null;

    const highlightTerm = (sentence: string, term: string) => {
        // Guard against undefined or empty sentence/term to prevent crashes.
        if (!sentence) {
             return <span className="italic text-gray-500">{`Context not available for "${term}"`}</span>;
        }
        if (!term) {
            return sentence; // If no term to highlight, return the full sentence.
        }
        try {
            const regex = new RegExp(`(\\b${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b)`, 'gi');
            const parts = sentence.split(regex);
            return parts.map((part, index) => 
                (index % 2 === 1) ? <strong key={index} className="bg-yellow-200 dark:bg-yellow-400/30 text-yellow-800 dark:text-yellow-200 rounded px-1">{part}</strong> : part
            );
        } catch(e) {
            console.error("Error creating regex for term:", term, e);
            return sentence;
        }
    };

    const highlightInParagraph = (paragraphText: string, highlightText: string) => {
        if (!highlightText || !paragraphText) return paragraphText || '';

        try {
            const regex = new RegExp(`(${highlightText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'i');
            const parts = paragraphText.split(regex);
            return (
                <>
                    {parts.map((part, i) =>
                        i % 2 === 1 ? (
                            <mark key={i} className="bg-teal-200/70 dark:bg-lilac/30 text-teal-900 dark:text-lilac px-1 rounded mx-[-1px] font-semibold">
                                {part}
                            </mark>
                        ) : ( part )
                    )}
                </>
            );
        } catch(e) {
            return paragraphText;
        }
    };
    
    const containerClasses = isInline
        ? "flex flex-col h-full bg-white dark:bg-midnight"
        : "w-full lg:w-1/3 xl:w-2/5 flex-shrink-0 bg-gray-50/80 dark:bg-midnight-light/80 backdrop-blur-sm border-l border-gray-200 dark:border-midnight-lighter p-6 flex flex-col rounded-lg";


    return (
        <div className={containerClasses}>
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 className="text-lg font-bold text-teal dark:text-lilac break-all">{selectedTerm}</h3>
                <button onClick={onClose} className="text-gray-500 dark:text-cloud/60 hover:text-gray-800 dark:hover:text-cloud transition-colors p-1 rounded-full hover:bg-gray-200 dark:hover:bg-midnight-light">
                    <XIcon className="w-6 h-6" />
                </button>
            </div>
            {primaryDefinition && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-midnight-light border border-gray-200 dark:border-midnight-lighter rounded-md flex-shrink-0">
                    <div className="flex justify-between items-start gap-2">
                        <div className="text-sm text-gray-800 dark:text-cloud/80 flex-grow min-w-0">
                            {isDefExpanded && primaryPara
                                ? <p className="leading-relaxed break-words">{highlightInParagraph(primaryPara.text, primaryDefinition.def_text)}</p>
                                : <p className="break-words truncate" title={primaryDefinition.def_text}>{primaryDefinition.def_text}</p>
                            }
                        </div>
                        <button onClick={() => setIsDefExpanded(!isDefExpanded)} className="text-gray-500 dark:text-cloud/60 hover:text-gray-800 dark:hover:text-cloud p-1 rounded-full hover:bg-gray-200 dark:hover:bg-midnight-light flex-shrink-0" aria-expanded={isDefExpanded}>
                            <ChevronDownIcon className={`w-5 h-5 transition-transform ${isDefExpanded ? 'rotate-180' : ''}`} />
                            <span className="sr-only">{isDefExpanded ? 'Collapse' : 'Expand'} definition context</span>
                        </button>
                    </div>
                     <div className="text-xs text-gray-500 dark:text-cloud/60 mt-2">Defined in:
                        <button 
                            onClick={() => onViewParagraph(primaryDefinition.paragraphId)} 
                            className="ml-1 font-mono text-teal dark:text-lilac hover:underline"
                            title={`Go to Para ${parseInt(primaryDefinition.paragraphId.replace('para-',''))+1}`}
                        >
                           {`Para ${parseInt(primaryDefinition.paragraphId.replace('para-',''))+1}`}
                        </button>
                     </div>
                </div>
            )}
            <p className="text-sm font-medium text-gray-500 dark:text-cloud/60 mb-2 flex-shrink-0">Usages ({relevantUsages.length})</p>
            <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-3 min-h-0">
                {relevantUsages.map((usage, index) => {
                    const paraNum = parseInt(usage.paragraphId.replace('para-', '')) + 1;
                    return (
                        <div key={index} className="text-sm text-gray-700 dark:text-cloud/80 p-3 bg-white dark:bg-midnight-light/50 rounded-md border border-gray-200/80 dark:border-midnight-lighter/50">
                           <p className="leading-relaxed">{highlightTerm(usage.sentence, usage.token)}</p>
                           <button onClick={() => onViewParagraph(usage.paragraphId)} className="text-xs text-teal dark:text-lilac hover:underline mt-2 float-right font-mono" title={`Go to Para ${paraNum}`}>
                               {`Para ${paraNum}`}
                           </button>
                        </div>
                    );
                })}
                {relevantUsages.length === 0 && (
                    <div className="text-sm text-center text-gray-500 dark:text-cloud/60 p-4 border-2 border-dashed border-gray-300 dark:border-midnight-lighter rounded-md">
                        No usages found for this term.
                    </div>
                )}
            </div>
        </div>
    );
};