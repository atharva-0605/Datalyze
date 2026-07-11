import os
import sqlite3
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration")

def run_db_migration():
    db_path = "datalyze.db"
    if not os.path.exists(db_path):
        logger.warning(f"Database file '{db_path}' not found. Skipping migration updates.")
        return

    logger.info(f"Connecting to database at {db_path} to perform migration...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 1. Create workspaces table if not exists
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS workspaces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(255) NOT NULL,
            owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        
        # 2. Create widgets table with workspace_id foreign key & index
        logger.info("Creating widgets table and indexing workspace_id...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS widgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid VARCHAR(36) UNIQUE,
            title VARCHAR(255) NOT NULL,
            type VARCHAR(50) NOT NULL,
            xAxisColumn VARCHAR(255),
            yAxisColumn VARCHAR(255),
            xAxisKey VARCHAR(255),
            yAxisKey VARCHAR(255),
            showLabels BOOLEAN DEFAULT 1,
            showGrid BOOLEAN DEFAULT 1,
            smooth BOOLEAN DEFAULT 0,
            colorPalette VARCHAR(50) DEFAULT 'blue',
            workspace_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );
        """)
        
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_widgets_workspace_id ON widgets(workspace_id);")

        # 3. Add workspace_id column to datasets if missing
        cursor.execute("PRAGMA table_info(datasets)")
        columns = [col[1] for col in cursor.fetchall()]
        if "workspace_id" not in columns:
            logger.info("Adding workspace_id column to datasets table...")
            cursor.execute("ALTER TABLE datasets ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE")
        
        # Create database index on datasets.workspace_id to maximize scoped lookup performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_datasets_workspace_id ON datasets(workspace_id);")

        # 4. Create anomaly_explanations table if not exists
        logger.info("Creating anomaly_explanations table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS anomaly_explanations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            upload_id VARCHAR(255) NOT NULL,
            column_name VARCHAR(255) NOT NULL,
            explanation_text TEXT NOT NULL,
            chart_data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_anomaly_explanations_workspace_id ON anomaly_explanations(workspace_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_anomaly_explanations_upload_id ON anomaly_explanations(upload_id);")

        # 5. Create analyst_chat_sessions table if not exists
        logger.info("Creating analyst_chat_sessions table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS analyst_chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id VARCHAR(255) NOT NULL,
            workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            role VARCHAR(50) NOT NULL,
            message_text TEXT NOT NULL,
            chart_hint VARCHAR(50),
            chart_data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_analyst_chat_sessions_session_id ON analyst_chat_sessions(session_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_analyst_chat_sessions_workspace_id ON analyst_chat_sessions(workspace_id);")

        # 6. Create canvas_comments table if not exists
        logger.info("Creating canvas_comments table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS canvas_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            user_email VARCHAR(255) NOT NULL,
            chart_id VARCHAR(100),
            comment_text TEXT NOT NULL,
            x_pos REAL NOT NULL,
            y_pos REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_canvas_comments_workspace_id ON canvas_comments(workspace_id);")

        # 7. Create executive_reports table if not exists
        logger.info("Creating executive_reports table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS executive_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            file_path VARCHAR(500) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_executive_reports_workspace_id ON executive_reports(workspace_id);")

        # 8. Create dataset_fingerprints table if not exists
        logger.info("Creating dataset_fingerprints table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS dataset_fingerprints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            upload_id VARCHAR(255) NOT NULL,
            column_name VARCHAR(255) NOT NULL,
            mean_value REAL,
            std_dev_value REAL,
            cardinality INTEGER NOT NULL,
            drift_status VARCHAR(50) NOT NULL,
            p_value REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_dataset_fingerprints_workspace_id ON dataset_fingerprints(workspace_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_dataset_fingerprints_upload_id ON dataset_fingerprints(upload_id);")

        # 9. Create schema_mappings table if not exists
        logger.info("Creating schema_mappings table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS schema_mappings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            detected_header VARCHAR(255) NOT NULL,
            mapped_header VARCHAR(255) NOT NULL,
            confidence_score REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_schema_mappings_workspace_id ON schema_mappings(workspace_id);")

        # 10. Create insights table if not exists
        logger.info("Creating insights table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS insights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            upload_id TEXT,
            narrative_text TEXT NOT NULL,
            source_type VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_insights_workspace_id ON insights(workspace_id);")

        # 11. Create reports table if not exists
        logger.info("Creating reports table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            file_path TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_reports_workspace_id ON reports(workspace_id);")

        # 12. Create templates table if not exists
        logger.info("Creating templates table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            sample_csv_path VARCHAR(500) NOT NULL,
            default_config_json TEXT NOT NULL
        );
        """)

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

        # Insert seed rows if empty
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
        
        # 13. Create learning_progress table if not exists
        logger.info("Creating learning_progress table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS learning_progress (
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            article_id VARCHAR(100) NOT NULL,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, article_id)
        );
        """)
        # 14. Create integrations table if not exists
        logger.info("Creating integrations table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS integrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            type VARCHAR(100) NOT NULL,
            config_json TEXT NOT NULL,
            is_active INTEGER DEFAULT 1 NOT NULL
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_integrations_workspace_id ON integrations(workspace_id);")
        conn.commit()
        
        # 15. Add last_login_at column to users table if not exists
        try:
            logger.info("Altering users table to add last_login_at column...")
            cursor.execute("ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP;")
            conn.commit()
        except sqlite3.OperationalError as op_err:
            if "duplicate column name" in str(op_err) or "already exists" in str(op_err):
                logger.info("Column last_login_at already exists in users table.")
            else:
                raise
        
        logger.info("Database migration completed successfully.")
    except Exception as e:
        conn.rollback()
        logger.error(f"Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_db_migration()
