import React from 'react';
import { CheckCircleIcon } from './Icons';

interface EmptyStateProps {
    title: string;
    message: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, message }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-50 dark:bg-midnight/60">
        <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full border-2 border-green-200 dark:border-green-500/30 mb-4">
            <CheckCircleIcon className="w-12 h-12 text-green-500 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-cloud">{title}</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-cloud/60 max-w-md">{message}</p>
    </div>
);
