import sys
import io

# Suppress early import diagnostics printouts
_original_stdout = sys.stdout
_original_stderr = sys.stderr
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()

try:
    import warnings
    warnings.filterwarnings("ignore", module="weasyprint")
    warnings.filterwarnings("ignore", message=".*WeasyPrint.*")
    warnings.filterwarnings("ignore", message=".*gobject-2.0-0.*")

    import asyncio
    import os
    import shutil
    import pandas as pd
    from app.core.config import settings
    # Override database URL to use SQLite for self-contained validation testing
    settings.DATABASE_URL = "sqlite+aiosqlite:///./test_validation.db"

    from app.database_init import init_db
    from app.core.security import get_password_hash, verify_password, create_access_token
    from app.core.database import AsyncSessionLocal
    from app.models.user import User, UserRole
    from app.models.workspace import Workspace
    from app.services.ingestion import ingestion_service
    from app.services.doctor import doctor_service
    from app.services.report_engine import report_engine_service
    from sqlalchemy.future import select
finally:
    sys.stdout = _original_stdout
    sys.stderr = _original_stderr


async def run_validation_tests():
    print("--- Starting Validation Tests ---")
    
    # 1. Initialize DB
    print("\n[Test 1] Initializing Database...")
    await init_db()
    
    # 2. Test Security & Hashes
    print("\n[Test 2] Testing Password Hashing & JWT...")
    password = "SuperPassword123"
    hashed = get_password_hash(password)
    assert verify_password(password, hashed) is True
    assert verify_password("wrongpassword", hashed) is False
    token = create_access_token(subject="test@datalyze.ai")
    assert token is not None
    print("Password verification and JWT signature generation PASSED.")

    async with AsyncSessionLocal() as session:
        # Create a workspace
        print("\n[Test 3] Creating Workspace & Users...")
        workspace = Workspace(name="Test Workspace")
        session.add(workspace)
        await session.flush()
        
        user = User(
            email="admin@datalyze.ai",
            hashed_password=hashed,
            role=UserRole.ADMIN.value,
            workspace_id=workspace.id
        )
        session.add(user)
        await session.commit()
        print(f"Created Workspace ID: {workspace.id}, User: {user.email} with role: {user.role}")

        # 3. Create a Mock Upload File
        print("\n[Test 4] Creating Mock CSV File...")
        mock_data = {
            "name": ["Alice", "Bob", "Charlie", "Alice", None],
            "age": [25, 30, "thirty-five", 25, 40], # Contains a mismatch ('thirty-five')
            "salary": [50000, 60000, 70000, 50000, None] # Contains a missing value
        }
        df = pd.DataFrame(mock_data)
        os.makedirs("./tmp", exist_ok=True)
        mock_csv_path = "./tmp/mock_dataset.csv"
        df.to_csv(mock_csv_path, index=False)
        print(f"Mock CSV created at: {mock_csv_path}")

        # 4. Test Ingestion & Data Doctor Profiling
        print("\n[Test 5] Profiling Mock Dataset...")
        profile = doctor_service.profile_dataset(mock_csv_path)
        print(f"Computed Data Health Score: {profile['health_score']}")
        print(f"Total Rows: {profile['summary']['total_rows']}, Columns: {profile['summary']['total_columns']}")
        print(f"Missing Cells: {profile['summary']['missing_cells']}, Duplicates: {profile['summary']['duplicate_rows']}")
        print("Suggested Actions:")
        for action in profile["suggested_actions"]:
            print(f"  - {action}")
        
        assert profile["health_score"] < 100.0  # Mismatches and duplicates should lower the score

        # 5. Test Healing
        print("\n[Test 6] Healing Dataset...")
        healed_path, changes, new_profile = doctor_service.heal_dataset(mock_csv_path)
        print(f"Healed CSV created at: {healed_path}")
        print(f"Duplicates removed: {changes['duplicates_removed']}")
        print(f"New Health Score: {new_profile['health_score']}")
        print("Healed Columns Stats:")
        for col, col_data in new_profile["columns"].items():
            print(f"  - {col}: missing={col_data['missing_count']}, type={col_data['type']}")
            
        assert new_profile["health_score"] == 100.0  # All duplicates, missings, and type mismatches should be resolved

        # 6. Test HTML/PDF Reporting
        print("\n[Test 7] Renders HTML & PDF Report...")
        html_content = report_engine_service.generate_report_html(
            dataset_metadata={
                "filename": "mock_dataset.csv",
                "file_size": os.path.getsize(mock_csv_path),
                "workspace_id": workspace.id
            },
            profile_report=profile,
            title="Datalyze AI - Validation Report"
        )
        
        pdf_out_path = "./tmp/validation_report.pdf"
        output_path = report_engine_service.compile_html_to_pdf(html_content, pdf_out_path)
        print(f"Report compiled successfully at: {output_path}")

        # 7. Test ML Engine
        print("\n[Test 8] Testing ML Engine Service...")
        from app.services.ml_engine import ml_engine_service
        forecast_res = ml_engine_service.forecast_trend(historical_data=[10.0, 12.0, 14.0, 16.0, 18.0], horizon_days=3, what_if_growth=10.0)
        assert len(forecast_res["projection"]) == 3
        assert len(forecast_res["what_if_baseline"]) == 3
        assert forecast_res["slope"] > 0
        print("ML linear regression trend forecast PASSED.")
        
        cluster_res = ml_engine_service.kmeans_clustering(data_points=[1.2, 1.5, 2.0, 10.0, 10.5, 11.0], k=2)
        assert len(cluster_res["centroids"]) == 2
        assert len(cluster_res["assignments"]) == 6
        print("ML K-Means clustering assignment PASSED.")

        # 8. Test AI Narrator
        print("\n[Test 9] Testing AI Insight Narrator Service...")
        from app.services.insights import ai_insight_narrator
        narrative = await ai_insight_narrator.generate_data_narrative(
            columns_metadata={"sales": "numeric", "region": "category"},
            chart_data=[{"name": "East", "value": 120}]
        )
        assert narrative is not None
        print("AI Narrator generation PASSED.")

    # Cleanup
    print("\nCleaning up temporary test files...")
    if os.path.exists("./tmp"):
        shutil.rmtree("./tmp")
    if os.path.exists("./test_validation.db"):
        os.remove("./test_validation.db")
    print("Cleanup completed.")
    print("\n--- All Validation Tests Passed Successfully ---")

if __name__ == "__main__":
    asyncio.run(run_validation_tests())
