import logging
import json
import pandas as pd
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.ai_engine import cloud_ai_engine
from app.models.chat_session import AnalystChatSession
from app.models.dataset import Dataset
from app.services.doctor import doctor_service

logger = logging.getLogger("app.services.chat_copilot")

class ChatSessionManager:
    async def get_history(self, session_id: str, workspace_id: int, db: AsyncSession) -> List[AnalystChatSession]:
        """Safely retrieves chronologically ordered message streams for a session."""
        stmt = select(AnalystChatSession).where(
            AnalystChatSession.workspace_id == workspace_id,
            AnalystChatSession.session_id == session_id
        ).order_by(AnalystChatSession.created_at.asc())
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def process_query(
        self, 
        session_id: str, 
        workspace_id: int, 
        user_message: str, 
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Accepts a user message, workspace_id, and session_id. Resolves intent based on past chat context,
        performs calculations in pandas, and writes an LLM narrative explanation with visualization hints.
        """
        # 1. Fetch active dataset to load original data context
        dataset_stmt = select(Dataset).where(
            Dataset.workspace_id == workspace_id
        ).order_by(Dataset.created_at.desc())
        dataset_res = await db.execute(dataset_stmt)
        active_dataset = dataset_res.scalars().first()
        if not active_dataset:
            return {
                "answer_text": "Please upload a dataset first so that I can analyze your metrics.",
                "data": [],
                "chart_hint": "none"
            }

        try:
            df = doctor_service.load_dataframe(active_dataset.storage_path)
        except Exception as e:
            logger.error(f"Failed to load dataset: {e}")
            return {
                "answer_text": "Error: Could not load the active dataset context from storage.",
                "data": [],
                "chart_hint": "none"
            }

        # 2. Retrieve chronological past messages
        history = await self.get_history(session_id, workspace_id, db)
        history_text = ""
        for msg in history[-10:]: # Limit to last 10 messages for token context window
            role_label = "User" if msg.role == "user" else "Copilot"
            history_text += f"{role_label}: {msg.message_text}\n"

        # 3. Format intent classification prompt
        columns_schema = {col: str(df[col].dtype) for col in df.columns}
        
        intent_prompt = f"""
        Analyze the user's question and the conversation history to translate it into a structured pandas query intent object.
        
        Available Columns:
        {json.dumps(columns_schema, indent=2)}
        
        Conversation History:
        {history_text}
        
        Active User Question: "{user_message}"
        
        Respond ONLY with a valid, raw, minified JSON object matching the following structure:
        {{
            "metric_column": "numeric_column_name_or_null",
            "group_by_column": "categorical_column_name_or_null",
            "aggregation": "SUM|AVG|COUNT|MAX|MIN",
            "filters": [
                {{"column": "column_name", "operator": "==|!=|>|<", "value": "value"}}
            ]
        }}
        
        Do not include any preambles, explanations, markdown formatting blocks (such as ```json), or trailing text.
        """
        
        system_prompt = (
            "You are a semantic query parser. Your sole job is to translate user queries and dialogue history "
            "into structured pandas intents based on the schema. You output ONLY raw JSON."
        )

        intent = {}
        try:
            intent_text = await cloud_ai_engine.generate_insight(prompt=intent_prompt, system_prompt=system_prompt)
            intent_text = intent_text.strip()
            if intent_text.startswith("```"):
                lines = intent_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                intent_text = "\n".join(lines).strip()
            
            intent = json.loads(intent_text)
        except Exception as e:
            logger.warning(f"Failed to parse LLM chat intent: {e}")
            intent = {
                "metric_column": None,
                "group_by_column": None,
                "aggregation": "COUNT",
                "filters": []
            }

        # 4. Perform calculations using Pandas
        filtered_df = df.copy()
        for f in intent.get("filters", []):
            col = f.get("column")
            op = f.get("operator")
            val = f.get("value")
            if col in filtered_df.columns:
                try:
                    if op == "==":
                        filtered_df = filtered_df[filtered_df[col].astype(str) == str(val)]
                    elif op == "!=":
                        filtered_df = filtered_df[filtered_df[col].astype(str) != str(val)]
                    elif op == ">":
                        filtered_df = filtered_df[pd.to_numeric(filtered_df[col], errors='coerce') > float(val)]
                    elif op == "<":
                        filtered_df = filtered_df[pd.to_numeric(filtered_df[col], errors='coerce') < float(val)]
                except Exception as filter_err:
                    logger.debug(f"Filter application failed on col {col}: {filter_err}")

        metric_col = intent.get("metric_column")
        if not metric_col or metric_col not in filtered_df.columns:
            # Fallback to first numeric column or default count
            numeric_cols = [c for c in filtered_df.columns if pd.api.types.is_numeric_dtype(filtered_df[c])]
            metric_col = numeric_cols[0] if numeric_cols else None

        group_col = intent.get("group_by_column")
        if group_col and group_col not in filtered_df.columns:
            group_col = None

        agg = intent.get("aggregation", "COUNT").upper()
        if agg not in ("SUM", "AVG", "COUNT", "MAX", "MIN"):
            agg = "COUNT"

        chart_data = []
        chart_hint = "none"
        calculated_value = None

        try:
            if group_col:
                # Grouped breakdown
                if agg == "COUNT" or not metric_col:
                    grouped = filtered_df.groupby(group_col).size()
                elif agg == "SUM":
                    grouped = filtered_df.groupby(group_col)[metric_col].sum()
                elif agg == "AVG":
                    grouped = filtered_df.groupby(group_col)[metric_col].mean()
                elif agg == "MAX":
                    grouped = filtered_df.groupby(group_col)[metric_col].max()
                else:
                    grouped = filtered_df.groupby(group_col)[metric_col].min()

                # Limit to top 15 categories for clean visual display
                grouped = grouped.sort_values(ascending=False).head(15)
                
                chart_data = [
                    {"category": str(k), "value": round(float(v), 2) if isinstance(v, (int, float)) else v}
                    for k, v in grouped.items()
                ]
                
                # Determine chart hint type
                if "date" in group_col.lower() or "time" in group_col.lower() or "year" in group_col.lower() or "month" in group_col.lower():
                    chart_hint = "line"
                elif len(chart_data) <= 4:
                    chart_hint = "pie"
                else:
                    chart_hint = "bar"
            else:
                # Single scalar aggregation
                if agg == "COUNT":
                    calculated_value = len(filtered_df)
                else:
                    if metric_col:
                        numeric_series = pd.to_numeric(filtered_df[metric_col], errors='coerce')
                        if agg == "SUM":
                            calculated_value = numeric_series.sum()
                        elif agg == "AVG":
                            calculated_value = numeric_series.mean()
                        elif agg == "MAX":
                            calculated_value = numeric_series.max()
                        else:
                            calculated_value = numeric_series.min()
                    else:
                        calculated_value = len(filtered_df)

                if pd.isna(calculated_value):
                    calculated_value = 0
                calculated_value = round(float(calculated_value), 2) if isinstance(calculated_value, (int, float)) else calculated_value
                chart_data = [{"category": "Result", "value": calculated_value}]
                chart_hint = "none"

        except Exception as calc_err:
            logger.error(f"Error executing pandas computation: {calc_err}")
            calculated_value = "Unavailable"
            chart_data = []
            chart_hint = "none"

        # 5. Generate LLM Narrative Answer Text
        ans_prompt = f"""
        You are an expert conversational business intelligence analyst. Answering user queries directly.
        
        User Question: "{user_message}"
        Calculated Aggregate Data Context:
        - Metric Column: '{metric_col}'
        - Group By Dimension: '{group_col}'
        - Operation: {agg}
        - Computed Data: {json.dumps(chart_data, indent=2) if group_col else calculated_value}
        
        Write a concise, professional plain-English response directly answering the user's question (under 3 sentences). Refer to values explicitly. Do not mention coding structure, pandas, JSON, or SQL names.
        """
        
        ans_system_prompt = (
            "You are a Senior Business Intelligence Copilot. You synthesize computed tabular results "
            "into clear, high-impact verbal business answers."
        )

        try:
            answer_text = await cloud_ai_engine.generate_insight(prompt=ans_prompt, system_prompt=ans_system_prompt)
            answer_text = answer_text.strip()
        except Exception as e:
            logger.error(f"Error calling LLM for answer text: {e}")
            if group_col:
                answer_text = f"Calculated breakdown for {metric_col} grouped by {group_col} completed."
            else:
                answer_text = f"The requested computation yielded the result: {calculated_value}."

        # 6. Save user query and assistant response to SQLite database
        user_record = AnalystChatSession(
            session_id=session_id,
            workspace_id=workspace_id,
            role="user",
            message_text=user_message,
            chart_hint="none",
            chart_data=None
        )
        assistant_record = AnalystChatSession(
            session_id=session_id,
            workspace_id=workspace_id,
            role="assistant",
            message_text=answer_text,
            chart_hint=chart_hint,
            chart_data=chart_data
        )

        db.add(user_record)
        db.add(assistant_record)
        await db.commit()

        return {
            "answer_text": answer_text,
            "data": chart_data,
            "chart_hint": chart_hint
        }

chat_copilot_service = ChatSessionManager()
