import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from scipy.stats import ks_2samp

from app.models.monitor import DatasetFingerprint
from app.models.dataset import Dataset
from app.services.doctor import doctor_service

logger = logging.getLogger("app.services.drift_monitor")

class DatasetDriftMonitorService:
    async def evaluate_dataset_drift(
        self, 
        workspace_id: int, 
        upload_id: str, 
        df: pd.DataFrame, 
        db: AsyncSession
    ) -> List[DatasetFingerprint]:
        """
        Evaluates data drift by calculating column metrics (means, standard deviations, cardinality)
        and performing Kolmogorov-Smirnov tests against the previous runs in this workspace.
        """
        # 1. Locate the last recorded upload ID in this workspace context
        prev_stmt = select(DatasetFingerprint.upload_id).where(
            DatasetFingerprint.workspace_id == workspace_id,
            DatasetFingerprint.upload_id != upload_id
        ).order_by(DatasetFingerprint.created_at.desc()).limit(1)
        prev_res = await db.execute(prev_stmt)
        prev_upload_id = prev_res.scalars().first()

        prev_df = None
        if prev_upload_id:
            try:
                ds_stmt = select(Dataset).where(
                    Dataset.workspace_id == workspace_id,
                    Dataset.uuid == prev_upload_id
                )
                ds_res = await db.execute(ds_stmt)
                prev_ds = ds_res.scalars().first()
                if prev_ds:
                    prev_df = doctor_service.load_dataframe(prev_ds.storage_path)
            except Exception as load_err:
                logger.error(f"Failed to load previous dataset for drift check: {load_err}")

        fingerprints = []

        # 2. Iterate through columns of the newly ingested dataset
        for col in df.columns:
            cardinality = int(df[col].nunique())
            mean_val = None
            std_val = None
            p_val = None
            drift_status = "STABLE"

            # Check if column is numeric
            is_numeric = pd.api.types.is_numeric_dtype(df[col])
            if is_numeric:
                mean_val = float(df[col].mean()) if not pd.isna(df[col].mean()) else 0.0
                std_val = float(df[col].std()) if not pd.isna(df[col].std()) else 0.0

                # 3. Perform Kolmogorov-Smirnov test if a baseline dataset exists
                if prev_df is not None and col in prev_df.columns and pd.api.types.is_numeric_dtype(prev_df[col]):
                    try:
                        new_data = df[col].dropna()
                        old_data = prev_df[col].dropna()
                        if len(new_data) > 0 and len(old_data) > 0:
                            stat, p_val = ks_2samp(new_data, old_data)
                            p_val = float(p_val)
                            
                            if p_val < 0.05:
                                drift_status = "DRIFTED"
                            elif p_val < 0.20:
                                drift_status = "WARNING"
                            else:
                                drift_status = "STABLE"
                    except Exception as stats_err:
                        logger.error(f"KS-Test failed on column {col}: {stats_err}")
            
            # Save fingerprint records
            fp = DatasetFingerprint(
                workspace_id=workspace_id,
                upload_id=upload_id,
                column_name=str(col),
                mean_value=mean_val,
                std_dev_value=std_val,
                cardinality=cardinality,
                drift_status=drift_status,
                p_value=p_val
            )
            db.add(fp)
            fingerprints.append(fp)

        await db.commit()
        logger.info(f"Ingested {len(fingerprints)} dataset fingerprints for run {upload_id}.")
        return fingerprints

drift_monitor_service = DatasetDriftMonitorService()
