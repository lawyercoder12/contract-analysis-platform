// Generic types for API responses
export type ApiResponseSchema = Record<string, any>;

// Parsed API response - the final JSON object we get back
export type ApiResponse = Record<string, any>;

// OpenAI API Response structures
export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface OpenAIError {
  error: {
    message: string;
    type?: string;
    code?: string;
  };
}

// Gemini API Response structures  
export interface GeminiResponse {
  text: string;
}

// Error handling types
export interface ApiErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
  message?: string;
}

// Document parsing types
export interface AbstractNumLevel {
  numFmt: string;
  lvlText: string;
  start: string;
  left: number;
  hanging: number;
}

export interface AbstractNum {
  levels: Map<string, AbstractNumLevel>;
}