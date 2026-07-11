import os
from fastapi.testclient import TestClient
from app.main import app

def test_audit_logging():
    log_file = "storage/logs/audit.log"
    
    # Clean up previous log if exists
    if os.path.exists(log_file):
        try:
            os.remove(log_file)
        except Exception:
            pass
        
    client = TestClient(app)
    
    print("Sending mock GET datasets request with custom headers...")
    headers = {
        "X-Workspace-ID": "42",
        "Authorization": "Bearer dummy_jwt_token"
    }
    
    # Even if authentication fails (since it is a dummy token), the datasets request
    # is intercepted by the middleware and registered in our audit.log file.
    response = client.get("/api/v1/datasets/", headers=headers)
    print(f"Request completed with response status: {response.status_code}")
    
    # Verify file existence
    if not os.path.exists(log_file):
        print("FAIL: audit.log was not created!")
        exit(1)
        
    # Read log file content
    with open(log_file, "r", encoding="utf-8") as f:
        content = f.read()
        print(f"Generated Audit Log Entry:\n{content.strip()}")
        
    if "USER: guest@datalyze.ai" in content and "WORKSPACE: 42" in content and "ACTION: list_datasets" in content:
        print("\n--- SUCCESS: Audit log entry verified successfully ---")
    else:
        print("FAIL: Audit log entry does not contain expected metadata.")
        exit(1)

if __name__ == "__main__":
    test_audit_logging()
