import React from 'react';
import { CrossReference } from '../types';

interface CrossReferencesTableProps {
    crossReferences: CrossReference[];
    onViewParagraph: (paragraphId: string) => void;
}

export const CrossReferencesTable: React.FC<CrossReferencesTableProps> = ({ crossReferences, onViewParagraph }) => {
    return (
        <table className="w-full divide-y divide-gray-200 dark:divide-midnight-lighter border-separate border-spacing-0">
        <thead className="bg-gray-50 dark:bg-midnight-light sticky top-0 z-10">
            <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud sm:pl-6">Reference Token</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">Context</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">Location</th>
            </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-midnight-light bg-white dark:bg-midnight">
            {crossReferences.map((cr, index) => {
            const paraNum = parseInt(cr.paragraphId.replace('para-', '')) + 1;
            return (
                <tr 
                    key={`${cr.token}-${index}`} 
                    className="hover:bg-gray-50 dark:hover:bg-midnight-light/50"
                >
                    <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-800 dark:text-cloud sm:pl-6">
                    <code className="bg-gray-100 dark:bg-midnight-light rounded px-1.5 py-0.5">{cr.token}</code>
                    </td>
                    <td className="py-4 px-3 text-sm text-gray-700 dark:text-cloud/80 whitespace-normal">
                    <em>"{cr.sentence}"</em>
                    </td>
                    <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-500 dark:text-cloud/60 font-mono">
                        <button onClick={() => onViewParagraph(cr.paragraphId)} className="hover:underline hover:text-teal dark:hover:text-lilac transition-colors" title={`Go to Para ${paraNum}`}>
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