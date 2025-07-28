import React from 'react';
import { SirionLogo } from './SirionLogo';

interface LoaderProps {
    message: string;
    progress: string | null;
}

export const Loader: React.FC<LoaderProps> = ({ message, progress }) => (
  <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
     <style>{`
      .sirion-loader-path {
        stroke-dasharray: 500;
        stroke-dashoffset: 500;
        animation: draw 2.5s ease-in-out infinite;
      }
      @keyframes draw {
        50% {
          stroke-dashoffset: 0;
        }
        100% {
          stroke-dashoffset: -500;
        }
      }
      .sirion-loader-path:nth-of-type(1) { animation-delay: 0s; }
      .sirion-loader-path:nth-of-type(2) { animation-delay: 0.1s; }
      .sirion-loader-path:nth-of-type(3) { animation-delay: 0.2s; }
      .sirion-loader-path:nth-of-type(4) { animation-delay: 0.3s; }
      .sirion-loader-path:nth-of-type(5) { animation-delay: 0.4s; }
    `}</style>
    <SirionLogo className="w-24 h-24 text-teal dark:text-lilac" isAnimated={true} />
    <p className="mt-6 text-lg font-semibold text-gray-800 dark:text-cloud">{message}</p>
    <p className="mt-2 text-gray-600 dark:text-cloud/60 h-6">
        {progress || 'The AI is reading your document and identifying terms...'}
    </p>
  </div>
);