

import { 
    AnalysisResult, 
    Definition, 
    Usage, 
    IssueType, 
    RawDefinition, 
    RawUsage, 
    DuplicateResolution,
    Classification,
    Paragraph,
    Suggestion,
    RawSuggestion,
    ModelProviderId,
    RawCrossReference,
    CrossReference,
    NumberingDiscrepancy,
    NumberingIssueType
} from '../types';
import { ApiResponseSchema, ApiResponse, ApiErrorBody, AbstractNum } from '../types/api';
import JSZip from 'jszip';
import { GoogleGenAI, Type } from "@google/genai";


const API_CALL_BATCH_SIZE = 5;
const PARAGRAPHS_PER_CHUNK = 10; // Balance context size and API call granularity
const TWIPS_PER_REM = 12 * 20; // Default: 12pt font size * 20 twips/pt

export class AnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisError';
  }
}

function formatApiError(errorBody: ApiErrorBody, context: string): string {
    console.error(`Error in ${context}:`, errorBody);
    const message = errorBody?.error?.message || 'An unknown API error occurred.';
    
    if (message.includes('API key not valid') || message.includes('Incorrect API key')) {
        return 'Authentication failed: The provided API Key is not valid.';
    }
    if (message.includes('quota')) {
        return 'API quota exceeded. Please check your billing status and plan details.';
    }

    return `Error during ${context}: ${message}`;
}


export async function validateApiKey(apiKey: string, provider: ModelProviderId, model: string): Promise<void> {
    if (provider === 'gemini') {
        try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: model,
                contents: "Just say the word Working",
                config: {
                    temperature: 0,
                }
            });

            if (response.text.trim() !== 'Working') {
                 const prettyResponse = JSON.stringify(response, null, 2);
                 throw new Error(`API call succeeded, but the model returned an unexpected response. Expected "Working", but got:\n${prettyResponse}`);
            }
        } catch (e: unknown) {
             if (e.message.includes('Failed to fetch')) {
                 throw new AnalysisError('Network error. Check your internet connection and any browser extensions that might block requests (e.g., ad-blockers).');
             }
             // Attempt to parse the error for a more specific message
             try {
                const errorJson = JSON.parse(e.message);
                throw new AnalysisError(formatApiError(errorJson, "API key validation"));
             } catch (parseError) {
                throw new AnalysisError(e.message || "An unknown error occurred during API key validation.");
             }
        }
    } else if (provider === 'openai') {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ "role": "user", "content": "Just say the word Working" }],
                    max_tokens: 5,
                    temperature: 0,
                })
            });
    
            const data = await response.json();
    
            if (!response.ok) {
                // The API returns a JSON error body, so we stringify it to pass to the handler.
                throw new Error(JSON.stringify(data));
            }
    
            const message = data.choices?.[0]?.message?.content?.trim();
            if (message !== 'Working') {
                 const prettyResponse = JSON.stringify(data, null, 2);
                 throw new Error(`API call succeeded, but the model returned an unexpected response. Expected "Working", but got:\n${prettyResponse}`);
            }
        } catch (e: unknown) {
             if (e.message.includes('Failed to fetch')) {
                 throw new AnalysisError('Network error. Check your internet connection and any browser extensions that might block requests (e.g., ad-blockers).');
             }
             // Attempt to parse the error for a more specific message, then fall back to the raw message.
             try {
                const errorJson = JSON.parse(e.message);
                throw new AnalysisError(formatApiError(errorJson, "API key validation"));
             } catch (parseError) {
                throw new AnalysisError(e.message || "An unknown error occurred during API key validation.");
             }
        }
    } else {
        throw new AnalysisError(`API Key validation for provider '${provider}' is not supported.`);
    }
}


export class ContractAnalyzer {
  private apiKey: string;
  private provider: ModelProviderId;
  private model: string;
  private ai: GoogleGenAI | null = null;

  constructor(apiKey: string, provider: ModelProviderId, model: string) {
    if (!apiKey) {
      throw new AnalysisError('API Key is missing. Please provide a valid API Key.');
    }
    this.apiKey = apiKey;
    this.provider = provider;
    this.model = model;

    if (this.provider === 'gemini') {
        this.ai = new GoogleGenAI({apiKey: this.apiKey});
    }
  }

  private async callApi(systemMessage: string, userMessage: string, responseSchema: ApiResponseSchema): Promise<ApiResponse> {
    if (this.provider === 'gemini' && this.ai) {
        const response = await this.ai.models.generateContent({
            model: this.model,
            contents: userMessage,
            config: {
                systemInstruction: systemMessage,
                temperature: 0.1,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });
        
        // The response.text is already a stringified JSON due to responseMimeType
        return JSON.parse(response.text);

    } else if (this.provider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.1,
                // Use JSON mode to ensure the output is a valid JSON object.
                response_format: { type: 'json_object' } 
            })
        });

        const data = await response.json();

        if (!response.ok) {
             throw new Error(JSON.stringify(data)); // Throw with body for the handler
        }

        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            // Handle cases where the response might be empty or malformed
            throw new Error('API returned an empty or malformed response content.');
        }

        // The content is a JSON string due to json_object mode, so parse it.
        return JSON.parse(content);

    } else {
        throw new Error(`Unsupported provider or AI client not initialized: ${this.provider}`);
    }
  }

  private handleApiError(e: unknown, context: string): never {
      // Handle network errors first
      if (e instanceof Error && e.message?.includes('Failed to fetch')) {
        throw new AnalysisError(
            `Network error during ${context}. This can be caused by a few things:\n\n` +
            `1. Your internet connection is down.\n` +
            `2. An ad-blocker or privacy extension in your browser is blocking the request.\n` +
            `3. A firewall or corporate network policy is preventing the connection.\n\n` +
            `Please check your connection and disable any ad-blockers for this site, then try again.`
        );
      }

      let errorBody: ApiErrorBody | null = null;
      if (e instanceof Error && e.message) {
          try {
              // Standard errors might have a JSON string in their message.
              errorBody = JSON.parse(e.message) as ApiErrorBody;
          } catch (parseError) {
              // If not, the message is a plain text error.
              throw new AnalysisError(`An error occurred during ${context}: ${e.message}`);
          }
      } else if (typeof e === 'object' && e !== null) {
          // The error could be the JSON body itself.
          errorBody = e as ApiErrorBody;
      }

      if (errorBody) {
          const message = formatApiError(errorBody, context);
          throw new AnalysisError(message);
      }
      
      // Fallback for primitive or other unexpected error types
      throw new AnalysisError(`An unexpected error occurred during ${context}: ${String(e)}`);
  }

  private numToAlpha(n: number): string {
    let s = '';
    while (n > 0) {
        const t = (n - 1) % 26;
        s = String.fromCharCode(97 + t) + s;
        n = Math.floor((n - t) / 26);
    }
    return s;
  }

  private numToRoman(num: number): string {
      const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
      let str = '';
      for (const i of Object.keys(roman)) {
          const q = Math.floor(num / roman[i as keyof typeof roman]);
          num -= q * roman[i as keyof typeof roman];
          str += i.repeat(q);
      }
      return str;
  }
  
  private formatNumber(count: number, format: string): string {
      switch (format) {
          case 'lowerLetter': return this.numToAlpha(count);
          case 'upperLetter': return this.numToAlpha(count).toUpperCase();
          case 'lowerRoman': return this.numToRoman(count).toLowerCase();
          case 'upperRoman': return this.numToRoman(count);
          case 'bullet': return '•';
          default: return String(count);
      }
  }

  private formatLabel(lvlText: string, counters: number[], level: number, abstractNum: AbstractNum): string {
      let formattedLabel = lvlText;
      for (let i = 0; i <= level; i++) {
          const lvlDef = abstractNum.levels.get(String(i));
          if (!lvlDef) continue;
          
          const count = counters[i] || parseInt(lvlDef.start, 10);
          const formattedCount = this.formatNumber(count, lvlDef.numFmt);
          formattedLabel = formattedLabel.replace(`%${i + 1}`, formattedCount);
      }
      return formattedLabel;
  }
  
  private twipsToRem(twips: number | null | undefined): string {
    if (twips === null || twips === undefined) return '0rem';
    return `${(twips / TWIPS_PER_REM).toFixed(3)}rem`;
  }

  private async parseDocx(file: File, documentId: string): Promise<{ paragraphs: Paragraph[], numberingDiscrepancies: NumberingDiscrepancy[], maxLevel: number }> {
    // Use Aspose backend for parsing
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('documentId', documentId);
    const response = await fetch('http://localhost:5192/parse-docx', {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new AnalysisError(`Backend parse failed: ${errorText}`);
    }
    const data = await response.json();
    // The backend now returns { paragraphs, numberingDiscrepancies, maxLevel }
    const numberingDiscrepancies: NumberingDiscrepancy[] = (data.numberingDiscrepancies || []).map((disc: any) => ({
      type: disc.type as NumberingIssueType,
      paragraphId: disc.paragraphId,
      documentId: disc.documentId,
      details: disc.details
    }));
    
    // Ensure all paragraphs have the correct documentId
    const paragraphs: Paragraph[] = (data.paragraphs || []).map((para: any) => ({
      ...para,
      documentId: documentId // Ensure consistent documentId
    }));
    
    return {
      paragraphs,
      numberingDiscrepancies,
      maxLevel: data.maxLevel || 0
    };
  }


  private async processInBatches<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number,
    progressMessage: string,
    onProgress: (message: string) => void
  ): Promise<R[]> {
    let allResults: R[] = [];
    onProgress(`${progressMessage} (0/${items.length})`);
    for (let i = 0; i < items.length; i += batchSize) {
      const batchItems = items.slice(i, i + batchSize);
      const batchPromises = batchItems.map(processor);
      const batchResults = await Promise.all(batchPromises);
      allResults = allResults.concat(batchResults);
      onProgress(`${progressMessage} (${Math.min(i + batchSize, items.length)}/${items.length})`);
    }
    return allResults;
  }
  
  private async extractDefinitions(chunk: {text: string}): Promise<RawDefinition[]> {
    const systemMessage = `You are an expert at extracting definitions from legal contracts. You will be given a chunk of text containing multiple paragraphs, each prefixed with an ID like [para-N].
The "paragraphId" for each definition MUST be the ID (e.g., "para-N") of the paragraph where the definition was found.
CRITICAL: A single paragraph can contain MULTIPLE definitions. You MUST extract all of them.

Instructions:
1.  **Identify ALL Definitions:** Scrutinize the text for every instance of a definition. Common patterns include, but are not limited to:
    a) **Dedicated Clause:** A term in quotes or ALL-CAPS followed by "means", "shall mean", or a colon. Example: \`"Agreement" means this document.\`
    b) **Inline Parenthetical:** A term defined within parentheses. This is a very high-priority pattern.
       - Simple: \`...the specified services ("Services").\` -> term_raw: "Services", def_text: "the specified services"
       - With "hereinafter": \`...Renesas Electronics Corporation (hereinafter, "Renesas").\` -> term_raw: "Renesas", def_text: "Renesas Electronics Corporation"
       - With "the": \`...the entire effort (the "Project").\` -> term_raw: "Project", def_text: "the entire effort"
       - **CRITICAL:** Extract *every single one* of these patterns, even if multiple appear in one sentence.
    c) **Acronym:** A full name followed by an acronym in parentheses. Example: \`World Health Organization (WHO).\` -> term_raw: "WHO", def_text: "World Health Organization"

2.  **Determine Definition Text (\`def_text\`):**
    *   For inline definitions, the \`def_text\` is the phrase immediately preceding the parenthetical definition. Be careful to capture the full, correct phrase.
    *   For "means" clauses, it's the text following the "means".

3.  **Normalize Term (\`term_canonical\`):**
    *   Strip quotes and punctuation.
    *   Lowercase.
    *   Singularize (e.g., "Agreements" becomes "agreement").
    *   Remove leading "the" or trailing possessive "'s".

4.  **Handle Edge Cases:**
    *   Do not get confused if the definition text itself contains another defined term. Focus on correctly pairing each term with its definition text.
    *   Ignore false positives like headings, page headers, or lists of contents. Your final response must be a JSON object structured as { "definitions": [...] }.`;
    const userMessage = `CONTRACT_CHUNK:\n${chunk.text}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            definitions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        term_raw: { type: Type.STRING },
                        term_canonical: { type: Type.STRING },
                        def_text: { type: Type.STRING },
                        paragraphId: { type: Type.STRING },
                        is_inline: { type: Type.BOOLEAN },
                    },
                    required: ["term_raw", "term_canonical", "def_text", "paragraphId", "is_inline"]
                }
            }
        }
    };

    try {
        const parsedJson = await this.callApi(systemMessage, userMessage, schema);
        if (parsedJson.definitions && Array.isArray(parsedJson.definitions)) {
            return parsedJson.definitions;
        }
        return [];
    } catch (e) {
        this.handleApiError(e, "definition extraction");
    }
  }
  
  private async scanTermUsages(chunk: { text: string }, knownTerms: string[]): Promise<RawUsage[]> {
    const systemMessage = `You are an expert legal tech AI. Your task is to scan legal contract text for defined term usages and identify capitalization issues (case drift).
The "paragraphId" for each usage MUST be the ID (e.g., "para-N") of the paragraph where the usage was found.
The "classification" must be one of: "Defined", "Undefined", "Acronym", "Noise".
\`is_case_drift\` is a boolean.

Instructions for Analysis:
1.  **Find Candidates:** First, identify all potential term candidates in the text. There are two categories:
    a.  **Known Term Matches:** Find every occurrence of a term from the KNOWN_TERMS list. This search must be case-insensitive.
    b.  **Other Capitalized Phrases:** Find any capitalized word or 2-4 word capitalized phrase that was NOT matched in step 1a.

2.  **Process and Classify Each Candidate:** For every candidate identified, perform the following steps:
    *   **CRITICAL: Extract Sentence Context:** You MUST extract the full sentence in which the candidate term appears. This is required for the \`sentence\` field in the final JSON output. If you cannot determine the full sentence, do not report the usage.
    *   **For Known Term Matches (from 1a):**
        *   \`classification\`: "Defined".
        *   \`token\`: The exact text from the document (e.g., "Agreement", "agreement").
        *   \`canonical\`: The matching term from KNOWN_TERMS (e.g., "agreement").
        *   \`is_case_drift\`: This requires contextual analysis. Set to \`true\` **only if** the \`token\` is all-lowercase, not the first word of its sentence, AND it is clearly being used as a specific substitute for the capitalized, defined term.
        *   **CRITICAL CONTEXT RULE:** Do **NOT** flag case drift if the lowercase word is used as a common noun. Common noun usage often occurs in general lists or generic contexts.
            *   **Example of a false positive to AVOID:** In a phrase like "...any of their respective former, existing and prospective Personnel, clients, **suppliers** and other counterparties...", the word "suppliers" is part of a general list. Even if "Supplier" is a defined term, this usage is a common noun. Therefore, \`is_case_drift\` MUST be \`false\`.
            *   **Example of a TRUE positive to CATCH:** In a phrase like "...the **agreement** shall be terminated...", where "Agreement" is a defined term, this is a direct, specific reference. Therefore, \`is_case_drift\` SHOULD be \`true\`.

    *   **For Other Capitalized Phrases (from 1b):**
        *   **CRITICAL RULE:** For any term candidate that is NOT a "Known Term Match", its \`is_case_drift\` value MUST ALWAYS be \`false\`. Case drift is an issue that can only apply to defined terms.
        *   **CRITICAL: Identify and Ignore Headings:** First, check if the candidate is part of a structural heading. Headings are capitalized phrases at the beginning of a paragraph, often ending in a period. They should be classified as **"Noise"** and ignored. This is crucial for avoiding false positives.
            *   **Simple Heading Example:** \`No Commitment. This Agreement...\` -> \`No Commitment\` is a heading. Ignore it.
            *   **Complex Heading Example:** \`Warranties and Disclaimers. Each party...\` -> This entire phrase is a heading. The AI must recognize this and not flag \`Warranties\` or \`Disclaimers\` as undefined terms.
        *   **CRITICAL: AVOID FALSE POSITIVES IN DEFINITION CONTEXTS.** Do not flag a capitalized phrase as "Undefined" if it is part of the explanatory text that defines another term within the same sentence (e.g., in a parenthetical definition).
            *   **Example to IGNORE:** In \`THIS NONDISCLOSURE AGREEMENT (this “Agreement”)\`, the phrase "NONDISCLOSURE AGREEMENT" is part of the definition for the term "Agreement". You must NOT report "NONDISCLOSURE AGREEMENT" as an undefined term. Your role is to find *usages* of terms, not analyze the text that constitutes a definition itself.
            *   **Example to CATCH:** In \`...pursuant to the Master Services Agreement.\`, if \`Master Services Agreement\` is not a known term, it SHOULD be flagged as "Undefined".
        *   If the phrase is a capitalized word/phrase that looks like a defined term but is NOT in KNOWN_TERMS (and not a heading or part of a definition context as described above), classify it as "Undefined".
        *   If the phrase is an acronym (e.g., "NDA"), classify as "Acronym".
        *   If the phrase is capitalized only because it starts a sentence, or is boilerplate ("WHEREAS"), classify as "Noise".
        *   For "Undefined" classification, the \`canonical\` should be a lowercase, singular version of the \`token\`. For "Noise" and "Acronym", \`canonical\` can be \`null\`.

3.  **Final Output:** Collate all processed candidates into the "usages" array. Do not include "Noise" candidates. Only report on meaningful usages. Your final response must be a JSON object structured as { "usages": [...] }.`;
    const userMessage = `KNOWN_TERMS (canonical): ["${knownTerms.join('", "')}"]\n\nCONTRACT_CHUNK:\n${chunk.text}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            usages: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        token: { type: Type.STRING },
                        canonical: { type: Type.STRING, nullable: true },
                        sentence: { type: Type.STRING },
                        paragraphId: { type: Type.STRING },
                        classification: { type: Type.STRING, enum: ["Defined", "Undefined", "Acronym", "Noise"] },
                        is_case_drift: { type: Type.BOOLEAN },
                    },
                    required: ["token", "sentence", "paragraphId", "classification", "is_case_drift"]
                }
            }
        }
    };

    try {
        const parsedJson = await this.callApi(systemMessage, userMessage, schema);
        if (parsedJson.usages && Array.isArray(parsedJson.usages)) {
            // Post-filter to be absolutely sure no noise is returned
            return parsedJson.usages.filter((u: RawUsage) => u.classification !== 'Noise');
        }
        return [];
    } catch(e) {
        this.handleApiError(e, "scanning term usages");
    }
  }

   private async findImplicitDefinitions(chunk: { text: string }, knownTerms: string[]): Promise<RawSuggestion[]> {
    const systemMessage = `You are an expert legal tech AI specializing in contract analysis. Your task is to identify common, non-capitalized words or short phrases within a legal document that, based on their context, appear to be used with a specific, recurring, and critical meaning, suggesting they should have been formally defined. Your goal is to flag potential ambiguities that arise from these missing definitions.
"paragraphId" MUST be the ID of the paragraph (e.g., "para-N") where the term was found.
"sentence" MUST be the full sentence where the term appears.
"reasoning" MUST be a concise explanation (1-2 sentences) of why this term's usage is specific and warrants a formal definition.

Instructions:
1.  **Candidate List:** Focus your analysis primarily on the following list of common legal/business terms: [agreement, affiliate, claim, confidential information, control, damages, deliverables, dispute, effective date, expenses, force majeure, indemnified parties, intellectual property, law, liability, losses, party/parties, person, products, purpose, representatives, services, taxes, term, territory, third party].
2.  **Context is Key:** Do NOT flag every occurrence of these words. You must analyze the context to determine if the word is being used in a generic sense or as a specific, de facto defined term.
    *   **FLAG** if the term is used to confer specific rights, obligations, or limitations that seem unique to this contract. Example: "Consultant shall provide the Services as described in Exhibit A." (Here, "Services" clearly refers to a specific set of deliverables, not just any services).
    *   **IGNORE** if the term is used in its common, everyday sense. Example: "This agreement represents the entire understanding." (Here, "agreement" is used generically).
    *   **IGNORE** if the term is part of a general list or a common legal phrase not specific to the contract's substance. Example: "...including but not limited to any claims, damages, or losses."
3.  **CRITICAL RULE:** You will be provided a list of KNOWN_TERMS that are already formally defined. You **MUST NOT** suggest any term from this list. Double-check your suggestions against this list before finalizing the output.
4.  **Output Format:** If no such terms are found, return an empty "suggestions" array. Your final response must be a JSON object structured as { "suggestions": [...] }.`;
    
    const userMessage = `KNOWN_TERMS (already defined, do not report these): ["${knownTerms.join('", "')}"]\n\nCONTRACT_CHUNK:\n${chunk.text}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            suggestions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        term: { type: Type.STRING },
                        paragraphId: { type: Type.STRING },
                        sentence: { type: Type.STRING },
                        reasoning: { type: Type.STRING },
                    },
                    required: ["term", "paragraphId", "sentence", "reasoning"]
                }
            }
        }
    };

    try {
        const parsedJson = await this.callApi(systemMessage, userMessage, schema);
        return parsedJson.suggestions || [];
    } catch(e) {
        this.handleApiError(e, "finding implicit definitions");
    }
  }

  private async findCrossReferences(chunk: { text: string }): Promise<RawCrossReference[]> {
    const systemMessage = `You are an expert at identifying cross-references within legal contracts. Your task is to extract all phrases that refer to other parts of the document.
The "paragraphId" for each reference MUST be the ID (e.g., "para-N") of the paragraph where it was found.

Instructions:
1.  **Identify All Cross-References:** Scan the text for any phrases that refer to sections, articles, exhibits, schedules, clauses, or other parts of the contract.
2.  **Common Patterns to Look For:**
    *   Section references: "Section 1.2", "in accordance with Section 5", "Article V", "Clause 3(a)"
    *   Exhibit/Schedule references: "as defined in Exhibit A", "Schedule B", "Attachment 1"
    *   General references: "hereto", "herein", "hereof", "the preceding paragraph"
3.  **Extract Key Information:** For each reference found, extract:
    *   \`token\`: The exact text of the reference (e.g., "Section 1.2").
    *   \`sentence\`: The full sentence in which the reference appears.
    *   \`paragraphId\`: The ID of the paragraph containing the reference.
4.  **Output Format:** Your final response must be a JSON object structured as { "references": [...] }. If no references are found, return an empty array.`;
    const userMessage = `CONTRACT_CHUNK:\n${chunk.text}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            references: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        token: { type: Type.STRING },
                        sentence: { type: Type.STRING },
                        paragraphId: { type: Type.STRING },
                    },
                    required: ["token", "sentence", "paragraphId"]
                }
            }
        }
    };

    try {
        const parsedJson = await this.callApi(systemMessage, userMessage, schema);
        return parsedJson.references || [];
    } catch(e) {
        this.handleApiError(e, "finding cross-references");
    }
  }

  private async resolveDuplicates(term: string, definitions: { def_text: string, paragraphId: string }[]): Promise<DuplicateResolution> {
      const defsText = definitions.map((d, i) => `${i+1}. ${d.def_text} (in ${d.paragraphId})`).join('\n');
      const systemMessage = `You decide whether multiple definitions of the same term conflict. Your response must be a JSON object with 'conflict', and 'notes' properties.`;
      const userMessage = `TERM: ${term}\n\nDEFINITIONS:\n${defsText}`;
      const schema = {
          type: Type.OBJECT,
          properties: {
              conflict: { type: Type.BOOLEAN },
              notes: { type: Type.STRING },
          },
          required: ["conflict", "notes"]
      };
      
      try {
          return await this.callApi(systemMessage, userMessage, schema);
      } catch(e: unknown) {
          console.error("Error in resolveDuplicates:", e);
          this.handleApiError(e, "duplicate resolution");
      }
  }
  
  private compareLocators(locA: string, locB: string): number {
      const numA = parseInt(locA.replace('para-', ''), 10);
      const numB = parseInt(locB.replace('para-', ''), 10);
      if (isNaN(numA) || isNaN(numB)) return locA.localeCompare(locB);
      return numA - numB;
  }

  public async analyzeContract(file: File, documentId: string, onProgress: (message: string) => void): Promise<AnalysisResult> {
    onProgress('Step 1/5: Parsing document and checking numbering...');
    const { paragraphs, numberingDiscrepancies, maxLevel } = await this.parseDocx(file, documentId);
    if (paragraphs.length === 0) {
        throw new AnalysisError("Could not parse any text or paragraphs from the document. The file might be empty, password-protected, or in an unsupported format.");
    }

    const paragraphChunks: { text: string }[] = [];
    for (let i = 0; i < paragraphs.length; i += PARAGRAPHS_PER_CHUNK) {
        const chunkParagraphs = paragraphs.slice(i, i + PARAGRAPHS_PER_CHUNK);
        const chunkText = chunkParagraphs.map(p => `[${p.id}] ${p.text}`).join('\n\n');
        paragraphChunks.push({ text: chunkText });
    }
    
    // Step 2: Extract Definitions
    const rawDefsByChunk = await this.processInBatches(
      paragraphChunks,
      chunk => this.extractDefinitions(chunk),
      API_CALL_BATCH_SIZE,
      'Step 2/5: Extracting definitions',
      onProgress
    );
    
    const definitionMap = new Map<string, Definition[]>();
    rawDefsByChunk.flat().forEach(rawDef => {
        if (!rawDef.term_canonical) return;
        const def: Definition = { ...rawDef, documentId, issues: [] };
        const existing = definitionMap.get(def.term_canonical) || [];
        if (!existing.some(d => d.def_text === def.def_text && d.paragraphId === def.paragraphId)) {
            definitionMap.set(def.term_canonical, [...existing, def]);
        }
    });

    // Step 3: Run parallel analysis
    onProgress('Step 3/5: Analyzing usages, duplicates, and suggestions in parallel...');
    const knownTerms = Array.from(definitionMap.keys());
    const knownTermsLowercase = knownTerms.map(t => t.toLowerCase());

    // Task A: Find duplicates
    const duplicateTasks: { canonical: string; defs: { def_text: string, paragraphId: string }[] }[] = [];
    for(const [canonical, defs] of definitionMap.entries()) {
        if(defs.length > 1) {
            duplicateTasks.push({ canonical, defs });
        }
    }
    const duplicatesPromise = duplicateTasks.length > 0
      ? this.processInBatches(
          duplicateTasks,
          task => this.resolveDuplicates(task.canonical, task.defs).then(res => ({ ...res, canonical: task.canonical })),
          API_CALL_BATCH_SIZE,
          'Resolving duplicates',
          () => {} // Suppress sub-progress
        )
      : Promise.resolve([]);
      
    // Task B: Scan for usages
    const usagesPromise = this.processInBatches(
        paragraphChunks,
        chunk => this.scanTermUsages(chunk, knownTerms),
        API_CALL_BATCH_SIZE,
        'Scanning for term usages',
        () => {} // Suppress sub-progress
    );

    // Task C: Scan for suggestions
    const suggestionsPromise = this.processInBatches(
        paragraphChunks,
        chunk => this.findImplicitDefinitions(chunk, knownTerms),
        API_CALL_BATCH_SIZE,
        'Finding implicit definitions',
        () => {} // Suppress sub-progress
    );

    // Task D: Find Cross-references
    const crossReferencesPromise = this.processInBatches(
        paragraphChunks,
        chunk => this.findCrossReferences(chunk),
        API_CALL_BATCH_SIZE,
        'Finding cross-references',
        () => {} // Suppress sub-progress
    );

    // Await parallel tasks
    const [resolutions, rawUsagesByChunk, rawSuggestionsByChunk, rawCrossReferencesByChunk] = await Promise.all([
        duplicatesPromise,
        usagesPromise,
        suggestionsPromise,
        crossReferencesPromise,
    ]);
    
    // Step 4: Finalize Report
    onProgress('Step 4/5: Cross-linking and finalizing report...');

    // Process results from parallel tasks
    resolutions.forEach((resolution) => {
        const defs = definitionMap.get(resolution.canonical);
        if (defs) {
            if (resolution.conflict) {
                defs.forEach(d => d.issues.push(IssueType.Conflict, IssueType.Duplicate));
            } else {
                 defs.forEach(d => d.issues.push(IssueType.Duplicate));
            }
        }
    });

    const allDefinitions = Array.from(definitionMap.values()).flat();
    const allCrossReferences = rawCrossReferencesByChunk.flat().map(rawCrossRef => ({ ...rawCrossRef, documentId }));
    
    // Filter out suggestions for terms that are already defined as a safety measure
    const allSuggestions = rawSuggestionsByChunk.flat()
        .filter(s => !knownTermsLowercase.includes(s.term.toLowerCase()))
        .map(rawSuggestion => ({ ...rawSuggestion, documentId }));

    let allUsages: Usage[] = rawUsagesByChunk.flat().map(rawUsage => ({
        ...rawUsage,
        documentId,
        def_locator: null,
        issues: []
    }));

    // Filter out cross-references that were misclassified as undefined terms
    const crossReferenceTokens = new Set(allCrossReferences.map(cr => cr.token));
    allUsages = allUsages.filter(usage => {
        if (usage.classification === Classification.Undefined && crossReferenceTokens.has(usage.token)) {
            return false; // Remove this usage
        }
        return true;
    });

    // Step 5: Final cross-linking
    onProgress('Step 5/5: Performing final analysis...');
    const definitionLocatorMap = new Map<string, string>();
    allDefinitions.forEach(def => {
        if (!definitionLocatorMap.has(def.term_canonical)) {
            definitionLocatorMap.set(def.term_canonical, def.paragraphId);
        }
    });

    const usedCanonicals = new Set<string>();

    allUsages.forEach(usage => {
        if (usage.classification === Classification.Defined && usage.canonical) {
            usedCanonicals.add(usage.canonical);
            const defLocator = definitionLocatorMap.get(usage.canonical);
            if (defLocator) {
                usage.def_locator = defLocator;

                if (this.compareLocators(usage.paragraphId, defLocator) < 0) {
                    usage.issues.push(IssueType.UseBeforeDefine);
                }
            }
        } else if (usage.classification === Classification.Undefined) {
            usage.issues.push(IssueType.MissingDefinition);
        }
        
        if (usage.is_case_drift) {
            usage.issues.push(IssueType.CaseDrift);
        }
    });
    
    allDefinitions.forEach(def => {
        if (!usedCanonicals.has(def.term_canonical)) {
            def.issues.push(IssueType.UnusedTerm);
        }
    });

    return { paragraphs, definitions: allDefinitions, usages: allUsages, suggestions: allSuggestions, crossReferences: allCrossReferences, numberingDiscrepancies, maxLevel, documentId };
  }
}