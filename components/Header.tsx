import React from 'react';
import { SirionLogo } from './SirionLogo';
import { ThemeToggle } from './ThemeToggle';

export const Header: React.FC = () => (
  <header className="sticky top-0 bg-white/80 dark:bg-midnight/70 backdrop-blur-sm z-20 border-b border-gray-200 dark:border-midnight-lighter">
    <div className="container mx-auto px-4 md:px-8 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <SirionLogo className="w-8 h-8 text-teal dark:text-lilac" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-cloud tracking-tight">
            Sirion Web Lab
          </h1>
        </div>
        <ThemeToggle />
      </div>
    </div>
  </header>
);