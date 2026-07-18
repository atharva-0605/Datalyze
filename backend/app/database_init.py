import logging
import os
from sqlalchemy import text
from app.core.database import engine
from app.models.base import Base
from app.models.template import Template

# Import models to ensure they are registered on the Base metadata
from app.models.workspace import Workspace
from app.models.user import User
from app.models.dataset import Dataset
from app.models.widget import Widget
from app.models.anomaly import AnomalyExplanation
from app.models.chat_session import AnalystChatSession
from app.models.canvas import CanvasComment
from app.models.report import ExecutiveReport
from app.models.monitor import DatasetFingerprint
from app.models.schema_mapper import SchemaMapping
from app.models.insight import Insight, Report
from app.models.integration import Integration

logger = logging.getLogger("app.database_init")

TEMPLATES_METADATA = {
    "student_productivity.csv": {
        "name": "Student Productivity Template",
        "description": "Deploys a high-density performance-velocity layout designed to track student milestone time allocation, productivity metrics, and focus velocity streaks.",
        "default_config_json": '{"growthRate": 0.15, "attritionRate": 0.05, "targetSector": "Productivity"}'
    },
    "food_delivery.csv": {
        "name": "Food Delivery Operations Template",
        "description": "Deploys a wide-pane logistics overview layout designed to expose fulfillment bottlenecks and regional volume trends.",
        "default_config_json": '{"growthRate": 0.10, "attritionRate": 0.03, "targetSector": "Logistics"}'
    },
    "security_auditor.csv": {
        "name": "Security Auditor Compliance Template",
        "description": "Deploys a data-heavy risk and validation auditing board layout designed to highlight system discrepancies.",
        "default_config_json": '{"growthRate": 0.18, "attritionRate": 0.12, "targetSector": "Compliance"}'
    },
    "retail_sales_demo.csv": {
        "name": "Retail Sales Demo Template",
        "description": "Deploys a balanced financial monitoring suite mapping regional fiscal streams.",
        "default_config_json": '{"growthRate": 0.22, "attritionRate": 0.07, "targetSector": "Commercial Revenue"}'
    },
    "saas_churn_demo.csv": {
        "name": "SaaS Enterprise Churn Metrics Template",
        "description": "Analyze monthly recurring revenue (MRR) structures, customer lifetime value (LTV) anomalies, churn velocity factors, and cohort retention distributions across contract tiers.",
        "default_config_json": '{"growthRate": 0.25, "attritionRate": 0.08, "targetSector": "SaaS Enterprise"}'
    }
}

async def init_db() -> None:
    """Creates all database tables defined by SQLAlchemy models if they do not exist."""
    logger.info("Initializing database tables...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing database tables: {e}")
        raise

    logger.info("Purging temporary asset folders and test outputs...")
    import shutil
    
    # 1. Clear emails/
    emails_dir = "storage/emails"
    if not os.path.exists(emails_dir):
        emails_dir = "backend/storage/emails"
    if os.path.exists(emails_dir):
        for item in os.listdir(emails_dir):
            item_path = os.path.join(emails_dir, item)
            try:
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                else:
                    os.remove(item_path)
            except Exception:
                pass

    # 2. Clear uploads/
    uploads_dir = "storage/uploads"
    if not os.path.exists(uploads_dir):
        uploads_dir = "backend/storage/uploads"
    if os.path.exists(uploads_dir):
        for item in os.listdir(uploads_dir):
            item_path = os.path.join(uploads_dir, item)
            try:
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                else:
                    os.remove(item_path)
            except Exception:
                pass

    # 3. Clear workspace directories (e.g. workspace_*)
    storage_dir = "storage"
    if not os.path.exists(storage_dir):
        storage_dir = "backend/storage"
    if os.path.exists(storage_dir):
        for item in os.listdir(storage_dir):
            if item.startswith("workspace_") or item == "workspaces" or item == "exports":
                item_path = os.path.join(storage_dir, item)
                try:
                    shutil.rmtree(item_path)
                except Exception:
                    pass

    # 4. Clear test_output.pbix
    for root_dir in [".", "backend"]:
        pbix_path = os.path.join(root_dir, "test_output.pbix")
        if os.path.exists(pbix_path):
            try:
                os.remove(pbix_path)
            except Exception:
                pass

    logger.info("Running automatic test-data purge routine...")
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text("DELETE FROM insights WHERE workspace_id NOT IN (SELECT id FROM workspaces);")
            )
            # Wipe existing insights records to start fresh without cross-workspace contamination
            await conn.execute(text("DELETE FROM insights;"))
        logger.info("Test-data purge routine and insights wipe completed successfully.")
    except Exception as e:
        logger.warning(f"Failed to execute automatic test-data purge routine: {e}")

    logger.info("Scanning and seeding database marketplace templates from disk...")
    try:
        templates_dir = "storage/templates"
        if not os.path.exists(templates_dir):
            templates_dir = "backend/storage/templates"

        if os.path.exists(templates_dir):
            async with engine.begin() as conn:
                # Get existing templates
                result = await conn.execute(text("SELECT name, sample_csv_path FROM templates;"))
                existing = {(row[0], row[1]) for row in result.all()}
                
                # Scan files
                files = os.listdir(templates_dir)
                for file in files:
                    if file.endswith(".csv") and file in TEMPLATES_METADATA:
                        meta = TEMPLATES_METADATA[file]
                        sample_path = os.path.join("storage/templates", file)
                        
                        # Check if already exists in database
                        exists_in_db = False
                        for name, path in existing:
                            if name == meta["name"] or os.path.basename(path) == file:
                                exists_in_db = True
                                break
                        
                        if not exists_in_db:
                            logger.info(f"Seeding template: {meta['name']} from {file}...")
                            await conn.execute(
                                text(
                                    "INSERT INTO templates (name, description, sample_csv_path, default_config_json) "
                                    "VALUES (:name, :description, :sample_csv_path, :default_config_json);"
                                ),
                                {
                                    "name": meta["name"],
                                    "description": meta["description"],
                                    "sample_csv_path": sample_path,
                                    "default_config_json": meta["default_config_json"]
                                }
                            )
                logger.info("Seeding database marketplace templates completed.")
        else:
            logger.warning(f"Templates storage directory not found: {templates_dir}")
    except Exception as e:
        logger.warning(f"Failed to scan or seed marketplace templates: {e}")
