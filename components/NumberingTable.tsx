import React from 'react';
import { NumberingDiscrepancy } from '../types';

interface NumberingTableProps {
    discrepancies: NumberingDiscrepancy[];
    onViewParagraph: (paragraphId: string, documentId?: string) => void;
}

export const NumberingTable: React.FC<NumberingTableProps> = ({ discrepancies, onViewParagraph }) => {
    return (
        <table className="w-full divide-y divide-gray-200 dark:divide-midnight-lighter border-separate border-spacing-0">
        <thead className="bg-gray-50 dark:bg-midnight-light sticky top-0 z-10">
            <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud sm:pl-6">Location</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">Issue</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-800 dark:text-cloud">Details</th>
            </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-midnight-light bg-white dark:bg-midnight">
            {discrepancies.map((d, index) => {
            const paraNum = parseInt(d.paragraphId.replace('para-', '')) + 1;
            return (
                <tr 
                    key={`${d.paragraphId}-${index}`} 
                    className="hover:bg-gray-50 dark:hover:bg-midnight-light/50"
                >
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-mono sm:pl-6">
                    <button onClick={() => onViewParagraph(d.paragraphId, d.documentId)} className="hover:underline text-teal dark:text-lilac transition-colors" title={`Go to Para ${paraNum}`}>
                        {`Para ${paraNum}`}
                    </button>
                    </td>
                    <td className="py-4 px-3 text-sm text-gray-800 dark:text-cloud/90 font-medium capitalize text-yellow-700 dark:text-yellow-300">
                    {d.type}
                    </td>
                    <td className="py-4 px-3 text-sm text-gray-700 dark:text-cloud/80 whitespace-normal">
                    {d.details}
                    </td>
                </tr>
            );
            })}
        </tbody>
        </table>
    );
};