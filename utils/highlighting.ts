import { IssueType } from '../types';

export const getHighlightClassForIssue = (issues: Set<IssueType>, type: string): string => {
    if (issues.has(IssueType.Conflict) || issues.has(IssueType.MissingDefinition)) return 'bg-red-200/60 dark:bg-red-500/30 text-red-900 dark:text-red-300 ring-1 ring-red-300/70 dark:ring-red-500/50';
    if (issues.has(IssueType.Duplicate) || issues.has(IssueType.CaseDrift)) return 'bg-yellow-200/60 dark:bg-yellow-500/30 text-yellow-900 dark:text-yellow-300 ring-1 ring-yellow-300/70 dark:ring-yellow-500/50';
    if (issues.has(IssueType.UseBeforeDefine)) return 'bg-purple-200/60 dark:bg-purple-500/30 text-purple-900 dark:text-purple-300 ring-1 ring-purple-300/70 dark:ring-purple-500/50';
    if (type === 'cross-reference') return 'bg-sky-200/60 dark:bg-sky-500/30 text-sky-900 dark:text-sky-300';
    if (issues.has(IssueType.UnusedTerm)) return 'bg-blue-200/60 dark:bg-blue-500/30 text-blue-900 dark:text-blue-300';
    if (issues.has(IssueType.PotentialDefinitionNeeded)) return 'bg-green-200/60 dark:bg-green-500/30 text-green-900 dark:text-green-300';
    return 'bg-teal-100/60 dark:bg-cyan-500/20 text-teal-900 dark:text-cyan-300'; // Standard defined term
};
