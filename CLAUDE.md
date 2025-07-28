# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

**Install dependencies:**
```bash
npm install
```

**Run development server:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
```

**Preview production build:**
```bash
npm run preview
```

## Environment Setup

The application requires a `GEMINI_API_KEY` environment variable to be set in `.env.local` for Google Gemini API access. The Vite configuration (vite.config.ts:8-9) exposes this as `process.env.API_KEY` and `process.env.GEMINI_API_KEY` to the client.

## Architecture Overview

This is a React-based contract analysis application built with Vite and TypeScript that uses AI models to analyze legal documents:

### Core Structure

- **App.tsx**: Main application component managing state flow between model selection, API key input, file upload, and results display
- **services/contractAnalyzer.ts**: Core analysis engine that handles document parsing, AI API calls, and result processing
- **types.ts**: Comprehensive type definitions for all data structures

### Key Features

1. **Multi-Model Support**: Supports both Google Gemini and OpenAI models (config/models.ts)
2. **Document Parsing**: Parses DOCX files to extract paragraphs, numbering, and structure
3. **AI Analysis**: Uses structured prompts to extract definitions, find term usages, identify cross-references, and suggest implicit definitions
4. **Issue Detection**: Identifies problems like duplicate definitions, case drift, undefined terms, and numbering discrepancies

### Component Architecture

- **FileUpload**: Handles document upload
- **ModelSelector**: Model and provider selection interface  
- **ApiKeyInput**: API key validation and storage
- **ResultsDisplay**: Main results presentation with tabbed interface
- **Specialized Tables**: DefinitionsTable, UsagesTable, CrossReferencesTable, etc. for displaying analysis results

### State Management

- Uses React useState and sessionStorage for persistence
- App state flow: needs_model_selection → needs_key → idle → loading → success/error
- API keys stored per provider in sessionStorage

### Analysis Pipeline

1. **Document Parsing**: Extract paragraphs with proper numbering from DOCX
2. **Definition Extraction**: Find all defined terms using AI analysis
3. **Parallel Analysis**: Simultaneously scan for usages, resolve duplicates, find suggestions, and identify cross-references
4. **Cross-linking**: Link usages to definitions and identify issues
5. **Results Display**: Present findings in organized tables with issue highlighting

### Key Technical Details

- Uses batch processing (API_CALL_BATCH_SIZE = 5) for API calls
- Chunks document into 10-paragraph segments for processing
- Implements sophisticated numbering logic for Word document list structures
- Uses structured JSON schemas for AI responses to ensure consistent output
- Handles both Google Gemini and OpenAI API formats with unified interface

The application is designed for legal professionals to analyze contract documents for terminology consistency, cross-reference accuracy, and structural issues.