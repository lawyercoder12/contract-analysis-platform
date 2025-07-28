import streamlit as st
import os
import json
import requests
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
import google.generativeai as genai
from docx import Document
import zipfile
import xml.etree.ElementTree as ET
from io import BytesIO
import re
import time

# Configure page
st.set_page_config(
    page_title="Contract Analysis Platform",
    page_icon="📄",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        color: #1f2937;
        margin-bottom: 2rem;
        text-align: center;
    }
    .metric-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 1rem;
        border-radius: 0.5rem;
        color: white;
        text-align: center;
        margin: 0.5rem 0;
    }
    .issue-badge {
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        font-weight: bold;
        margin: 0.2rem;
        display: inline-block;
    }
    .badge-conflict { background-color: #fca5a5; color: #7f1d1d; }
    .badge-duplicate { background-color: #fcd34d; color: #78350f; }
    .badge-undefined { background-color: #fca5a5; color: #7f1d1d; }
    .badge-unused { background-color: #93c5fd; color: #1e3a8a; }
    .badge-case-drift { background-color: #fdba74; color: #9a3412; }
    .badge-suggestion { background-color: #86efac; color: #14532d; }
</style>
""", unsafe_allow_html=True)

class IssueType(Enum):
    DUPLICATE = "duplicate"
    CASE_DRIFT = "case_drift"
    MISSING_DEFINITION = "missing_definition"
    UNUSED_TERM = "unused_term"
    USE_BEFORE_DEFINE = "use_before_define"
    CONFLICT = "conflict"
    POTENTIAL_DEFINITION_NEEDED = "potential_definition_needed"

class Classification(Enum):
    DEFINED = "Defined"
    UNDEFINED = "Undefined"
    ACRONYM = "Acronym"
    NOISE = "Noise"

@dataclass
class Definition:
    term_raw: str
    term_canonical: str
    def_text: str
    paragraph_id: str
    is_inline: bool
    issues: List[IssueType]

@dataclass
class Usage:
    token: str
    canonical: Optional[str]
    sentence: str
    paragraph_id: str
    classification: Classification
    def_locator: Optional[str]
    is_case_drift: bool
    issues: List[IssueType]

@dataclass
class Suggestion:
    term: str
    paragraph_id: str
    sentence: str
    reasoning: str

@dataclass
class CrossReference:
    token: str
    sentence: str
    paragraph_id: str

class ContractAnalyzer:
    def __init__(self, api_key: str, provider: str, model: str):
        self.api_key = api_key
        self.provider = provider
        self.model = model
        
        if provider == "gemini":
            genai.configure(api_key=api_key)
            self.client = genai.GenerativeModel(model)
        elif provider == "openai":
            self.openai_headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
    
    def call_api(self, system_message: str, user_message: str) -> Dict[str, Any]:
        """Make API call to the selected provider"""
        if self.provider == "gemini":
            response = self.client.generate_content(
                f"System: {system_message}\n\nUser: {user_message}",
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    response_mime_type="application/json"
                )
            )
            return json.loads(response.text)
        
        elif self.provider == "openai":
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=self.openai_headers,
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": user_message}
                    ],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"}
                }
            )
            
            if not response.ok:
                raise Exception(f"OpenAI API error: {response.text}")
            
            content = response.json()["choices"][0]["message"]["content"]
            return json.loads(content)
    
    def extract_definitions(self, text: str) -> List[Dict[str, Any]]:
        """Extract definitions from contract text"""
        system_message = """You are an expert at extracting definitions from legal contracts. Extract all definitions including inline parenthetical definitions and dedicated definition clauses. Return a JSON object with a "definitions" array."""
        
        user_message = f"Extract all definitions from this contract text:\n\n{text}"
        
        try:
            response = self.call_api(system_message, user_message)
            return response.get("definitions", [])
        except Exception as e:
            st.error(f"Error extracting definitions: {str(e)}")
            return []
    
    def find_usages(self, text: str, known_terms: List[str]) -> List[Dict[str, Any]]:
        """Find term usages in contract text"""
        system_message = """You are an expert at finding term usages in legal contracts. Find all usages of defined terms and identify undefined capitalized terms. Return a JSON object with a "usages" array."""
        
        terms_list = '", "'.join(known_terms)
        user_message = f'Known terms: ["{terms_list}"]\n\nFind all term usages in this text:\n\n{text}'
        
        try:
            response = self.call_api(system_message, user_message)
            return response.get("usages", [])
        except Exception as e:
            st.error(f"Error finding usages: {str(e)}")
            return []
    
    def find_suggestions(self, text: str, known_terms: List[str]) -> List[Dict[str, Any]]:
        """Find terms that should be defined"""
        system_message = """You are an expert at identifying terms in legal contracts that should be formally defined. Return a JSON object with a "suggestions" array."""
        
        terms_list = '", "'.join(known_terms)
        user_message = f'Known defined terms: ["{terms_list}"]\n\nFind terms that should be defined in this text:\n\n{text}'
        
        try:
            response = self.call_api(system_message, user_message)
            return response.get("suggestions", [])
        except Exception as e:
            st.error(f"Error finding suggestions: {str(e)}")
            return []
    
    def find_cross_references(self, text: str) -> List[Dict[str, Any]]:
        """Find cross-references in contract text"""
        system_message = """You are an expert at finding cross-references in legal contracts. Find references to sections, exhibits, schedules, etc. Return a JSON object with a "references" array."""
        
        user_message = f"Find all cross-references in this text:\n\n{text}"
        
        try:
            response = self.call_api(system_message, user_message)
            return response.get("references", [])
        except Exception as e:
            st.error(f"Error finding cross-references: {str(e)}")
            return []

def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX file"""
    try:
        doc = Document(BytesIO(file_bytes))
        paragraphs = []
        
        for i, paragraph in enumerate(doc.paragraphs):
            text = paragraph.text.strip()
            if text:
                paragraphs.append(f"[para-{i}] {text}")
        
        return "\n\n".join(paragraphs)
    except Exception as e:
        st.error(f"Error extracting text from DOCX: {str(e)}")
        return ""

def render_issue_badge(issue_type: str) -> str:
    """Render an issue badge with appropriate styling"""
    badge_classes = {
        "conflict": "badge-conflict",
        "duplicate": "badge-duplicate",
        "missing_definition": "badge-undefined",
        "unused_term": "badge-unused",
        "case_drift": "badge-case-drift",
        "potential_definition_needed": "badge-suggestion"
    }
    
    badge_labels = {
        "conflict": "Conflict",
        "duplicate": "Duplicate",
        "missing_definition": "Undefined",
        "unused_term": "Unused",
        "case_drift": "Case Drift",
        "potential_definition_needed": "Suggestion"
    }
    
    class_name = badge_classes.get(issue_type, "issue-badge")
    label = badge_labels.get(issue_type, issue_type.title())
    
    return f'<span class="issue-badge {class_name}">{label}</span>'

def main():
    # Header
    st.markdown('<h1 class="main-header">📄 Contract Analysis Platform</h1>', unsafe_allow_html=True)
    
    # Initialize session state
    if 'analysis_results' not in st.session_state:
        st.session_state.analysis_results = None
    if 'contract_text' not in st.session_state:
        st.session_state.contract_text = ""
    
    # Sidebar for configuration
    with st.sidebar:
        st.header("⚙️ Configuration")
        
        # Model selection
        provider = st.selectbox(
            "AI Provider",
            ["gemini", "openai"],
            help="Choose your AI provider"
        )
        
        if provider == "gemini":
            model = st.selectbox("Model", ["gemini-2.5-flash"], help="Select Gemini model")
            api_key = st.text_input(
                "Gemini API Key", 
                value=os.getenv("VITE_GEMINI_API_KEY", ""),
                type="password",
                help="Enter your Gemini API key"
            )
        else:
            model = st.selectbox("Model", ["gpt-4.1-mini"], help="Select OpenAI model")
            api_key = st.text_input(
                "OpenAI API Key",
                value=os.getenv("VITE_OPENAI_API_KEY", ""),
                type="password",
                help="Enter your OpenAI API key"
            )
        
        if not api_key:
            st.warning("Please enter your API key to continue")
    
    # Main content area
    if api_key:
        # File upload
        st.header("📤 Upload Contract")
        uploaded_file = st.file_uploader(
            "Choose a DOCX file",
            type=['docx'],
            help="Upload a Microsoft Word document for analysis"
        )
        
        if uploaded_file is not None:
            # Extract text
            with st.spinner("Extracting text from document..."):
                file_bytes = uploaded_file.read()
                contract_text = extract_text_from_docx(file_bytes)
                st.session_state.contract_text = contract_text
            
            if contract_text:
                st.success(f"✅ Extracted {len(contract_text)} characters from {uploaded_file.name}")
                
                # Analysis button
                if st.button("🔍 Analyze Contract", type="primary"):
                    analyzer = ContractAnalyzer(api_key, provider, model)
                    
                    with st.spinner("Analyzing contract... This may take a few minutes."):
                        progress_bar = st.progress(0)
                        
                        # Step 1: Extract definitions
                        st.write("🔍 Step 1/4: Extracting definitions...")
                        progress_bar.progress(25)
                        definitions_data = analyzer.extract_definitions(contract_text)
                        
                        # Process definitions
                        definitions = []
                        known_terms = []
                        for def_data in definitions_data:
                            definition = Definition(
                                term_raw=def_data.get("term_raw", ""),
                                term_canonical=def_data.get("term_canonical", ""),
                                def_text=def_data.get("def_text", ""),
                                paragraph_id=def_data.get("paragraphId", ""),
                                is_inline=def_data.get("is_inline", False),
                                issues=[]
                            )
                            definitions.append(definition)
                            known_terms.append(definition.term_canonical)
                        
                        # Step 2: Find usages
                        st.write("🔍 Step 2/4: Finding term usages...")
                        progress_bar.progress(50)
                        usages_data = analyzer.find_usages(contract_text, known_terms)
                        
                        usages = []
                        for usage_data in usages_data:
                            usage = Usage(
                                token=usage_data.get("token", ""),
                                canonical=usage_data.get("canonical"),
                                sentence=usage_data.get("sentence", ""),
                                paragraph_id=usage_data.get("paragraphId", ""),
                                classification=Classification(usage_data.get("classification", "Undefined")),
                                def_locator=None,
                                is_case_drift=usage_data.get("is_case_drift", False),
                                issues=[]
                            )
                            usages.append(usage)
                        
                        # Step 3: Find suggestions
                        st.write("🔍 Step 3/4: Finding improvement suggestions...")
                        progress_bar.progress(75)
                        suggestions_data = analyzer.find_suggestions(contract_text, known_terms)
                        
                        suggestions = []
                        for sugg_data in suggestions_data:
                            suggestion = Suggestion(
                                term=sugg_data.get("term", ""),
                                paragraph_id=sugg_data.get("paragraphId", ""),
                                sentence=sugg_data.get("sentence", ""),
                                reasoning=sugg_data.get("reasoning", "")
                            )
                            suggestions.append(suggestion)
                        
                        # Step 4: Find cross-references
                        st.write("🔍 Step 4/4: Finding cross-references...")
                        progress_bar.progress(100)
                        cross_refs_data = analyzer.find_cross_references(contract_text)
                        
                        cross_references = []
                        for ref_data in cross_refs_data:
                            cross_ref = CrossReference(
                                token=ref_data.get("token", ""),
                                sentence=ref_data.get("sentence", ""),
                                paragraph_id=ref_data.get("paragraphId", "")
                            )
                            cross_references.append(cross_ref)
                        
                        # Store results
                        st.session_state.analysis_results = {
                            "definitions": definitions,
                            "usages": usages,
                            "suggestions": suggestions,
                            "cross_references": cross_references
                        }
                        
                        st.success("✅ Analysis complete!")
    
    # Display results
    if st.session_state.analysis_results:
        results = st.session_state.analysis_results
        
        st.header("📊 Analysis Results")
        
        # Summary metrics
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.markdown(f"""
            <div class="metric-card">
                <h3>{len(results['definitions'])}</h3>
                <p>Definitions Found</p>
            </div>
            """, unsafe_allow_html=True)
        
        with col2:
            undefined_count = len([u for u in results['usages'] if u.classification == Classification.UNDEFINED])
            st.markdown(f"""
            <div class="metric-card">
                <h3>{undefined_count}</h3>
                <p>Undefined Terms</p>
            </div>
            """, unsafe_allow_html=True)
        
        with col3:
            st.markdown(f"""
            <div class="metric-card">
                <h3>{len(results['suggestions'])}</h3>
                <p>Suggestions</p>
            </div>
            """, unsafe_allow_html=True)
        
        with col4:
            st.markdown(f"""
            <div class="metric-card">
                <h3>{len(results['cross_references'])}</h3>
                <p>Cross-references</p>
            </div>
            """, unsafe_allow_html=True)
        
        # Tabbed results display
        tab1, tab2, tab3, tab4 = st.tabs(["📚 Definitions", "❓ Undefined Terms", "💡 Suggestions", "🔗 Cross-references"])
        
        with tab1:
            st.subheader("Definitions Found")
            if results['definitions']:
                for definition in results['definitions']:
                    with st.expander(f"**{definition.term_raw}** ({definition.term_canonical})"):
                        st.write(f"**Definition:** {definition.def_text}")
                        st.write(f"**Location:** {definition.paragraph_id}")
                        st.write(f"**Type:** {'Inline' if definition.is_inline else 'Dedicated clause'}")
                        
                        if definition.issues:
                            st.write("**Issues:**")
                            for issue in definition.issues:
                                st.markdown(render_issue_badge(issue.value), unsafe_allow_html=True)
            else:
                st.info("No definitions found in the document.")
        
        with tab2:
            st.subheader("Undefined Terms")
            undefined_usages = [u for u in results['usages'] if u.classification == Classification.UNDEFINED]
            
            if undefined_usages:
                for usage in undefined_usages:
                    with st.expander(f"**{usage.token}**"):
                        st.write(f"**Context:** {usage.sentence}")
                        st.write(f"**Location:** {usage.paragraph_id}")
                        
                        if usage.is_case_drift:
                            st.markdown(render_issue_badge("case_drift"), unsafe_allow_html=True)
            else:
                st.success("✅ All capitalized terms appear to be properly defined!")
        
        with tab3:
            st.subheader("Terms That Should Be Defined")
            if results['suggestions']:
                for suggestion in results['suggestions']:
                    with st.expander(f"**{suggestion.term}**"):
                        st.write(f"**Context:** {suggestion.sentence}")
                        st.write(f"**Location:** {suggestion.paragraph_id}")
                        st.write(f"**Reasoning:** {suggestion.reasoning}")
                        st.markdown(render_issue_badge("potential_definition_needed"), unsafe_allow_html=True)
            else:
                st.info("No additional terms identified for definition.")
        
        with tab4:
            st.subheader("Cross-references")
            if results['cross_references']:
                for ref in results['cross_references']:
                    with st.expander(f"**{ref.token}**"):
                        st.write(f"**Context:** {ref.sentence}")
                        st.write(f"**Location:** {ref.paragraph_id}")
            else:
                st.info("No cross-references found in the document.")
    
    # Footer
    st.markdown("---")
    st.markdown("Built with ❤️ using Streamlit • Powered by AI")

if __name__ == "__main__":
    main()