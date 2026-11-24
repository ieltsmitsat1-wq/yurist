"""Health check endpoints."""

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Basic health check endpoint."""
    return {
        "status": "ok",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/health/instagram")
async def instagram_health_check() -> dict[str, object]:
    """Report Instagram integration readiness without exposing credentials."""
    return {
        "status": "configured" if settings.INSTAGRAM_ACCESS_TOKEN else "missing_access_token",
        "page_id_configured": bool(settings.INSTAGRAM_PAGE_ID),
        "business_account_id_configured": bool(settings.INSTAGRAM_BUSINESS_ACCOUNT_ID),
        "access_token_configured": bool(settings.INSTAGRAM_ACCESS_TOKEN),
        "app_secret_configured": bool(settings.INSTAGRAM_APP_SECRET),
        "verify_token_configured": bool(settings.INSTAGRAM_VERIFY_TOKEN),
        "graph_api_version": settings.INSTAGRAM_GRAPH_API_VERSION,
        "webhook_path": "/api/v1/instagram/webhook",
    }
