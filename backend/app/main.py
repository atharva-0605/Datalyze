import warnings
warnings.filterwarnings("ignore", module="weasyprint")
warnings.filterwarnings("ignore", message=".*WeasyPrint.*")
warnings.filterwarnings("ignore", message=".*gobject-2.0-0.*")

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.router import api_router
from app.database_init import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup lifespan events including database table setup."""
    await init_db()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

from app.api.v1.websocket import router as ws_router
app.include_router(ws_router, prefix=settings.API_V1_STR)

from fastapi import Request
from fastapi.responses import JSONResponse
from jose import jwt
import traceback
from app.core.security import ALGORITHM
from app.core.logging_config import log_audit_event, audit_logger

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb_str = traceback.format_exc()
    audit_logger.error(f"UNHANDLED EXCEPTION on {request.method} {request.url.path}:\n{tb_str}")
    return JSONResponse(
        status_code=exc.status_code if hasattr(exc, "status_code") else 500,
        content={"detail": "Internal server error handled safely."}
    )

@app.middleware("http")
async def audit_log_middleware(request: Request, call_next):
    response = await call_next(request)
    
    path = request.url.path
    if path.startswith(f"{settings.API_V1_STR}/datasets"):
        auth_header = request.headers.get("Authorization")
        user_email = "guest@datalyze.ai"
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
                user_email = payload.get("sub", "guest@datalyze.ai")
            except Exception:
                pass
                
        x_workspace_id = request.headers.get("X-Workspace-ID", "1")
        try:
            workspace_id = int(x_workspace_id)
        except ValueError:
            workspace_id = 1
            
        action = "fetch_datasets_api"
        method = request.method
        if "/upload" in path:
            action = "upload_dataset"
        elif "/nlp-query" in path:
            action = "nlp_query_dataset"
        elif "/heal" in path:
            action = "heal_dataset"
        elif "/ai-summary" in path:
            action = "ai_summary_dataset"
        elif "/records" in path:
            action = "fetch_dataset_records"
        elif "/download-healed" in path:
            action = "download_healed_dataset"
        elif method == "GET" and path.strip("/") != f"{settings.API_V1_STR.strip('/')}/datasets":
            action = "fetch_dataset_detail"
        elif method == "GET":
            action = "list_datasets"
            
        try:
            log_audit_event(user_email, action, workspace_id, response.status_code)
        except Exception:
            pass
            
    return response

# Enable CORS for local frontends or API client testing
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wire version 1 endpoints
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/", include_in_schema=False)
async def redirect_to_docs():
    """Redirects visitors of root path directly to swagger documentation."""
    return RedirectResponse(url="/docs")
