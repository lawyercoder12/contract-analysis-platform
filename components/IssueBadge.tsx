import React from 'react';
import { IssueType } from '../types';

interface IssueBadgeProps {
  issue: IssueType;
}

const issueStyles: Record<IssueType, { text: string; classes: string, icon: string }> = {
  [IssueType.Duplicate]: { text: 'Duplicate', classes: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-800/60 dark:text-yellow-300 dark:border-yellow-700/80', icon: '' },
  [IssueType.Conflict]: { text: 'Conflict', classes: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-800/60 dark:text-red-300 dark:border-red-700/80', icon: '🔥' },
  [IssueType.CaseDrift]: { text: 'Case Drift', classes: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-800/60 dark:text-orange-300 dark:border-orange-700/80', icon: '🌓' },
  [IssueType.MissingDefinition]: { text: 'Undefined', classes: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-800/60 dark:text-red-300 dark:border-red-700/80', icon: '' },
  [IssueType.UnusedTerm]: { text: 'Unused', classes: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-800/60 dark:text-blue-300 dark:border-blue-700/80', icon: '🟦' },
  [IssueType.UseBeforeDefine]: { text: 'Used Before Def.', classes: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-800/60 dark:text-purple-300 dark:border-purple-700/80', icon: '' },
  [IssueType.PotentialDefinitionNeeded]: { text: 'Suggestion', classes: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-800/60 dark:text-green-300 dark:border-green-700/80', icon: '💡' },
};

export const IssueBadge: React.FC<IssueBadgeProps> = ({ issue }) => {
  const style = issueStyles[issue] || { text: 'Unknown', classes: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: '' };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style.classes}`}
    >
      {style.icon && <span className="mr-1.5">{style.icon}</span>}
      {style.text}
    </span>
  );
};