import React, { useEffect, useMemo, useRef } from 'react';
import { Paragraph, Definition, Usage, IssueType, Suggestion, CrossReference } from '../types';
import { XIcon, SplitScreenIcon, MaximizeIcon } from './Icons';
import { getHighlightClassForIssue } from '../utils/highlighting';

interface DocumentViewerProps {
    isOpen: boolean;
    onClose: () => void;
    paragraphs: Paragraph[];
    definitions: Definition[];
    usages: Usage[];
    suggestions: Suggestion[];
    crossReferences: CrossReference[];
    targetParagraphId: string | null;
    maxLevel: number;
    viewTrigger: number;
    viewMode?: 'modal' | 'inline' | 'inline-content-only';
    onToggleSplitView?: () => void;
    onGoToModalView?: () => void;
}

const createTermMap = (definitions: Definition[], usages: Usage[], suggestions: Suggestion[], crossReferences: CrossReference[]) => {
    const map = new Map<string, { issues: Set<IssueType>, type: 'def' | 'usage' | 'suggestion' | 'cross-reference' }>();
    
    // Process definitions and usages first
    const allTerms = [...definitions.map(d => ({term: d.term_canonical, issues: d.issues, type: 'def'})), ...usages.map(u => ({term: u.canonical || u.token, issues: u.issues, type: 'usage'}))];

    for (const item of allTerms) {
        if (!item.term) continue;
        const key = item.term.toLowerCase();
        if (!map.has(key)) map.set(key, { issues: new Set(), type: item.type as 'def' | 'usage'});
        item.issues.forEach(issue => map.get(key)!.issues.add(issue));
    }

    // Layer suggestions
    for (const s of suggestions) {
        const key = s.term.toLowerCase();
        if (!map.has(key)) {
            map.set(key, { issues: new Set([IssueType.PotentialDefinitionNeeded]), type: 'suggestion' });
        }
    }

    // Layer cross-references
    for (const cr of crossReferences) {
        const key = cr.token.toLowerCase();
        // Only add if not already defined as something else. This avoids highlighting a defined term as a cross-ref.
        if (!map.has(key)) {
             map.set(key, { issues: new Set(), type: 'cross-reference' });
        }
    }

    return map;
}

const HighlightedParagraph: React.FC<{ paragraph: Paragraph; definitions: Definition[]; usages: Usage[]; suggestions: Suggestion[]; crossReferences: CrossReference[]; termMap: Map<string, any> }> = ({ paragraph, definitions, usages, suggestions, crossReferences, termMap }) => {
    const termsInParagraph = useMemo(() => {
        const terms = new Set<string>();
        definitions.filter(d => d.paragraphId === paragraph.id).forEach(d => terms.add(d.term_raw));
        usages.filter(u => u.paragraphId === paragraph.id).forEach(u => terms.add(u.token));
        suggestions.filter(s => s.paragraphId === paragraph.id).forEach(s => terms.add(s.term));
        crossReferences.filter(cr => cr.paragraphId === paragraph.id).forEach(cr => terms.add(cr.token));
        
        return Array.from(terms).sort((a, b) => b.length - a.length);
    }, [paragraph, definitions, usages, suggestions, crossReferences]);

    if (termsInParagraph.length === 0) {
        return <p>{paragraph.text}</p>;
    }

    const regex = new RegExp(`(${termsInParagraph.map(t => t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})`, 'gi');
    const parts = paragraph.text.split(regex);
    
    return (
        <p>
            {parts.map((part, index) => {
                 if (termsInParagraph.some(t => t.toLowerCase() === part.toLowerCase())) {
                    const canonical = (
                        definitions.find(d => d.term_raw.toLowerCase() === part.toLowerCase())?.term_canonical || 
                        usages.find(u => u.token.toLowerCase() === part.toLowerCase())?.canonical || 
                        part
                    ).toLowerCase();
                    
                    const termInfo = termMap.get(canonical) || termMap.get(part.toLowerCase());
                    if (!termInfo) return part;

                    const issues = termInfo.issues || new Set();
                    const className = getHighlightClassForIssue(issues, termInfo.type);
                    return <span key={index} className={`font-semibold rounded px-1 ${className}`}>{part}</span>
                }
                return part;
            })}
        </p>
    );
};


export const DocumentViewer: React.FC<DocumentViewerProps> = ({ isOpen, onClose, paragraphs, definitions, usages, suggestions, crossReferences, targetParagraphId, maxLevel, viewTrigger, viewMode = 'modal', onToggleSplitView, onGoToModalView }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const termMap = useMemo(() => createTermMap(definitions, usages, suggestions, crossReferences), [definitions, usages, suggestions, crossReferences]);

    const numLabelWidth = useMemo(() => `${4 + maxLevel * 0.75}rem`, [maxLevel]);

    useEffect(() => {
        const targetElement = targetParagraphId ? document.getElementById(targetParagraphId) : null;
        if (isOpen && targetElement) {
            const timer = setTimeout(() => {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

                targetElement.classList.remove('animate-pulse-bg-once');
                void targetElement.offsetWidth; // Force reflow
                targetElement.classList.add('animate-pulse-bg-once');
            }, 100);

            const animationEndHandler = () => {
                targetElement.classList.remove('animate-pulse-bg-once');
            };
            targetElement.addEventListener('animationend', animationEndHandler);

            return () => {
                clearTimeout(timer);
                targetElement.removeEventListener('animationend', animationEndHandler);
            };
        }
    }, [isOpen, targetParagraphId, viewTrigger]);

    if (!isOpen) {
        return null;
    }

    const mainContent = (
         <main ref={containerRef} className="flex-grow overflow-y-auto p-6 md:p-8 space-y-2 leading-relaxed text-gray-800 dark:text-gray-300">
            {paragraphs.map(p => {
                const paraStyle: React.CSSProperties = {};
                if (p.indent) {
                    paraStyle.marginLeft = p.indent.left;
                    // Apply hanging indent for list items
                    if (p.numLabel) {
                        paraStyle.textIndent = `-${p.indent.hanging}`;
                        paraStyle.paddingLeft = p.indent.hanging;
                    }
                }

                return (
                    <div 
                        key={p.id} 
                        id={p.id} 
                        className="p-2 border-l-2 border-transparent hover:bg-gray-100/50 dark:hover:bg-midnight-lighter/30 hover:border-teal dark:hover:border-lilac transition-colors duration-200 rounded-md"
                        style={paraStyle}
                    >
                        <div className="flex gap-x-4">
                            <div 
                                style={{ width: numLabelWidth, flexShrink: 0 }}
                                className="text-right text-gray-500 dark:text-cloud/60 font-mono select-none pr-2"
                            >
                                {p.numLabel}
                            </div>
                            <div className="flex-grow border-l-2 border-gray-200 dark:border-midnight-lighter pl-4">
                                <HighlightedParagraph paragraph={p} definitions={definitions} usages={usages} suggestions={suggestions} crossReferences={crossReferences} termMap={termMap} />
                                <div className="text-right text-xs text-gray-400 dark:text-cloud/60 mt-2 font-mono">
                                    {`Para ${parseInt(p.id.replace('para-', '')) + 1}`}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </main>
    );

    if (viewMode === 'inline-content-only') {
        return mainContent;
    }

    const fullHeader = (
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-midnight-lighter flex-shrink-0">
            <h2 id="document-viewer-title" className="text-xl font-bold text-gray-900 dark:text-cloud">Document Viewer</h2>
            <div className="flex items-center space-x-2">
                {viewMode === 'inline' && onGoToModalView && (
                    <button onClick={onGoToModalView} className="p-2 rounded-md transition-colors bg-gray-100 dark:bg-midnight-lighter text-gray-800 dark:text-cloud hover:bg-gray-200 dark:hover:bg-midnight-light" title="Switch to Focused View" aria-label="Switch to Focused View">
                        <MaximizeIcon className="h-5 w-5" />
                    </button>
                )}
                {viewMode === 'modal' && onToggleSplitView && (
                    <button onClick={onToggleSplitView} className="p-2 rounded-md transition-colors bg-gray-100 dark:bg-midnight-lighter text-gray-800 dark:text-cloud hover:bg-gray-200 dark:hover:bg-midnight-light" title="Switch to Split View" aria-label="Switch to Split View">
                        <SplitScreenIcon className="h-5 w-5" />
                    </button>
                )}
                <button onClick={onClose} className="text-gray-500 dark:text-cloud/60 hover:text-gray-800 dark:hover:text-cloud transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-midnight-lighter">
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
                aria-labelledby="document-viewer-title"
            >
                 <style>{`
                    .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                 `}</style>
                <div 
                    className="bg-white dark:bg-midnight-light border border-gray-200 dark:border-midnight-lighter rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col"
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