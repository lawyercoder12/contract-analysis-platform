import React from 'react';

interface SirionLogoProps {
    className?: string;
    isAnimated?: boolean;
}

export const SirionLogo: React.FC<SirionLogoProps> = ({ className, isAnimated = false }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 100 100" 
    className={className}
    aria-label="Sirion Logo"
  >
    <g fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round">
      <path className={isAnimated ? 'sirion-loader-path' : ''} d="M 80,25 A 35,35 0 0 0 22,50" />
      <path className={isAnimated ? 'sirion-loader-path' : ''} d="M 72,28 A 27,27 0 0 0 30,50" />
      <path className={isAnimated ? 'sirion-loader-path' : ''} d="M 64,32 A 19,19 0 0 0 38,50" />
      <path className={isAnimated ? 'sirion-loader-path' : ''} d="M 56,38 A 11,11 0 0 0 46,50" />
    </g>
    <g fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round">
      <path className={isAnimated ? 'sirion-loader-path' : ''} d="M 20,75 A 35,35 0 0 0 78,50" />
      <path className={isAnimated ? 'sirion-loader-path' : ''} d="M 28,72 A 27,27 0 0 0 70,50" />
      <path className={isAnimated ? 'sirion-loader-path' : ''} d="M 36,68 A 19,19 0 0 0 62,50" />
      <path className={isAnimated ? 'sirion-loader-path' : ''} d="M 44,62 A 11,11 0 0 0 54,50" />
    </g>
  </svg>
);