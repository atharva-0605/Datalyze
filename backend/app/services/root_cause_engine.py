import logging
import json
import pandas as pd
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.ai_engine import cloud_ai_engine
from app.models.anomaly import AnomalyExplanation

logger = logging.getLogger("app.services.root_cause_engine")

class RootCauseDetectiveEngine:
    async def analyze_anomaly_root_cause(
        self, 
        df: pd.DataFrame, 
        workspace_id: int, 
        upload_id: str, 
        column_name: str, 
        db: AsyncSession
    ) -> AnomalyExplanation:
        """
        Analyzes statistical correlations behind data anomalies in a given column and
        uses AI to explain the root cause. Caches the result in anomaly_explanations.
        """
        # Check if already cached
        stmt = select(AnomalyExplanation).where(
            AnomalyExplanation.workspace_id == workspace_id,
            AnomalyExplanation.upload_id == upload_id,
            AnomalyExplanation.column_name == column_name
        )
        result = await db.execute(stmt)
        cached = result.scalars().first()
        if cached:
            return cached

        # Identify anomalous rows
        is_anomaly = pd.Series(False, index=df.index)

        # 1. Missing Values
        if column_name in df.columns:
            is_anomaly = df[column_name].isna()
            anomaly_type = "missing values"

            # 2. Check for negative prices/revenue if numeric
            if not is_anomaly.any() and pd.api.types.is_numeric_dtype(df[column_name]):
                is_anomaly = df[column_name] < 0
                anomaly_type = "invalid negative values"

            # 3. Check for type mismatch if object but contains mostly numeric
            if not is_anomaly.any() and df[column_name].dtype == "object":
                coerced = pd.to_numeric(df[column_name], errors="coerce")
                is_anomaly = coerced.isna() & df[column_name].notna()
                anomaly_type = "type format mismatches"
        else:
            anomaly_type = "unknown anomalies"

        total_anomalies = int(is_anomaly.sum())
        total_rows = len(df)

        if total_anomalies == 0:
            explanation_text = f"No obvious data anomalies (missing values, type mismatches, or negative values) were detected for column '{column_name}'."
            chart_data = []
            
            db_exp = AnomalyExplanation(
                workspace_id=workspace_id,
                upload_id=upload_id,
                column_name=column_name,
                explanation_text=explanation_text,
                chart_data=chart_data
            )
            db.add(db_exp)
            await db.commit()
            await db.refresh(db_exp)
            return db_exp

        # Detect candidate categorical columns for correlation checking
        candidate_cols = []
        for c in df.columns:
            if c == column_name:
                continue
            unique_count = df[c].nunique(dropna=True)
            if unique_count > 0 and (str(df[c].dtype) == "object" or unique_count <= 20):
                candidate_cols.append(c)

        best_cat_col = None
        best_category = None
        best_percentage = 0.0

        for cat_col in candidate_cols:
            anomaly_dist = df[is_anomaly][cat_col].value_counts(normalize=True)
            if not anomaly_dist.empty:
                top_cat = anomaly_dist.index[0]
                top_pct = float(anomaly_dist.iloc[0]) * 100
                if top_pct > best_percentage:
                    best_percentage = top_pct
                    best_category = top_cat
                    best_cat_col = cat_col

        # Create structured chart data representing category counts for visualization
        chart_data = []
        if best_cat_col:
            raw_counts = df[is_anomaly][best_cat_col].value_counts()
            chart_data = [
                {"category": str(k), "count": int(v)}
                for k, v in raw_counts.items()
            ]
        else:
            chart_data = [{"category": "All Anomalies", "count": total_anomalies}]

        # Write correlation overview
        if best_cat_col and best_percentage >= 30.0:
            correlation_context = (
                f"Statistical analysis reveals that anomalies in column '{column_name}' are highly clustered "
                f"in '{best_cat_col}' under the category value '{best_category}', accounting for {best_percentage:.1f}% "
                f"of the total anomalies detected ({total_anomalies} out of {total_rows} total rows)."
            )
        else:
            correlation_context = (
                f"No dominant regional or category clustering was identified for '{column_name}'. The anomalies "
                f"appear evenly distributed across the observations, with {total_anomalies} occurrences."
            )

        # Generate LLM Narrative Explanation
        prompt = f"""
        Analyze the root cause of anomalies in the dataset.
        
        Context:
        - Target Column containing anomalies: '{column_name}'
        - Type of anomalies: {anomaly_type}
        - Statistical Finding:
          {correlation_context}
        
        Please provide a concise, high-impact business executive paragraph (under 4 sentences) explaining the potential operational root cause behind this clustering pattern. For instance, explain how system glitches, regional training gaps, or supplier ingestion errors might trigger this pattern. Write in clean, professional plain-English. Do not use generic placeholders or markdown block formatting.
        """
        
        system_prompt = (
            "You are an expert Data Forensic Analyst and Operations Auditor. Your goal is to explain "
            "data cleaning anomalies and statistical correlation patterns to business stakeholders."
        )

        try:
            explanation_text = await cloud_ai_engine.generate_insight(prompt=prompt, system_prompt=system_prompt)
            explanation_text = explanation_text.strip()
        except Exception as e:
            logger.error(f"Error calling LLM for anomaly explanation: {e}")
            explanation_text = f"Causal analysis was unable to generate. {correlation_context}"

        db_exp = AnomalyExplanation(
            workspace_id=workspace_id,
            upload_id=upload_id,
            column_name=column_name,
            explanation_text=explanation_text,
            chart_data=chart_data
        )
        
        db.add(db_exp)
        await db.commit()
        await db.refresh(db_exp)
        return db_exp

root_cause_engine_service = RootCauseDetectiveEngine()
