import os
import sqlite3
import logging
import shutil

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration")

def purge_local_storage():
    """
    Automated startup utility hook to clear out leftover dynamic files in emails,
    uploads, and user workspace folders while keeping folder structures intact.
    """
    logger.info("Purging temporary asset folders and test outputs...")
    
    # 1. Clear backend/storage/emails/
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
            except Exception as e:
                logger.warning(f"Failed to delete {item_path}: {e}")

    # 2. Clear backend/storage/uploads/
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
            except Exception as e:
                logger.warning(f"Failed to delete {item_path}: {e}")

    # 3. Clear workspace directories (e.g. backend/storage/workspace_*)
    storage_dir = "storage"
    if not os.path.exists(storage_dir):
        storage_dir = "backend/storage"
    if os.path.exists(storage_dir):
        for item in os.listdir(storage_dir):
            if item.startswith("workspace_") or item == "workspaces" or item == "exports":
                item_path = os.path.join(storage_dir, item)
                try:
                    shutil.rmtree(item_path)
                except Exception as e:
                    logger.warning(f"Failed to delete workspace/export folder {item_path}: {e}")

    # 4. Clear test_output.pbix
    for root_dir in [".", "backend"]:
        pbix_path = os.path.join(root_dir, "test_output.pbix")
        if os.path.exists(pbix_path):
            try:
                os.remove(pbix_path)
                logger.info(f"Removed leftover file: {pbix_path}")
            except Exception as e:
                logger.warning(f"Failed to delete {pbix_path}: {e}")

def run_db_migration():
    db_path = "datalyze.db"
    
    # 1. Purge storage files first
    purge_local_storage()

    # 2. Flush SQLite Database State completely
    logger.info("Flushing SQLite Database State completely via SQLAlchemy metadata...")
    import asyncio
    from app.core.database import engine
    from app.models.base import Base
    
    # Import all models to ensure they are registered on the Base metadata
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
    from app.models.template import Template

    async def reset_tables():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(reset_tables())
    logger.info("Database structural tables dropped and re-created successfully (blank state).")

    # 3. Connect to database at datalyze.db to seed templates
    logger.info(f"Connecting to database at {db_path} to seed marketplace templates...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Seed templates and create sample CSVs
        templates_dir = os.path.abspath("./storage/templates")
        os.makedirs(templates_dir, exist_ok=True)
        
        retail_csv = os.path.join(templates_dir, "retail_sales_demo.csv")
        if not os.path.exists(retail_csv):
            with open(retail_csv, "w") as f:
                f.write("Invoice_ID,Branch,City,Customer_Type,Gender,Product_Line,Unit_Price,Quantity,Tax_5,Total_Revenue,Date,Time,Payment,COGS,Gross_Margin_Percentage,Gross_Income,Rating\n")
                f.write("INV-1001,A,Yangon,Member,Female,Fashion,45.5,3,6.82,143.32,2026-03-01,13:00,Credit card,136.5,4.76,6.82,7.5\n")
                f.write("INV-1002,B,Mandalay,Normal,Male,Electronic,85.0,2,8.5,178.5,2026-03-02,14:30,Cash,170.0,4.76,8.5,8.0\n")
                f.write("INV-1003,A,Yangon,Normal,Female,Home,30.0,5,7.5,157.5,2026-03-03,10:15,Ewallet,150.0,4.76,7.5,6.8\n")
                f.write("INV-1004,C,Naypyitaw,Member,Male,Sports,55.0,4,11.0,231.0,2026-03-04,18:00,Cash,220.0,4.76,11.0,9.2\n")
                f.write("INV-1005,A,Yangon,Member,Female,Food,20.0,10,10.0,210.0,2026-03-05,12:45,Credit card,200.0,4.76,10.0,7.0\n")

        saas_csv = os.path.join(templates_dir, "saas_churn_demo.csv")
        if not os.path.exists(saas_csv):
            with open(saas_csv, "w") as f:
                f.write("Customer_ID,Tenure_Months,Monthly_Charges,Total_Charges,Churn_Status,Support_Tickets,Plan_Type\n")
                f.write("CUST-001,12,65.0,780.0,No,1,Basic\n")
                f.write("CUST-002,3,99.0,297.0,Yes,5,Premium\n")
                f.write("CUST-003,24,80.0,1920.0,No,0,Standard\n")
                f.write("CUST-004,1,45.0,45.0,Yes,4,Basic\n")
                f.write("CUST-005,18,120.0,2160.0,No,2,Premium\n")

        student_csv = os.path.join(templates_dir, "student_productivity.csv")
        if not os.path.exists(student_csv):
            with open(student_csv, "w") as f:
                f.write("Student_ID,Study_Hours,Crisis_Alarm_Triggers,Focus_Streak_Days,Task_Clearance_Velocity\n")
                f.write("STU-101,6.5,0,5,85.0\n")
                f.write("STU-102,8.0,1,12,92.5\n")
                f.write("STU-103,4.0,3,2,60.0\n")
                f.write("STU-104,10.0,0,21,98.0\n")
                f.write("STU-105,5.5,2,4,72.0\n")

        delivery_csv = os.path.join(templates_dir, "food_delivery.csv")
        if not os.path.exists(delivery_csv):
            with open(delivery_csv, "w") as f:
                f.write("Courier_ID,Transit_Time_Min,Cancel_Ratio,Culinary_Category,Dispatch_Frequency\n")
                f.write("COUR-201,25,0.05,Pizza,14\n")
                f.write("COUR-202,18,0.02,Burger,22\n")
                f.write("COUR-203,35,0.12,Sushi,8\n")
                f.write("COUR-204,15,0.00,Salad,30\n")
                f.write("COUR-205,30,0.08,Asian,12\n")

        security_csv = os.path.join(templates_dir, "security_auditor.csv")
        if not os.path.exists(security_csv):
            with open(security_csv, "w") as f:
                f.write("Visitor_ID,Pass_Rate,Scanning_Confidence,Fake_Credential_Flag,Check_In_Timestamp\n")
                f.write("VIS-301,0.98,0.95,0,2026-03-01 08:30:00\n")
                f.write("VIS-302,0.85,0.72,0,2026-03-01 09:15:00\n")
                f.write("VIS-303,0.30,0.45,1,2026-03-01 10:00:00\n")
                f.write("VIS-304,1.00,0.99,0,2026-03-01 11:20:00\n")
                f.write("VIS-305,0.50,0.60,1,2026-03-01 12:45:00\n")

        cursor.execute("SELECT name FROM templates;")
        existing_names = [r[0] for r in cursor.fetchall()]
        
        seeds = [
            ('Retail Sales Demo', 'Supermarket transactions dataset containing product categories, branch metrics, simulated profit margins, and ratings.', retail_csv, '{"required_columns": ["Invoice_ID", "Quantity", "Total_Revenue", "Gross_Income"], "slider_growth": 0.05, "target_k": 3}'),
            ('SaaS Churn Demo', 'Customer subscription dataset containing monthly pricing, service tier metrics, and support ticket frequencies.', saas_csv, '{"required_columns": ["Customer_ID", "Tenure_Months", "Monthly_Charges", "Total_Charges"], "slider_growth": -0.02, "target_k": 2}'),
            ('Deadline-Shoot Student Productivity', 'Tracks student time management schedules, focus streaks, crisis triggers, and task clearance velocities.', student_csv, '{"required_columns": ["Student_ID", "Study_Hours", "Crisis_Alarm_Triggers", "Focus_Streak_Days", "Task_Clearance_Velocity"], "slider_growth": 0.08, "target_k": 3}'),
            ('Quick-Bit Food Delivery Logs', 'Formats courier dispatch frequencies, delivery transit times, regional cancel ratios, and culinary item categories.', delivery_csv, '{"required_columns": ["Courier_ID", "Transit_Time_Min", "Cancel_Ratio", "Culinary_Category", "Dispatch_Frequency"], "slider_growth": -0.04, "target_k": 2}'),
            ('Security Pass & Credentials Auditor', 'Maps visitor check-in timestamps, verification pass rates, identity scanning confidence metrics, and fake credential flags.', security_csv, '{"required_columns": ["Visitor_ID", "Pass_Rate", "Scanning_Confidence", "Fake_Credential_Flag", "Check_In_Timestamp"], "slider_growth": 0.01, "target_k": 4}')
        ]
        
        for name, desc, path, config_json in seeds:
            if name not in existing_names:
                cursor.execute("""
                INSERT INTO templates (name, description, sample_csv_path, default_config_json) VALUES (?, ?, ?, ?);
                """, (name, desc, path, config_json))

        conn.commit()
        logger.info("Marketplace templates seeded successfully.")
    except Exception as e:
        conn.rollback()
        logger.error(f"Migration / Seeding failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_db_migration()
