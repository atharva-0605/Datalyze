import json
import logging
from app.core.ai_engine import CloudAIEngine, cloud_ai_engine

logger = logging.getLogger("app.services.nlp_engine")

class NLPAnalysisEngine:
    def __init__(self, client: CloudAIEngine = cloud_ai_engine):
        self.client = client

    async def translate_query_to_intent(self, user_question: str, dataset_schema: dict) -> dict:
        """Translates a user's natural language question into a structured query intent dictionary.
        
        Uses the Cloud AI engine to classify target columns, aggregations, and query filters.
        """
        prompt = f"""
        Translate the following user question into a structured data query intent object based on the dataset schema.
        
        User Question: "{user_question}"
        
        Dataset Schema (Columns & Data Types):
        {json.dumps(dataset_schema, indent=2)}
        
        Respond ONLY with a valid, raw, minified JSON object matching the following structure:
        {{
            "target_column": "column_name_or_null",
            "aggregation": "SUM|AVG|COUNT|MAX|MIN|NONE",
            "filters": [
                {{
                    "column": "column_name",
                    "operator": "==|!=|>|<|>=|<=",
                    "value": "extracted_value"
                }}
            ],
            "dimension": "string_column_name_to_extract_or_null"
        }}
        
        Do not include any preambles, explanations, markdown formatting blocks (such as ```json), or trailing text.
        """
        
        system_prompt = (
            "You are a semantic query parser. Your sole job is to translate user natural language questions "
            "into structured database intents based on schemas. You output ONLY raw JSON."
        )
        
        try:
            response_text = await self.client.generate_insight(
                prompt=prompt, 
                system_prompt=system_prompt
            )
            
            # Clean markdown code block enclosures (e.g. ```json ... ```) if returned
            response_text = response_text.strip()
            if response_text.startswith("```"):
                lines = response_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                response_text = "\n".join(lines).strip()
            
            # Parse cleaned JSON
            intent = json.loads(response_text)
            
            if not isinstance(intent, dict):
                raise ValueError("Ollama output is not a JSON dictionary.")
                
            return {
                "target_column": intent.get("target_column"),
                "aggregation": intent.get("aggregation", "NONE"),
                "filters": intent.get("filters", []),
                "dimension": intent.get("dimension"),
                "question": user_question
            }
            
        except Exception as e:
            logger.warning(
                f"Failed to parse Ollama NLP query intent. Output text: '{response_text if 'response_text' in locals() else 'N/A'}'. Error: {e}"
            )
            # Safe production-ready default intent fallback
            return {
                "target_column": None,
                "aggregation": "NONE",
                "filters": [],
                "dimension": None,
                "question": user_question
            }

# Setup aliases for both spellings to ensure backwards compatibility
NLPAnyalsisEngine = NLPAnalysisEngine
nlp_analysis_engine = NLPAnalysisEngine()
