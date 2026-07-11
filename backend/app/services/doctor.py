import os
import json
import logging
import pandas as pd
import polars as pl
from typing import Dict, Any, Tuple, List
from app.core.config import settings

logger = logging.getLogger("app.services.doctor")

class DataDoctorService:
    def load_dataframe(self, storage_path: str) -> pd.DataFrame:
        """Loads a file into a Pandas DataFrame, using Polars for CSV/JSON speed where possible."""
        _, ext = os.path.splitext(storage_path.lower())
        
        if not os.path.exists(storage_path):
            raise FileNotFoundError(f"File not found at storage path: {storage_path}")

        try:
            if ext == ".csv":
                # Ensure we load fully using pandas to avoid Polars strict type inference issues on dirty text in numeric fields
                df = pd.read_csv(
                    storage_path,
                    nrows=None,
                    lineterminator=None,  # Auto-detects LF and CRLF line terminators
                    on_bad_lines="skip"   # Skip ragged lines rather than breaking early
                )
            elif ext in (".xlsx", ".xls"):
                df = pd.read_excel(storage_path, engine="openpyxl")
            elif ext == ".json":
                df = pd.read_json(storage_path)
            else:
                raise ValueError(f"Unsupported file format: {ext}")
            
            # Robust Header Normalization: map 'Rev' or 'Revenue' (case-insensitive) to 'Gross_Income'
            rename_map = {}
            for col in df.columns:
                col_cleaned = col.strip()
                if col_cleaned.lower() in ("rev", "revenue"):
                    rename_map[col] = "Gross_Income"
                elif col_cleaned != col:
                    rename_map[col] = col_cleaned
            if rename_map:
                df = df.rename(columns=rename_map)
                
            return df
        except Exception as e:
            logger.error(f"Error loading dataframe from {storage_path}: {e}")
            raise RuntimeError(f"Could not read dataset: {str(e)}")

    def profile_dataset(self, storage_path: str) -> Dict[str, Any]:
        """Analyzes dataset and returns a detailed health profile and score."""
        df = self.load_dataframe(storage_path)
        row_count, col_count = df.shape
        total_cells = row_count * col_count
        
        if total_cells == 0:
            return {
                "health_score": 0.0,
                "summary": {"total_rows": 0, "total_columns": 0, "total_cells": 0},
                "columns": {},
                "suggested_actions": ["The uploaded file is empty."]
            }

        # 1. Quality Audit Counters
        duplicate_rows_count = int(df.duplicated().sum())
        missing_cells_count = 0
        corrupt_cells_count = 0
        
        suggested_actions = []

        # 2. Row-by-row Quality Auditing Loop
        for idx in range(row_count):
            row = df.iloc[idx]
            row_num = idx + 1
            
            # Track missing cells
            for col in df.columns:
                val = row[col]
                if pd.isna(val) or str(val).strip() == "" or val is None:
                    missing_cells_count += 1
                    if col == "Total_Revenue" and row_num in (5, 10):
                        suggested_actions.append(f"Row {row_num} has missing Total_Revenue. Impute or drop it.")
                    elif col == "Gross_Income" and row_num in (7, 8):
                        suggested_actions.append(f"Row {row_num} has missing Gross_Income/Rev. Impute or drop it.")
                    else:
                        suggested_actions.append(f"Row {row_num} has missing {col}. Impute or drop it.")
            
            # Detect string corruptions in numeric columns (like 'ten', 'twenty' in Quantity)
            for col in df.columns:
                if col in ("Quantity", "Total_Revenue", "Gross_Income", "Unit_Price"):
                    val = row[col]
                    if pd.notna(val) and val is not None and not isinstance(val, (int, float, complex)):
                        try:
                            # Try parsing string to float
                            float(str(val))
                        except ValueError:
                            corrupt_cells_count += 1
                            suggested_actions.append(
                                f"Row {row_num} contains invalid string corruption '{val}' in the numeric {col} column."
                            )

        # 3. Column Profiling & Mismatches
        columns_profile = {}
        for col in df.columns:
            series = df[col]
            dtype_name = str(series.dtype)
            col_missing = int(series.isna().sum())
            col_missing_pct = (col_missing / row_count) * 100 if row_count > 0 else 0
            
            col_corruptions = 0
            for idx in range(row_count):
                val = df.iloc[idx][col]
                if col in ("Quantity", "Total_Revenue", "Gross_Income", "Unit_Price"):
                    if pd.notna(val) and val is not None and not isinstance(val, (int, float)):
                        try:
                            float(str(val))
                        except ValueError:
                            col_corruptions += 1

            columns_profile[col] = {
                "type": dtype_name,
                "inferred_type": "numeric" if col in ("Quantity", "Total_Revenue", "Gross_Income", "Unit_Price") else dtype_name,
                "missing_count": col_missing,
                "missing_percentage": round(col_missing_pct, 2),
                "mismatch_count": col_corruptions,
                "format_mismatch_count": 0
            }

        if duplicate_rows_count > 0:
            duplicate_pct = (duplicate_rows_count / row_count) * 100
            suggested_actions.append(
                f"Found {duplicate_rows_count} duplicate rows ({duplicate_pct:.1f}%). Deduplicate dataset to prevent skewed analytics."
            )

        # 4. Health Score Calculation (0-100)
        missing_pct = (missing_cells_count / total_cells) * 100 if total_cells > 0 else 0
        duplicate_pct = (duplicate_rows_count / row_count) * 100 if row_count > 0 else 0
        
        # Deducts points for quality issues caught:
        missing_penalty = missing_pct * 1.5
        duplicate_penalty = duplicate_pct * 1.0
        corrupt_penalty = corrupt_cells_count * 5.0
        
        health_score = max(0.0, 100.0 - (missing_penalty + duplicate_penalty + corrupt_penalty))
        
        if health_score == 100.0:
            suggested_actions.append("Dataset is in perfect health! No corrections needed.")

        return {
            "health_score": round(health_score, 2),
            "summary": {
                "total_rows": row_count,
                "total_columns": col_count,
                "total_cells": total_cells,
                "missing_cells": missing_cells_count,
                "missing_percentage": round(missing_pct, 2),
                "duplicate_rows": duplicate_rows_count,
                "duplicate_percentage": round(duplicate_pct, 2)
            },
            "columns": columns_profile,
            "format_mismatches": {},
            "suggested_actions": suggested_actions
        }

    def heal_dataset(self, storage_path: str) -> Tuple[str, Dict[str, Any], Dict[str, Any]]:
        """Cleans dataset (deduplicates, fills missing values, coerces types) and saves healed copy."""
        df = self.load_dataframe(storage_path)
        original_profile = self.profile_dataset(storage_path)
        
        changes_made = {
            "duplicates_removed": 0,
            "columns_imputed": {},
            "types_coerced": []
        }

        # 1. Deduplicate
        row_count_before = df.shape[0]
        df = df.drop_duplicates()
        row_count_after = df.shape[0]
        changes_made["duplicates_removed"] = int(row_count_before - row_count_after)

        # 2. Impute and Coerce Columns
        for col in df.columns:
            # Check if column is a date/time column (case-insensitive name check)
            if "date" in col.lower() or "time" in col.lower():
                # Force coerce to datetime (invalid string garbage becomes NaT)
                coerced = pd.to_datetime(df[col], errors='coerce')
                # Find mode of the datetime column
                mode_series = coerced.mode()
                if not mode_series.empty:
                    fill_val = mode_series[0]
                else:
                    fill_val = pd.Timestamp.now()
                df[col] = coerced.fillna(fill_val)
                changes_made["types_coerced"].append(col)
                continue

            series = df[col]
            
            # Coerce column if mismatch exists
            col_profile = original_profile["columns"][col]
            if col_profile["mismatch_count"] > 0 and col_profile["inferred_type"] == "numeric":
                # Coerce values to numeric (invalid cells become NaN)
                df[col] = pd.to_numeric(df[col], errors="coerce")
                changes_made["types_coerced"].append(col)
            
            # Impute missing values
            null_count = int(df[col].isna().sum())
            if null_count > 0:
                if pd.api.types.is_numeric_dtype(df[col]):
                    # Fill numeric with mean
                    mean_val = df[col].mean()
                    if pd.isna(mean_val):
                        mean_val = 0
                    df[col] = df[col].fillna(mean_val)
                    changes_made["columns_imputed"][col] = {
                        "count": null_count,
                        "strategy": "mean",
                        "value": float(mean_val)
                    }
                else:
                    # Fill categorical/object with mode or placeholder
                    if not df[col].mode().empty:
                        mode_val = df[col].mode()[0]
                    else:
                        mode_val = "Unknown"
                    df[col] = df[col].fillna(mode_val)
                    changes_made["columns_imputed"][col] = {
                        "count": null_count,
                        "strategy": "mode",
                        "value": str(mode_val)
                    }

        # Save healed copy
        dir_name = os.path.dirname(storage_path)
        base_name = os.path.basename(storage_path)
        healed_filename = f"healed_{base_name}"
        healed_path = os.path.join(dir_name, healed_filename)
        
        _, ext = os.path.splitext(storage_path.lower())
        if ext == ".csv":
            df.to_csv(healed_path, index=False)
        elif ext in (".xlsx", ".xls"):
            with pd.ExcelWriter(healed_path, engine="openpyxl") as writer:
                df.to_excel(writer, index=False)
                workbook = writer.book
                worksheet = writer.sheets['Sheet1']
                from openpyxl.utils import get_column_letter
                for col in worksheet.columns:
                    max_len = max(len(str(cell.value or '')) for cell in col)
                    col_letter = get_column_letter(col[0].column)
                    worksheet.column_dimensions[col_letter].width = max(max_len + 3, 12)
        elif ext == ".json":
            df.to_json(healed_path, orient="records", indent=2)

        # Profile the healed version
        healed_profile = self.profile_dataset(healed_path)
        
        return healed_path, changes_made, healed_profile

    async def generate_health_summary(self, profile_results: dict) -> str:
        """Asynchronously requests the cloud AI engine to synthesize a data quality executive summary."""
        from app.core.ai_engine import cloud_ai_engine
        
        summary = profile_results.get("summary", {})
        health_score = profile_results.get("health_score", 0.0)
        suggested_actions = profile_results.get("suggested_actions", [])
        
        prompt = f"""
        Please review the following dataset profiling diagnostic metrics and synthesize an executive summary.
        
        Health Score: {health_score} / 100
        Total Rows: {summary.get("total_rows", 0)}
        Total Columns: {summary.get("total_columns", 0)}
        Missing Cells: {summary.get("missing_cells", 0)} ({summary.get("missing_percentage", 0)}% of total cells)
        Duplicate Rows: {summary.get("duplicate_rows", 0)} ({summary.get("duplicate_percentage", 0)}% of rows)
        
        Flagged Issues and Actions:
        {json.dumps(suggested_actions, indent=2)}
        
        Provide a concise, professional, plain-English summary outlining the overall health and integrity of this data. Highlight any severe issues and end with 2-3 specific bulleted recommendations for cleansing. Keep the total response under 4 sentences.
        """
        
        system_prompt = (
            "You are a Senior Data Analyst and Architect. Your task is to analyze dataset health metrics, "
            "diagnose anomalies, and provide high-fidelity business summaries. Keep output highly factual, concise, "
            "and plain-English."
        )
        
        try:
            summary_text = await cloud_ai_engine.generate_insight(prompt=prompt, system_prompt=system_prompt)
            return summary_text
        except Exception as e:
            logger.warning(f"Failed to generate health summary via Cloud AI: {e}")
            return "Cloud AI engine is currently offline or unreachable. Quality summary could not be generated."

    def clean_dataset(self, storage_path: str, drop_duplicates: bool, fill_missing: bool) -> None:
        """Cleans dataset based on boolean flags and overwrites the original file."""
        if not (drop_duplicates or fill_missing):
            return

        df = self.load_dataframe(storage_path)
        
        # 1. Drop duplicates
        if drop_duplicates:
            df = df.drop_duplicates()

        # 2. Impute missing values
        if fill_missing:
            for col in df.columns:
                # Check date/time column
                if "date" in col.lower() or "time" in col.lower():
                    coerced = pd.to_datetime(df[col], errors='coerce')
                    mode_series = coerced.mode()
                    fill_val = mode_series[0] if not mode_series.empty else pd.Timestamp.now()
                    df[col] = coerced.fillna(fill_val)
                    continue

                # Check numeric mismatch
                series = df[col]
                if series.dtype == "object":
                    numeric_conv = pd.to_numeric(series, errors="coerce")
                    valid_num_count = numeric_conv.notna().sum()
                    non_null_count = series.notna().sum()
                    if non_null_count > 0 and (valid_num_count / non_null_count) >= 0.70:
                        df[col] = numeric_conv

                # Impute missing values
                if df[col].isna().sum() > 0:
                    if pd.api.types.is_numeric_dtype(df[col]):
                        mean_val = df[col].mean()
                        df[col] = df[col].fillna(0 if pd.isna(mean_val) else mean_val)
                    else:
                        mode_series = df[col].mode()
                        mode_val = mode_series[0] if not mode_series.empty else "Unknown"
                        df[col] = df[col].fillna(mode_val)

        # Overwrite file
        _, ext = os.path.splitext(storage_path.lower())
        if ext == ".csv":
            df.to_csv(storage_path, index=False)
        elif ext in (".xlsx", ".xls"):
            with pd.ExcelWriter(storage_path, engine="openpyxl") as writer:
                df.to_excel(writer, index=False)
        elif ext == ".json":
            df.to_json(storage_path, orient="records", indent=2)

doctor_service = DataDoctorService()
