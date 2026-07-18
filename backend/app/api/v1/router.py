from fastapi import APIRouter
from app.api.v1.endpoints import auth, datasets, reports, health, widgets, workspaces, analytics, query, monitor, schema_mapper, insights, templates, integrations, digest, dashboard

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["Datasets"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(health.router, prefix="/health", tags=["System Health"])
api_router.include_router(widgets.router, prefix="/widgets", tags=["Widgets"])
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["Workspaces"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(query.router, prefix="/query", tags=["Conversational Analyst"])
api_router.include_router(monitor.router, tags=["Workspace Health"])
api_router.include_router(schema_mapper.router, prefix="/schema", tags=["Schema Mapper"])
api_router.include_router(insights.router, prefix="/insights", tags=["Insights & Reports"])
api_router.include_router(templates.router, prefix="/templates", tags=["Marketplace Templates"])
api_router.include_router(integrations.router, prefix="/integrations", tags=["Workspace Integrations"])
api_router.include_router(digest.router, prefix="/digest", tags=["User Digest"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
