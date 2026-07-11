import logging
from app.core.ai_engine import cloud_ai_engine

logger = logging.getLogger("app.services.insights")

class AIInsightNarratorService:
    async def generate_data_narrative(self, columns_metadata: dict, chart_data: list = None) -> str:
        """Generates an executive plain-English summary explaining key data patterns using Cloud AI."""
        
        prompt = f"""
        Analyze the following dataset layout and metrics:
        
        Columns and Quality Profile:
        {columns_metadata}
        """
        
        if chart_data:
            prompt += f"\nActive Visual Chart Metric Values:\n{chart_data}\n"
            
        prompt += """
        Please write a single cohesive, high-impact business executive summary paragraph (under 5 sentences) explaining the key data patterns, trends, or quality issues visible in this data. Focus on clear, plain-English, professional phrasing. Do not use generic placeholders or markdown block formatting.
        """
        
        system_prompt = (
            "You are a Principal Business Intelligence Analyst. Your goal is to analyze dataset schemas, "
            "metrics, and chart data points, then explain the key findings in high-fidelity prose."
        )
        
        try:
            narrative = await cloud_ai_engine.generate_insight(prompt=prompt, system_prompt=system_prompt)
            return narrative.strip()
        except Exception as e:
            logger.error(f"Failed to generate AI data narrative: {e}")
            return "AI Insight Narrator is currently offline. Review the raw data metrics in the grid canvas."

ai_insight_narrator = AIInsightNarratorService()
