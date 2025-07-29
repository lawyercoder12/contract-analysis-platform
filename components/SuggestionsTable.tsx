import React from 'react';
import { Suggestion, IssueType } from '../types';
import { IssueBadge } from './IssueBadge';

interface SuggestionsTableProps {
    suggestions: Suggestion[];
    onViewParagraph: (paragraphId: string, documentId?: string) => void;
}

export const SuggestionsTable: React.FC<SuggestionsTableProps> = ({ suggestions, onViewParagraph }) => {
    return (
        <table className="w-full divide-y divide-gray-200 dark:divide-midnight-lighter border-separate border-spacing-0">
        <thead className="bg-gray-50 dark:bg-midnight-light sticky top-0 z-10">
            <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud sm:pl-6">Suggested Term</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">AI Reasoning</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">Sample Usage</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">Location</th>
            </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-midnight-light bg-white dark:bg-midnight">
            {suggestions.map((suggestion, index) => {
            const paraNum = parseInt(suggestion.paragraphId.replace('para-', '')) + 1;
            return (
                <tr 
                    key={`${suggestion.term}-${index}`} 
                    className="hover:bg-gray-50 dark:hover:bg-midnight-light/50"
                >
                    <td className="py-4 pl-4 pr-3 text-sm sm:pl-6">
                        <IssueBadge issue={IssueType.PotentialDefinitionNeeded} />
                        <span className="ml-2 font-medium text-green-700 dark:text-green-300">{suggestion.term}</span>
                    </td>
                    <td className="py-4 px-3 text-sm text-gray-700 dark:text-cloud/80 whitespace-normal">
                        <p>{suggestion.reasoning}</p>
                    </td>
                    <td className="py-4 px-3 text-sm text-gray-700 dark:text-cloud/80 whitespace-normal">
                    <em>"{suggestion.sentence}"</em>
                    </td>
                    <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-500 dark:text-cloud/60 font-mono">
                        <button onClick={() => onViewParagraph(suggestion.paragraphId, suggestion.documentId)} className="hover:underline hover:text-teal dark:hover:text-lilac transition-colors" title={`Go to Para ${paraNum}`}>
                        {`Para ${paraNum}`}
                    </button>
                    </td>
                </tr>
            );
            })}
        </tbody>
        </table>
    );
};