import React, { useState, useMemo } from 'react';
import { Usage, IssueType } from '../types';
import { IssueBadge } from './IssueBadge';
import { SortIcon } from './Icons';

interface UsagesTableProps {
  usages: Usage[];
}

type SortKey = keyof Usage | 'issues';
type SortDirection = 'asc' | 'desc';

export const UsagesTable: React.FC<UsagesTableProps> = ({ usages }) => {
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);

  const sortedUsages = useMemo(() => {
    let sortableItems = [...usages];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;

        if (sortConfig.key === 'issues') {
            aValue = a[sortConfig.key].length;
            bValue = b[sortConfig.key].length;
        } else {
            aValue = a[sortConfig.key as keyof Usage];
            bValue = b[sortConfig.key as keyof Usage];
        }
        
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        if(typeof aValue === 'number' && typeof bValue === 'number') {
            return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [usages, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: SortKey) => {
      if(!sortConfig || sortConfig.key !== key) return <SortIcon className="w-4 h-4 ml-2 opacity-50" />;
      return sortConfig.direction === 'asc' ? '▲' : '▼';
  }
  
  const classificationColor = (classification: string) => {
    switch(classification) {
        case 'Defined': return 'text-green-400';
        case 'Undefined': return 'text-yellow-400';
        case 'Acronym': return 'text-blue-400';
        case 'Noise': return 'text-gray-500';
        default: return 'text-gray-300';
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-700">
        <thead className="bg-gray-800">
          <tr>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-white cursor-pointer" onClick={() => requestSort('paragraphId')}>
                <div className="flex items-center">Location {getSortIcon('paragraphId')}</div>
            </th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-white">Token</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-white cursor-pointer" onClick={() => requestSort('classification')}>
                <div className="flex items-center">Classification {getSortIcon('classification')}</div>
            </th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-white cursor-pointer" onClick={() => requestSort('canonical')}>
                <div className="flex items-center">Canonical Term {getSortIcon('canonical')}</div>
            </th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-white cursor-pointer" onClick={() => requestSort('def_locator')}>
                <div className="flex items-center">Def. Locator {getSortIcon('def_locator')}</div>
            </th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-white cursor-pointer" onClick={() => requestSort('issues')}>
                <div className="flex items-center">Issues {getSortIcon('issues')}</div>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 bg-gray-900">
          {sortedUsages.map((usage, index) => (
            <tr key={`${usage.paragraphId}-${usage.token}-${index}`} className="hover:bg-gray-800/50">
              <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-400">{usage.paragraphId}</td>
              <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-300">
                <code className="bg-gray-700 rounded px-1.5 py-0.5">{usage.token}</code>
              </td>
              <td className={`whitespace-nowrap py-4 px-3 text-sm font-medium ${classificationColor(usage.classification)}`}>{usage.classification}</td>
              <td className="whitespace-nowrap py-4 px-3 text-sm text-cyan-300">{usage.canonical || 'N/A'}</td>
              <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-400">{usage.def_locator || 'N/A'}</td>
              <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-300">
                <div className="flex flex-wrap gap-1">
                  {usage.issues.length > 0 ? usage.issues.map(issue => <IssueBadge key={issue} issue={issue} />) : <span className="text-gray-500">None</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};