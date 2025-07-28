import React from 'react';
import { SummaryCounts, IssueType } from '../types';
import { IssueBadge } from './IssueBadge';

interface SummaryChipsProps {
    counts: SummaryCounts;
    activeFilters: IssueType[];
    onFilterToggle: (issue: IssueType) => void;
}

const issueOrder: IssueType[] = [
    IssueType.Conflict,
    IssueType.MissingDefinition,
    IssueType.CaseDrift,
    IssueType.Duplicate,
    IssueType.UnusedTerm,
    IssueType.UseBeforeDefine
];

export const SummaryChips: React.FC<SummaryChipsProps> = ({ counts, activeFilters, onFilterToggle }) => {
    return (
        <div className="flex flex-col md:flex-row justify-between md:items-center pb-4 border-b border-gray-200 dark:border-midnight-lighter mb-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-cloud">Analysis Summary</h2>
                <p className="text-gray-600 dark:text-cloud/80 mt-1">
                    Found <span className="font-semibold text-teal dark:text-lilac">{counts.definitions}</span> defined terms, <span className="font-semibold text-teal dark:text-lilac">{counts.undefinedTerms}</span> undefined candidates, and <span className="font-semibold text-teal dark:text-lilac">{counts.crossReferences}</span> cross-references. 
                    The analysis flagged <span className="font-semibold text-yellow-600 dark:text-yellow-400">{counts.numberingDiscrepancies}</span> numbering issues, <span className={`font-semibold ${counts.totalIssues > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{counts.totalIssues}</span> term issues, and <span className="font-semibold text-green-600 dark:text-green-400">{counts.suggestions}</span> suggestions.
                </p>
            </div>
            <div className="mt-4 md:mt-0">
                <p className="text-sm font-medium text-gray-500 dark:text-cloud/60 mb-2 text-left md:text-right">Filter by term issue:</p>
                <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                    {issueOrder.map(issue => {
                        const count = counts.issues[issue];
                        if (count === 0) return null;
                        return (
                            <button 
                                key={issue}
                                onClick={() => onFilterToggle(issue)}
                                className={`transition-all duration-200 rounded-full ${activeFilters.includes(issue) ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-midnight-light ring-teal dark:ring-lilac' : 'opacity-70 hover:opacity-100'}`}
                                aria-pressed={activeFilters.includes(issue)}
                            >
                               <IssueBadge issue={issue} />
                               <span className="sr-only">Filter for {issue}</span>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};