import React from 'react';
import { UndefinedTermGroup } from '../types';
import { IssueBadge } from './IssueBadge';

interface UndefinedTableProps {
    terms: UndefinedTermGroup[];
    onSelectTerm: (term: string) => void;
    selectedTerm: string | null;
    onViewParagraph: (paragraphId: string) => void;
}

export const UndefinedTable: React.FC<UndefinedTableProps> = ({ terms, onSelectTerm, selectedTerm, onViewParagraph }) => {
    return (
        <table className="w-full divide-y divide-gray-200 dark:divide-midnight-lighter border-separate border-spacing-0">
        <thead className="bg-gray-50 dark:bg-midnight-light sticky top-0 z-10">
            <tr>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">Suggested Term</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">Uses</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">First Occurrence</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">Sample Usage</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">Issues</th>
            </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-midnight-light bg-white dark:bg-midnight">
            {terms.map((group) => {
            const firstUsage = group.usages[0];
            const paraNum = parseInt(firstUsage.paragraphId.replace('para-', '')) + 1;
            return (
                <tr 
                    key={group.token} 
                    className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-midnight-light/50 ${selectedTerm === group.token ? 'bg-teal-50 dark:bg-lilac/20' : ''}`}
                    onClick={() => onSelectTerm(group.token)}
                >
                    <td className="whitespace-nowrap py-4 px-3 text-sm font-medium text-yellow-600 dark:text-yellow-300">{group.token}</td>
                    <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-700 dark:text-cloud/80 text-center">{group.usages.length}</td>
                    <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-500 dark:text-cloud/60 font-mono">
                        <button onClick={(e) => { e.stopPropagation(); onViewParagraph(firstUsage.paragraphId); }} className="hover:underline hover:text-teal dark:hover:text-lilac transition-colors" title={`Go to Para ${paraNum}`}>
                        {`Para ${paraNum}`}
                    </button>
                    </td>
                    <td className="py-4 px-3 text-sm text-gray-700 dark:text-cloud/80 whitespace-normal break-words" title={firstUsage.sentence || `Context not available for "${group.token}"`}>
                    {firstUsage.sentence || <span className="italic text-gray-500">{`Context not available for "${group.token}"`}</span>}
                    </td>
                    <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-700 dark:text-cloud/80">
                    <div className="flex flex-wrap gap-1">
                        {group.issues.length > 0 ? group.issues.map(issue => <IssueBadge key={issue} issue={issue} />) : <span className="text-gray-400 dark:text-cloud/40">None</span>}
                    </div>
                    </td>
                </tr>
            );
            })}
        </tbody>
        </table>
    );
};