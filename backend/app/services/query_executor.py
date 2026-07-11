import pandas as pd
import numpy as np
from typing import Dict, Any

class QueryExecutorService:
    def execute_intent_on_dataframe(self, df: pd.DataFrame, intent: Dict[str, Any]) -> Dict[str, Any]:
        """Applies filters and executes aggregation calculations dynamically against the DataFrame."""
        try:
            filtered_df = df.copy()
            filters = intent.get("filters", [])
            
            # Apply row-level filters
            for f in filters:
                col = f.get("column")
                op = f.get("operator")
                val = f.get("value")
                
                if col not in filtered_df.columns:
                    continue
                
                # Dynamic operator evaluation
                if op == "==":
                    filtered_df = filtered_df[filtered_df[col].astype(str) == str(val)]
                elif op == "!=":
                    filtered_df = filtered_df[filtered_df[col].astype(str) != str(val)]
                elif op == ">":
                    filtered_df = filtered_df[pd.to_numeric(filtered_df[col], errors='coerce') > float(val)]
                elif op == "<":
                    filtered_df = filtered_df[pd.to_numeric(filtered_df[col], errors='coerce') < float(val)]
                elif op == ">=":
                    filtered_df = filtered_df[pd.to_numeric(filtered_df[col], errors='coerce') >= float(val)]
                elif op == "<=":
                    filtered_df = filtered_df[pd.to_numeric(filtered_df[col], errors='coerce') <= float(val)]
                elif op in ("contains", "like"):
                    filtered_df = filtered_df[filtered_df[col].astype(str).str.contains(str(val), case=False, na=False)]

            # Extract target column & aggregation parameters
            target_col = intent.get("target_column")
            agg = intent.get("aggregation", "COUNT").upper()
            dimension = intent.get("dimension")
            question = intent.get("question", "").lower()
            
            # Sanitize target column string
            if not target_col or target_col in ("None", "*", "null", "undefined"):
                target_col = None

            matched_count = len(filtered_df)

            # If the user asks for a specific text lookup (like city, product line, etc.)
            # Check if a text dimension column is specified or can be inferred from the user question
            text_col = None
            if dimension and dimension in filtered_df.columns:
                text_col = dimension
            else:
                # Fallback scanner: scan dataframe columns to see if any text/categorical column is mentioned in the question
                for col in filtered_df.columns:
                    if col.lower() in question:
                        # Check if it's a non-numeric column, or if it matches target_col we prefer it as the lookup column
                        if col != target_col:
                            text_col = col
                            break

            # If MAX or MIN is requested and matched_count > 0, we can identify the peak/trough row
            if agg in ("MAX", "MIN") and matched_count > 0 and target_col and target_col in filtered_df.columns:
                numeric_series = pd.to_numeric(filtered_df[target_col], errors='coerce')
                
                # Check where peak occurs
                if agg == "MAX":
                    peak_idx = numeric_series.idxmax()
                else:
                    peak_idx = numeric_series.idxmin()
                
                # If a valid row index was found and we have a text_col to extract
                if pd.notna(peak_idx) and text_col and text_col in filtered_df.columns:
                    # Look up string value from that specific row
                    result = str(filtered_df.loc[peak_idx, text_col])
                    return {
                        "status": "success",
                        "calculated_value": result,
                        "matched_rows_count": matched_count
                    }

            # Evaluate standard aggregation calculations
            if agg == "COUNT":
                if target_col is not None and target_col in filtered_df.columns:
                    result = int(filtered_df[target_col].count())
                else:
                    result = int(matched_count)
            else:
                if not target_col or target_col not in filtered_df.columns:
                    raise ValueError(f"Aggregation '{agg}' requires a valid target column.")
                
                numeric_series = pd.to_numeric(filtered_df[target_col], errors='coerce')
                
                if agg == "SUM":
                    result = float(numeric_series.sum())
                elif agg in ("AVG", "AVERAGE", "MEAN"):
                    mean_val = numeric_series.mean()
                    result = float(mean_val) if not pd.isna(mean_val) else 0.0
                elif agg == "MAX":
                    max_val = numeric_series.max()
                    result = float(max_val) if not pd.isna(max_val) else 0.0
                elif agg == "MIN":
                    min_val = numeric_series.min()
                    result = float(min_val) if not pd.isna(min_val) else 0.0
                else:
                    raise ValueError(f"Unsupported aggregation: {agg}")

            if pd.isna(result):
                result = 0.0

            return {
                "status": "success",
                "calculated_value": result,
                "matched_rows_count": matched_count
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Execution failed: {str(e)}",
                "calculated_value": None,
                "matched_rows_count": 0
            }

query_executor_service = QueryExecutorService()
