"""
Vibe App - Dashboard Routes
Serves static HTML dashboards and health/root endpoints.
"""
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["dashboard"])

ROOT_DIR = Path(__file__).parent.parent.parent


@router.get("/")
async def root():
    """API root."""
    return {"message": "Vibe App API", "version": "3.0.0"}


@router.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/dashboard/admin", response_class=HTMLResponse)
async def admin_dashboard():
    """Serve the Admin Dashboard HTML page."""
    admin_html_path = ROOT_DIR / "static" / "admin.html"
    if admin_html_path.exists():
        return HTMLResponse(content=admin_html_path.read_text(), status_code=200)
    return HTMLResponse(content="<h1>Admin Dashboard not found</h1>", status_code=404)


@router.get("/dashboard/merchant", response_class=HTMLResponse)
async def merchant_dashboard():
    """Serve the Merchant Dashboard HTML page."""
    merchant_html_path = ROOT_DIR / "static" / "merchant.html"
    if merchant_html_path.exists():
        return HTMLResponse(content=merchant_html_path.read_text(), status_code=200)
    return HTMLResponse(content="<h1>Merchant Dashboard not found</h1>", status_code=404)
