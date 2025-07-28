







export enum IssueType {
  Duplicate = "duplicate",
  CaseDrift = "case_drift",
  MissingDefinition = "missing_definition",
  UnusedTerm = "unused_term",
  UseBeforeDefine = "use_before_define",
  Conflict = "conflict",
  PotentialDefinitionNeeded = "potential_definition_needed",
}

export enum NumberingIssueType {
    Skipped = "skipped",
    Manual = "manual",
    Inconsistent = "inconsistent",
}

export enum Classification {
    Defined = "Defined",
    Undefined = "Undefined",
    Acronym = "Acronym",
    Noise = "Noise",
}

export type ModelProviderId = 'gemini' | 'openai';

export interface Model {
    id: string;
    name: string;
    description: string;
}

export interface Provider {
    id: ModelProviderId;
    name: string;
    apiKeyName: string;
    models: Model[];
    Icon: React.FC<{ className?: string }>;
}

export interface Paragraph {
  id: string;
  text: string;
  clause: string;
  numLabel: string;
  level: number | null;
  documentId: string;
  indent?: {
    left: string;
    hanging: string;
  };
}

export interface Definition {
  term_raw: string;
  term_canonical: string;
  def_text: string;
  paragraphId: string;
  documentId: string;
  is_inline: boolean;
  issues: IssueType[];
}

export interface Usage {
  token: string;
  canonical: string | null;
  sentence: string;
  paragraphId: string;
  documentId: string;
  classification: Classification;
  def_locator: string | null;
  is_case_drift: boolean;
  issues: IssueType[];
}

export interface Suggestion {
    term: string;
    paragraphId: string;
    documentId: string;
    sentence: string;
    reasoning: string;
}

export interface CrossReference {
    token: string;
    sentence: string;
    paragraphId: string;
    documentId: string;
}

export interface NumberingDiscrepancy {
    type: NumberingIssueType;
    paragraphId: string;
    documentId: string;
    details: string;
}

export interface DocumentMetadata {
  id: string;
  name: string;
  size: number;
  uploadedAt: Date;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  progress?: string;
  error?: string;
}

export interface AnalysisResult {
  paragraphs: Paragraph[];
  definitions: Definition[];
  usages: Usage[];
  suggestions: Suggestion[];
  crossReferences: CrossReference[];
  numberingDiscrepancies: NumberingDiscrepancy[];
  maxLevel: number;
  documentId: string;
}

export interface MultiDocumentAnalysisResult {
  documents: DocumentMetadata[];
  results: Map<string, AnalysisResult>;
  activeDocumentId: string | null;
}

// New grouped types for UI
export interface GroupedDefinition {
    canonical: string;
    allDefs: Definition[];
    allUsages: Usage[];
    issues: IssueType[];
    documentIds: string[]; // Track which documents this term appears in
}

export interface UndefinedTermGroup {
    token: string;
    usages: Usage[];
    issues: IssueType[];
    documentIds: string[]; // Track which documents this term appears in
}

export interface SummaryCounts {
    definitions: number;
    undefinedTerms: number;
    suggestions: number;
    crossReferences: number;
    numberingDiscrepancies: number;
    issues: Record<IssueType, number>;
    totalIssues: number;
    documentsAnalyzed: number;
}

export interface DocumentTab {
    id: string;
    name: string;
    status: DocumentMetadata['status'];
    hasResults: boolean;
}


// Types for Gemini API responses
// These are intermediate types, the final types are above.
export interface RawDefinition {
    term_raw: string;
    term_canonical: string;
    def_text: string;
    paragraphId: string;
    is_inline: boolean;
}

export interface RawUsage {
    token: string;
    canonical: string | null;
    sentence: string;
    paragraphId: string;
    classification: Classification;
    is_case_drift: boolean;
}

export interface RawSuggestion {
    term: string;
    paragraphId: string;
    sentence: string;
    reasoning: string;
}

export interface RawCrossReference {
    token: string;
    sentence: string;
    paragraphId: string;
}

export interface DuplicateResolution {
    conflict: boolean;
    notes: string;
}