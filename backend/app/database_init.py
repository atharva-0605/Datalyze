import logging
from sqlalchemy import text
from app.core.database import engine
from app.models.base import Base

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
from app.models.template import Template
from app.models.integration import Integration

logger = logging.getLogger("app.database_init")

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

    logger.info("Running automatic test-data purge routine...")
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text("DELETE FROM insights WHERE workspace_id NOT IN (SELECT id FROM workspaces);")
            )
        logger.info("Test-data purge routine completed successfully.")
    except Exception as e:
        logger.warning(f"Failed to execute automatic test-data purge routine: {e}")

    logger.info("Checking database marketplace templates...")
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT COUNT(*) FROM templates;"))
            count = result.scalar()
            if count == 0:
                logger.info("Templates table is empty. Seeding canonical marketplace templates...")
                await conn.execute(
                    text(
                        "INSERT INTO templates (name, description, sample_csv_path, default_config_json) "
                        "VALUES (:name, :description, :sample_csv_path, :default_config_json);"
                    ),
                    [
                        {
                            "name": "Commercial Revenue & Market Performance",
                            "description": "Deploys a balanced financial monitoring suite mapping regional fiscal streams. Configures a Branch Revenue Bar Chart, a Product Profit Combo Line/Bar Chart, a Temporal Sales Trend Area Chart, a Smart City Quantity Donut, and a Top Records Matrix Table.",
                            "sample_csv_path": "large_corrupted_dataset.csv",
                            "default_config_json": '{"growthRate": 0.15, "attritionRate": 0.05, "targetSector": "Commercial Revenue"}',
                        },
                        {
                            "name": "SaaS Enterprise Churn Metrics",
                            "description": "Analyze monthly recurring revenue (MRR) structures, customer lifetime value (LTV) anomalies, churn velocity factors, and cohort retention distributions across contract tiers.",
                            "sample_csv_path": "large_corrupted_dataset.csv",
                            "default_config_json": '{"growthRate": 0.22, "attritionRate": 0.07, "targetSector": "SaaS Enterprise"}',
                        },
                        {
                            "name": "Logistics & Supply Chain Operations",
                            "description": "Profile fulfillment latency distributions, delivery route anomalies, warehouse storage health capacity maps, and vehicle transit health scores.",
                            "sample_csv_path": "large_corrupted_dataset.csv",
                            "default_config_json": '{"growthRate": 0.10, "attritionRate": 0.03, "targetSector": "Logistics Operations"}',
                        },
                        {
                            "name": "Digital Marketing Analytics Hub",
                            "description": "Audit omni-channel acquisition funnel parameters, customer conversion anomalies, ad spend return variances (ROAS), and high-value segment tracking indices.",
                            "sample_csv_path": "large_corrupted_dataset.csv",
                            "default_config_json": '{"growthRate": 0.18, "attritionRate": 0.12, "targetSector": "Digital Marketing"}',
                        },
                    ]
                )
                logger.info("Marketplace templates seeded successfully.")
            else:
                logger.info("Marketplace templates already exist. Skipping seeding.")
    except Exception as e:
        logger.warning(f"Failed to check or seed marketplace templates: {e}")
