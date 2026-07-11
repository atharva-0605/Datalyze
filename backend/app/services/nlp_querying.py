import pandas as pd
import logging
from typing import Dict, Any

logger = logging.getLogger("app.services.nlp_querying")

class NLPQueryingService:
    async def process_chat_query(self, user_question: str, df: pd.DataFrame, dataset_metadata: dict) -> Dict[str, Any]:
        """Processes natural language questions against dataframe metadata and data rows.
        
        Handles common analytical keywords ('summary', 'rows', column titles) and returns
        either text responses or tabular matrices.
        """
        question = user_question.lower().strip()
        
        # 1. Row count query
        if any(kw in question for kw in ["row count", "how many rows", "number of rows", "total rows", "how many records"]):
            return {
                "target_column": None,
                "aggregation": "COUNT",
                "filters": [],
                "status": "success",
                "calculated_value": str(df.shape[0]),
                "matched_rows_count": df.shape[0],
                "error_message": None
            }
            
        # 2. Dataset summary/metadata query
        if any(kw in question for kw in ["summary", "describe", "metadata", "profile", "overview", "columns"]):
            col_list = ", ".join([f"'{c}'" for c in df.columns])
            summary_text = (
                f"Dataset Metadata Summary:\n"
                f"- Total Rows: {df.shape[0]}\n"
                f"- Total Columns: {df.shape[1]}\n"
                f"- Columns list: {col_list}\n"
                f"- Missing Values: {df.isna().sum().sum()} cells"
            )
            return {
                "target_column": None,
                "aggregation": "NONE",
                "filters": [],
                "status": "success",
                "calculated_value": summary_text,
                "matched_rows_count": df.shape[0],
                "error_message": None
            }

        # 3. Deterministic rules-based intent parsing (MAX, SUM, MIN, AVG, COUNT)
        # Check aggregation keywords
        aggregation = "NONE"
        if any(kw in question for kw in ["highest", "maximum", "max", "top", "greatest"]):
            aggregation = "MAX"
        elif any(kw in question for kw in ["most", "total", "sum", "combined", "cumulative"]):
            aggregation = "SUM"
        elif any(kw in question for kw in ["average", "avg", "mean"]):
            aggregation = "AVG"
        elif any(kw in question for kw in ["lowest", "minimum", "min", "smallest"]):
            aggregation = "MIN"

        # Fuzzy target column resolution mapping ignoring space structures or casing mismatches
        def clean_str(s: str) -> str:
            return s.lower().replace("_", "").replace(" ", "").replace("-", "").strip()

        target_column = None
        best_score = 0
        q_cleaned = clean_str(question)

        for col in df.columns:
            col_cleaned = clean_str(col)
            score = 0
            # Exact clean match of the column name in question
            if col_cleaned in q_cleaned:
                score += len(col_cleaned) + 10
            # Match individual words of column name
            col_parts = col.lower().replace("_", " ").replace("-", " ").split()
            for part in col_parts:
                if len(part) > 2 and part in question:
                    score += len(part)
            
            if score > best_score:
                best_score = score
                target_column = col

        if target_column and aggregation != "NONE":
            try:
                from app.services.query_executor import query_executor_service
                intent = {
                    "target_column": target_column,
                    "aggregation": aggregation,
                    "filters": [],
                    "dimension": None,
                    "question": user_question
                }
                
                # If aggregation requires sorting (e.g. finding highest/top values)
                if aggregation in ("MAX", "MIN") and target_column in df.columns:
                    # Let's ensure sorting is performed if needed
                    df_sorted = df.sort_values(by=target_column, ascending=(aggregation == "MIN"))
                else:
                    df_sorted = df
                    
                exec_res = query_executor_service.execute_intent_on_dataframe(df_sorted, intent)
                calculated_val = exec_res.get("calculated_value")
                
                if exec_res.get("status") == "success" and calculated_val is not None:
                    return {
                        "target_column": target_column,
                        "aggregation": aggregation,
                        "filters": [],
                        "status": "success",
                        "calculated_value": str(calculated_val),
                        "matched_rows_count": exec_res.get("matched_rows_count", df.shape[0]),
                        "error_message": None
                    }
            except Exception as e:
                logger.error(f"Deterministic rules-based query execution failed: {e}")

        # 4. Fallback to LLM intent parse and query execution
        from app.services.nlp_engine import nlp_analysis_engine
        from app.services.query_executor import query_executor_service
        
        # Build schema dict for translation
        schema_dict = {col: str(df[col].dtype) for col in df.columns}
        
        intent = await nlp_analysis_engine.translate_query_to_intent(
            user_question=user_question,
            dataset_schema=schema_dict
        )
        
        exec_res = query_executor_service.execute_intent_on_dataframe(df, intent)
        
        calculated_val = exec_res.get("calculated_value")
        if calculated_val is None:
            calculated_val = "Could not compute a specific numeric answer. Check query format."
            
        return {
            "target_column": intent.get("target_column"),
            "aggregation": intent.get("aggregation", "NONE"),
            "filters": intent.get("filters", []),
            "status": exec_res.get("status", "success"),
            "calculated_value": str(calculated_val),
            "matched_rows_count": exec_res.get("matched_rows_count", 0),
            "error_message": exec_res.get("message")
        }

nlp_querying_service = NLPQueryingService()
