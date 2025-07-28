# Product Overview: AI-Powered Contract Analysis Platform

**Version:** 0.11  
**Last Updated:** 2025-07-28  
**Description:** An experimental lab for AI-powered contract review tools that analyzes DOCX contracts for definitions, numbering, cross-references, and other potential issues.

---

## What This Product Does

This is a web-based contract analysis tool that uses AI to automatically review legal documents and identify potential issues. Users upload a DOCX contract file, and the system provides a comprehensive analysis report highlighting terminology problems, structural issues, and areas needing attention.

### Core Analysis Features

1. **Definition Analysis**: Identifies all defined terms in the contract, including both dedicated definition clauses and inline parenthetical definitions
2. **Usage Tracking**: Tracks how defined terms are used throughout the document and flags inconsistencies
3. **Issue Detection**: Automatically identifies problems like duplicate definitions, undefined terms, case drift, and usage before definition
4. **Cross-Reference Analysis**: Finds all references to sections, exhibits, schedules, and other document parts
5. **Implicit Definition Suggestions**: Identifies terms that appear to be used with specific meaning but aren't formally defined
6. **Document Numbering Analysis**: Detects numbering issues including manual numbering and inconsistencies

---

## How The Product Works

### User Journey

1. **Model Selection Screen**
   - User chooses between Google Gemini or OpenAI
   - Selects specific model (Gemini 2.5 Flash or GPT-4.1 mini)
   - Clean interface with provider logos and model descriptions

2. **API Key Input Screen**
   - User enters API key for chosen provider
   - System validates the key with a test API call
   - Keys are stored in sessionStorage for the session

3. **File Upload Interface**
   - Drag-and-drop area for DOCX files
   - Welcome splash screen with clear instructions
   - File validation and error handling

4. **Analysis Progress Screen**
   - Real-time progress indicators showing analysis steps
   - Messages like "Step 2/5: Extracting definitions (15/23)"
   - Loading animations and progress bars

5. **Results Display**
   - Comprehensive tabbed interface showing all findings
   - Interactive tables with sorting and filtering
   - Summary chips showing counts of different issues

### Analysis Pipeline

The system processes documents through a sophisticated 5-step pipeline:

1. **Document Parsing**: Extracts text, paragraphs, and numbering structure from DOCX
2. **Definition Extraction**: Uses AI to identify all defined terms with structured prompts
3. **Parallel Analysis**: Simultaneously runs multiple AI analysis tasks:
   - Term usage scanning
   - Duplicate resolution
   - Implicit definition suggestions  
   - Cross-reference detection
4. **Cross-linking**: Links usages to definitions and identifies issues
5. **Results Compilation**: Organizes findings into interactive displays

---

## User Interface Design

### Visual Design
- **Clean, Professional Aesthetic**: Tailwind CSS with gray/blue color scheme
- **Dark Mode Support**: Toggle between light and dark themes
- **Responsive Layout**: Works on desktop and tablet devices
- **Legal Professional Focus**: Design language appropriate for legal work

### Main Interface Components

#### Header
- Product branding with Sirion logo
- Theme toggle (light/dark mode)
- Settings and reset options

#### Results Display Tabs
- **Definitions**: Grouped table of all defined terms with their definitions and usages, issues highlighted
- **Undefined Terms**: Capitalized terms found in the document that lack formal definitions
- **Suggestions**: AI recommendations for terms that appear to need formal definitions based on context
- **Cross-References**: Document references to sections, exhibits, schedules, and other document parts
- **Numbering**: Analysis of document numbering structure showing discrepancies and issues

#### Interactive Tables
- **Sortable Columns**: Click headers to sort by any field
- **Issue Badges**: Color-coded indicators for different problem types
- **Expandable Rows**: Click to see full context and details
- **Filtering**: Built-in search and filter capabilities

#### Document Viewer
- **Split-pane Layout**: Original document alongside analysis results
- **Highlighting**: Visual indicators for findings in context
- **Navigation**: Click findings to jump to document locations

### Issue Classification System

The system uses a comprehensive issue classification:

#### Definition & Usage Issues
- **Duplicate**: Term defined multiple times in the document
- **Conflict**: Multiple definitions of the same term that contradict each other
- **Case Drift**: Inconsistent capitalization of defined terms (e.g., "Agreement" vs "agreement")
- **Missing Definition**: Capitalized terms without formal definitions
- **Unused Term**: Defined terms that are never actually used in the document
- **Use Before Define**: Terms used in the document before they are formally defined
- **Potential Definition Needed**: Terms that appear to be used with specific meaning but lack formal definitions

#### Numbering Issues
- **Manual**: Manual numbering detected (plain text numbers that won't update automatically)
- **Skipped**: Missing numbers in numbering sequences
- **Inconsistent**: Inconsistent numbering patterns or formats

---

## Technical Implementation

### Frontend Architecture
- **React 19** with TypeScript for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for consistent styling
- **Component-based architecture** with clear separation of concerns

### AI Integration
- **Multi-provider Support**: Both Google Gemini and OpenAI APIs
- **Structured Prompts**: Carefully crafted prompts for consistent AI responses
- **JSON Schema Validation**: Ensures reliable AI output format
- **Batch Processing**: Handles large documents efficiently (5 concurrent API calls)
- **Error Handling**: Robust error recovery with user-friendly messages

### Document Processing
- **DOCX Parsing**: Uses JSZip to extract document structure
- **Sophisticated Numbering Logic**: Handles Word's complex list numbering systems
- **Paragraph Chunking**: Breaks documents into 10-paragraph chunks for AI processing
- **Context Preservation**: Maintains document structure and relationships

### Data Management
- **Client-side Processing**: No server storage of documents
- **SessionStorage**: Persistent settings and API keys within browser session
- **Real-time Updates**: Live progress tracking during analysis

---

## Current Capabilities & Limitations

### What It Does Well
- **Comprehensive Definition Analysis**: Catches both obvious and subtle definition patterns
- **Context-Aware Issue Detection**: Understands legal document structure and terminology
- **Interactive Results**: Easy-to-navigate findings with clear explanations
- **Multi-Model Support**: Flexibility to use different AI providers
- **Professional UI**: Interface designed for legal professionals

### Current Limitations
- **DOCX Only**: Currently supports only Microsoft Word format
- **Single Document**: Processes one document at a time
- **Client-side Only**: All processing happens in the browser
- **Manual Process**: Requires manual review and action on findings
- **English Only**: Designed for English-language contracts

---

## Data Flow & Performance

### Processing Flow
1. User uploads DOCX → Document parsed locally
2. Content chunked → Sent to AI provider in batches
3. AI analysis → Structured JSON responses
4. Results processed → Cross-linked and organized
5. Interactive display → User reviews findings

### Performance Characteristics
- **Typical Analysis Time**: 2-5 minutes for standard contracts
- **Document Size**: Handles contracts up to ~100 pages effectively
- **API Usage**: Optimized batch processing to minimize costs
- **Browser Requirements**: Modern browsers with ES2020+ support

---

## Security & Privacy

### Data Handling
- **No Server Storage**: Documents never leave the user's browser
- **API Key Security**: Stored only in sessionStorage, cleared on browser close
- **Local Processing**: Maximum privacy for sensitive legal documents
- **No Logging**: No tracking or logging of document content

### Validation & Safety
- **Input Validation**: Comprehensive file format and content validation
- **Error Boundaries**: Graceful handling of parsing and API errors
- **Rate Limiting**: Respects AI provider rate limits and quotas

---

## Update & Maintenance Protocol

### Document Update Process
When making changes to the product, this overview should be updated in the following sections as relevant:

1. **Core Analysis Features**: When adding new analysis capabilities
2. **User Journey**: When changing the user flow or interface
3. **Analysis Pipeline**: When modifying the processing steps
4. **User Interface Design**: When updating UI components or design
5. **Technical Implementation**: When changing architecture or dependencies
6. **Current Capabilities & Limitations**: When expanding or changing what the product can do

### Change Documentation
- Update version number and "Last Updated" date
- Add brief description of changes in relevant sections
- Maintain accuracy of screenshots and feature descriptions
- Keep technical details current with implementation

This living document should reflect the actual product at all times, serving as the single source of truth for what the contract analysis platform currently does and how it works.