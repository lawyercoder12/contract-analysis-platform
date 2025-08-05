

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
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";


const API_CALL_BATCH_SIZE = 5;
const PARAGRAPHS_PER_CHUNK = 10; // Balance context size and API call granularity
const TWIPS_PER_REM = 12 * 20; // Default: 12pt font size * 20 twips/pt

// Retry configuration for robust error handling
const RETRY_CONFIG = {
  MAX_RETRIES: 5,
  INITIAL_DELAY: 1000, // 1 second
  MAX_DELAY: 30000, // 30 seconds
  BACKOFF_MULTIPLIER: 2,
  JITTER_FACTOR: 0.1, // 10% jitter to prevent thundering herd
} as const;

// Error types that should trigger retries
const RETRYABLE_ERRORS = [
  'rate_limit_exceeded',
  'quota_exceeded', 
  'server_error',
  'internal_server_error',
  'service_unavailable',
  'bad_gateway',
  'gateway_timeout',
  'timeout',
  'network_error',
  'connection_error',
  'empty response',
  'malformed response',
  'json parse error',
  'property name must be a string literal'
] as const;

export class AnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisError';
  }
}

// Retry utility functions
function calculateDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.INITIAL_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt),
    RETRY_CONFIG.MAX_DELAY
  );
  
  // Add jitter to prevent thundering herd
  const jitter = delay * RETRY_CONFIG.JITTER_FACTOR * (Math.random() - 0.5);
  return Math.max(delay + jitter, 100); // Minimum 100ms delay
}

function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || error.error?.message || '';
  const errorType = error.error?.type || error.type || '';
  const statusCode = error.status || error.statusCode;
  
  // Check for retryable HTTP status codes
  if (statusCode >= 500 || statusCode === 429) return true;
  
  // Check for retryable error types
  const lowerMessage = errorMessage.toLowerCase();
  const lowerType = errorType.toLowerCase();
  
  return RETRYABLE_ERRORS.some(retryableError => 
    lowerMessage.includes(retryableError) || lowerType.includes(retryableError)
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  provider: ModelProviderId
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry for non-retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // Don't retry for authentication errors
      if (error?.message?.includes('API key not valid') || 
          error?.message?.includes('Incorrect API key') ||
          error?.error?.message?.includes('API key not valid') ||
          error?.error?.message?.includes('Incorrect API key')) {
        throw error;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === RETRY_CONFIG.MAX_RETRIES) {
        console.error(`Failed after ${RETRY_CONFIG.MAX_RETRIES + 1} attempts for ${context}:`, error);
        throw error;
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt);
      console.warn(`Attempt ${attempt + 1} failed for ${context} (${provider}). Retrying in ${Math.round(delay)}ms...`, error?.message || error);
      
      await sleep(delay);
    }
  }
  
  throw lastError;
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

            if (response.text?.trim() !== 'Working') {
                 const prettyResponse = JSON.stringify(response, null, 2);
                 throw new Error(`API call succeeded, but the model returned an unexpected response. Expected "Working", but got:\n${prettyResponse}`);
            }
        } catch (e: unknown) {
             if (e instanceof Error && e.message?.includes('Failed to fetch')) {
                 throw new AnalysisError('Network error. Check your internet connection and any browser extensions that might block requests (e.g., ad-blockers).');
             }
             // Attempt to parse the error for a more specific message
             try {
                const errorJson = JSON.parse(e instanceof Error ? e.message : String(e));
                throw new AnalysisError(formatApiError(errorJson, "API key validation"));
             } catch (parseError) {
                throw new AnalysisError(e instanceof Error ? e.message : String(e) || "An unknown error occurred during API key validation.");
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
    } else if (provider === 'llama') {
        if (model === 'llama-3.3-70b-bedrock') {
            // Validate Bedrock credentials via API route
            await withRetry(async () => {
                const response = await fetch('/api/bedrock/invoke', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        systemMessage: 'You are a helpful assistant. Respond with exactly the word "Working" and nothing else.',
                        userMessage: 'Just say the word Working'
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(JSON.stringify(data));
                }

                const content = data.trim();
                if (content !== 'Working') {
                    const prettyResponse = JSON.stringify(data, null, 2);
                    throw new Error(`API call succeeded, but the model returned an unexpected response. Expected "Working", but got:\n${prettyResponse}`);
                }
            }, 'API key validation', provider);
        } else if (model === 'llama-3.3-70b-watsonx') {
            // Validate WatsonX API key
            await withRetry(async () => {
                const response = await fetch('https://us-south.ml.cloud.ibm.com/ml/v1/text/generation', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        model_id: 'meta-llama/llama-3.3-70b-instruct',
                        input: {
                            messages: [
                                { role: 'user', content: 'Just say the word Working' }
                            ]
                        },
                        parameters: {
                            temperature: 0,
                            max_new_tokens: 5
                        }
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(JSON.stringify(data));
                }

                const content = data.results?.[0]?.generated_text?.trim();
                if (content !== 'Working') {
                    const prettyResponse = JSON.stringify(data, null, 2);
                    throw new Error(`API call succeeded, but the model returned an unexpected response. Expected "Working", but got:\n${prettyResponse}`);
                }
            }, 'API key validation', provider);
        } else {
            // Original Groq validation for other Llama models
            await withRetry(async () => {
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
            }, 'API key validation', provider);
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
  private bedrockClient: BedrockRuntimeClient | null = null;

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
    // Note: Bedrock is now handled via API route, no client initialization needed
  }

  private getSchemaForProvider(schema: any): ApiResponseSchema {
    if (this.provider === 'gemini') {
      return schema;
    } else {
      // Convert Google GenAI Type enum to plain JSON schema for OpenAI/Llama
      const convertType = (type: any): string => {
        if (type === Type.OBJECT || type === "OBJECT") return "object";
        if (type === Type.ARRAY || type === "ARRAY") return "array";
        if (type === Type.STRING || type === "STRING") return "string";
        if (type === Type.BOOLEAN || type === "BOOLEAN") return "boolean";
        return "string"; // fallback
      };

      const convertSchema = (schema: any): any => {
        if (typeof schema === 'object' && schema !== null) {
          const converted: any = {};
          for (const [key, value] of Object.entries(schema)) {
            if (key === 'type' && typeof value === 'object') {
              converted[key] = convertType(value);
            } else if (key === 'properties' || key === 'items') {
              converted[key] = convertSchema(value);
            } else if (key === 'enum' || key === 'required') {
              converted[key] = value;
            } else if (typeof value === 'object') {
              converted[key] = convertSchema(value);
            } else {
              converted[key] = value;
            }
          }
          return converted;
        }
        return schema;
      };

      return convertSchema(schema);
    }
  }

  private async callApi(systemMessage: string, userMessage: string, responseSchema: ApiResponseSchema): Promise<ApiResponse> {
    const convertedSchema = this.getSchemaForProvider(responseSchema);
    
    return withRetry(async () => {
      if (this.provider === 'gemini' && this.ai) {
          const response = await this.ai.models.generateContent({
              model: this.model,
              contents: userMessage,
              config: {
                  systemInstruction: systemMessage,
                  temperature: 0.1,
                  responseMimeType: "application/json",
                  responseSchema: convertedSchema,
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

      } else if (this.provider === 'llama' && this.model === 'llama-3.3-70b-bedrock') {
          // Bedrock Llama 3.3 70B implementation via API route
          const response = await fetch('/api/bedrock/invoke', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  systemMessage,
                  userMessage,
                  responseSchema: convertedSchema
              })
          });

          const data = await response.json();

          if (!response.ok) {
              throw new Error(JSON.stringify(data));
          }

          return data;

      } else if (this.provider === 'llama' && this.model === 'llama-3.3-70b-watsonx') {
          // WatsonX Llama 3.3 70B implementation
          const response = await fetch('https://us-south.ml.cloud.ibm.com/ml/v1/text/generation', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${this.apiKey}`,
                  'Accept': 'application/json'
              },
              body: JSON.stringify({
                  model_id: 'meta-llama/llama-3.3-70b-instruct',
                  input: {
                      messages: [
                          { role: 'system', content: systemMessage },
                          { role: 'user', content: userMessage }
                      ]
                  },
                  parameters: {
                      temperature: 0.1,
                      max_new_tokens: 8000,
                      top_p: 0.9,
                      response_format: { type: 'json_object' }
                  }
              })
          });

          const data = await response.json();

          if (!response.ok) {
              throw new Error(JSON.stringify(data));
          }

          const content = data.results?.[0]?.generated_text;
          if (!content) {
              throw new Error('WatsonX API returned an empty or malformed response content.');
          }

          // Parse the JSON response from the model
          try {
              // Extract JSON from markdown code blocks if present
              let jsonContent = content.trim();
              
              // First, try to find JSON within markdown code blocks
              const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
              if (jsonMatch) {
                  jsonContent = jsonMatch[1];
              } else {
                  // Try to find JSON object anywhere in the text
                  const jsonObjectMatch = jsonContent.match(/\{[\s\S]*\}/);
                  if (jsonObjectMatch) {
                      jsonContent = jsonObjectMatch[0];
                  } else {
                      // Remove markdown code block markers if no match found
                      if (jsonContent.startsWith('```json')) {
                          jsonContent = jsonContent.substring(7);
                      }
                      if (jsonContent.startsWith('```')) {
                          jsonContent = jsonContent.substring(3);
                      }
                      if (jsonContent.endsWith('```')) {
                          jsonContent = jsonContent.substring(0, jsonContent.length - 3);
                      }
                  }
              }
              
              // Clean up any remaining whitespace and try to parse
              jsonContent = jsonContent.trim();
              
              // Additional cleanup: remove any text before the first {
              const firstBraceIndex = jsonContent.indexOf('{');
              if (firstBraceIndex > 0) {
                  jsonContent = jsonContent.substring(firstBraceIndex);
              }
              
              // Additional cleanup: remove any text after the last }
              const lastBraceIndex = jsonContent.lastIndexOf('}');
              if (lastBraceIndex >= 0 && lastBraceIndex < jsonContent.length - 1) {
                  jsonContent = jsonContent.substring(0, lastBraceIndex + 1);
              }
              
              // Additional cleanup: remove Python-style tags and other non-JSON content
              // Remove tags like <|python_tag|>, <|system|>, <|user|>, <|assistant|>, etc.
              jsonContent = jsonContent.replace(/<\|[^|]*\|>/g, '');
              
              // Remove any remaining non-JSON content that might interfere
              // This handles cases where the model adds explanatory text or tags
              jsonContent = jsonContent.replace(/^[^{]*/, ''); // Remove anything before first {
              jsonContent = jsonContent.replace(/}[^}]*$/, '}'); // Remove anything after last }
              
              return JSON.parse(jsonContent);
          } catch (parseError) {
              // Handle JSON parsing errors for WatsonX Llama
              console.warn('Failed to parse JSON response from WatsonX Llama:', content);
              throw new Error(`JSON parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Response was: ${content.substring(0, 200)}...`);
          }

      } else if (this.provider === 'llama') {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    }, 'API call', this.provider);
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
    // Backend now only returns { paragraphs, maxLevel } - numbering detection moved to LLM
    const rawParagraphs: Paragraph[] = data.paragraphs || [];
    
    // Use LLM to detect numbering discrepancies
    const numberingDiscrepancies = await this.detectNumberingDiscrepanciesWithLLM(rawParagraphs);
    
    // Ensure all paragraphs have the correct documentId
    const processedParagraphs: Paragraph[] = rawParagraphs.map((para: any) => ({
      ...para,
      documentId: documentId // Ensure consistent documentId
    }));
    
    return {
      paragraphs: processedParagraphs,
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
"suggestedDefinition" MUST be a contextual definition for the term based on how it's used in this contract. This should be a clear, concise definition that captures the specific meaning intended in this contract context.

Instructions:
1.  **Candidate List:** Focus your analysis primarily on the following list of common legal/business terms: [agreement, affiliate, claim, confidential information, control, damages, deliverables, dispute, effective date, expenses, force majeure, indemnified parties, intellectual property, law, liability, losses, party/parties, person, products, purpose, representatives, services, taxes, term, territory, third party].
2.  **Context is Key:** Do NOT flag every occurrence of these words. You must analyze the context to determine if the word is being used in a generic sense or as a specific, de facto defined term.
    *   **FLAG** if the term is used to confer specific rights, obligations, or limitations that seem unique to this contract. Example: "Consultant shall provide the Services as described in Exhibit A." (Here, "Services" clearly refers to a specific set of deliverables, not just any services).
    *   **IGNORE** if the term is used in its common, everyday sense. Example: "This agreement represents the entire understanding." (Here, "agreement" is used generically).
    *   **IGNORE** if the term is part of a general list or a common legal phrase not specific to the contract's substance. Example: "...including but not limited to any claims, damages, or losses."
3.  **CRITICAL RULE:** You will be provided a list of KNOWN_TERMS that are already formally defined. You **MUST NOT** suggest any term from this list. Double-check your suggestions against this list before finalizing the output.
4.  **Suggested Definition Guidelines:** For each suggested term, provide a contextual definition that:
    *   Captures the specific meaning as used in this contract
    *   Is clear and concise (1-2 sentences maximum)
    *   Reflects the contract's context and purpose
    *   Uses standard legal definition format (e.g., "means" or "refers to")
    *   Avoids circular references to the term itself
5.  **Output Format:** If no such terms are found, return an empty "suggestions" array. Your final response must be a JSON object structured as { "suggestions": [...] }.`;
    
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
                        suggestedDefinition: { type: Type.STRING },
                    },
                    required: ["term", "paragraphId", "sentence", "reasoning", "suggestedDefinition"]
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
        .filter(s => s.term && s.term.trim() && !knownTermsLowercase.includes(s.term.toLowerCase()))
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

  private async detectNumberingDiscrepanciesWithLLM(paragraphs: Paragraph[]): Promise<NumberingDiscrepancy[]> {
    console.log('Starting numbering discrepancy detection with LLM...');
    console.log(`Input paragraphs: ${paragraphs.length} total`);
    // Prepare concise structured data for the LLM: paragraphId, numbering label, outline level, and whether any body text follows the label.
    // Compute numeric left indents to derive visual hierarchy levels
    const numericIndents = paragraphs.map(p => {
      const val = parseFloat((p.indent?.left ?? '0').replace('rem',''));
      return isNaN(val) ? 0 : val;
    });
    const uniqueIndents = Array.from(new Set(numericIndents)).sort((a,b) => a-b);
    const indentLevelOf = (indent: number) => uniqueIndents.indexOf(indent);

    const items = paragraphs
      .filter(p => (p.numLabel && p.numLabel.trim() !== '') || p.level !== null)
      .map(p => {
        const indentVal = parseFloat((p.indent?.left ?? '0').replace('rem',''));
        const indentLeftNum = isNaN(indentVal) ? 0 : indentVal;
        return {
          paragraphId: p.id,
          documentId: p.documentId,
          label: p.numLabel ?? '',
          wordLevel: p.level ?? null,
          indentLeftRem: indentLeftNum,
          visualLevel: indentLevelOf(indentLeftNum),
          hasText: p.text.trim().length > 0
        };
      });
    
    if (items.length === 0) {
      console.log('No numbered paragraphs found, returning empty array');
      return [];
    }
    
    console.log(`Found ${items.length} numbered paragraphs to analyze`);
          console.log('Sample items:', items.slice(0, 3));
      console.log('All items for debugging:', JSON.stringify(items, null, 2));

    // Build messages and schema for LLM call
    const systemMessage = `You are an expert legal document reviewer focused on clause numbering.
Your job is to analyse the provided structured data and spot numbering discrepancies such as:
• skipped numbers (e.g., 1.1, 1.3 with no 1.2)
• out-of-order numbers (e.g., 1.1, 1.3, 1.2)
• duplicate numbers (same number used twice)
• inconsistent formats (mixing styles/punctuation)
• manual (text) numbering that is not part of an automatic list
• hierarchy problems (skipped levels / orphan items)

CRITICAL: You MUST detect gaps in numbering sequences. If you see 1.1 followed by 1.3, that's a skipped number.
Each object includes: paragraphId, label, wordLevel (Word listLevelNumber), indentLeftRem (numeric rem), visualLevel (derived from indentation), hasText.
You MUST use the exact paragraphId string from the input. If you cannot determine a paragraphId, do **not** report that discrepancy.
Respond ONLY with valid JSON that matches the given schema.`;

    const userMessage = `NUMBERING_DATA:\n${JSON.stringify(items, null, 2)}`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        discrepancies: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              paragraphId: { type: Type.STRING },
              documentId: { type: Type.STRING },
              details: { type: Type.STRING }
            },
            required: ['type', 'paragraphId', 'documentId', 'details']
          }
        }
      },
      required: ['discrepancies']
    };
    /* const numberingData = numberedParagraphs.map(p => ({
      id: p.id,
      numLabel: p.numLabel,
      level: p.level,
      text: p.text.substring(0, 100) + (p.text.length > 100 ? '...' : '') // Truncate for context
    }));

    /* const prompt = `You are an expert at analyzing legal document numbering systems. Analyze the following numbered paragraphs and identify any numbering discrepancies.

NUMBERED PARAGRAPHS:
${JSON.stringify(numberingData, null, 2)}

TYPES OF DISCREPANCIES TO DETECT:
1. **skipped** - Missing numbers in sequence (e.g., 1, 2, 4 - missing 3)
2. **outoforder** - Numbers not in ascending order (e.g., 1, 3, 2)
3. **duplicate** - Same number used multiple times at same level
4. **inconsistent** - Inconsistent formatting or numbering style
5. **manual** - Text that appears numbered but lacks proper list formatting

ANALYSIS RULES:
- Focus on sequence within the same parent level (e.g., under "2": check 2.1, 2.2, 2.3...)
- When returning from deeper levels to higher levels, that's normal (e.g., 2.4.a, 2.4.b, 2.5 is valid)
- Only flag genuine issues, not normal hierarchical transitions
- Consider the document structure and context

Return your analysis as a JSON array of discrepancy objects with this exact format:
[
  {
    "type": "skipped|outoforder|duplicate|inconsistent|manual",
    "paragraphId": "para-XX",
    "documentId": "doc-1", 
    "details": "Clear description of the specific issue"
  }
]

If no discrepancies are found, return an empty array: []`;
    */

        try {
      console.log('Calling LLM API for numbering analysis...');
      const response = await this.callApi(systemMessage, userMessage, schema) as { discrepancies: NumberingDiscrepancy[] };
      console.log('LLM response received:', JSON.stringify(response, null, 2));
      
      // Handle and validate the JSON response returned by the model
      if (response && Array.isArray(response.discrepancies)) {
        console.log(`Raw discrepancies from LLM: ${response.discrepancies.length}`);
        console.log('Sample raw discrepancy:', response.discrepancies[0]);
        
        // Filter out any malformed entries lacking a paragraphId
        // Normalise keys that the LLM might return with slightly different names
        const paraMap = new Map(paragraphs.map(p => [p.id, p]));
        
        const normalised: NumberingDiscrepancy[] = response.discrepancies
          .filter(d => {
            const hasId = !!d.paragraphId;
            if (!hasId) {
              console.warn('Filtering out discrepancy without paragraphId:', d);
            }
            return hasId;
          })
          .map(raw => {
            console.log('Processing raw discrepancy:', raw);
            let typeTxt = (raw.type || (raw as any).issue || '').toString();
            let detailsTxt = (raw.details ?? (raw as any).detail ?? (raw as any).message ?? (raw as any).reason ?? (raw as any).explanation ?? '').toString();
            console.log(`Extracted type: "${typeTxt}", details: "${detailsTxt}"`);
            
            // If details missing but type contains a colon, split it.
            if (!detailsTxt && typeTxt.includes(':')) {
              const idx = typeTxt.indexOf(':');
              detailsTxt = typeTxt.slice(idx + 1).trim();
              typeTxt = typeTxt.slice(0, idx).trim();
              console.log(`Split combined string - new type: "${typeTxt}", details: "${detailsTxt}"`);
            }
            
            const result = {
              type: typeTxt as NumberingIssueType,
              paragraphId: raw.paragraphId,
              documentId: raw.documentId,
              details: detailsTxt,
            };
            console.log('Normalized discrepancy:', result);
            return result;
          });

        console.log(`Final normalized discrepancies: ${normalised.length}`);
        console.log('Sample normalized discrepancy:', normalised[0]);
        
        // Return as-is; rely on richer context given to the LLM
        return normalised;
      }
      console.log('No valid response or discrepancies array from LLM');
      return [];
    } catch (error) {
      console.error('Error in LLM numbering detection:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return []; // Return empty array on error rather than failing the whole analysis
    }
  }
}