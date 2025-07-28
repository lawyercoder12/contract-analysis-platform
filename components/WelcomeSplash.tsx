import React from 'react';

interface WelcomeSplashProps {
    children: React.ReactNode;
}

export const WelcomeSplash: React.FC<WelcomeSplashProps> = ({ children }) => {
    return (
        <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
            <h2 className="text-4xl font-extrabold text-gray-900 dark:text-cloud tracking-tight">
                Welcome to the Sirion Web Lab
            </h2>
            <p className="mt-4 max-w-3xl text-lg text-gray-600 dark:text-cloud/80">
                An experimental space for AI-powered contract review tools. Upload a Microsoft Word document to analyze definitions, numbering, cross-references, and more.
            </p>
            <div className="mt-12 w-full">
                {children}
            </div>
        </div>
    );
};