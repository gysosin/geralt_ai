"""
GeraltAI FastAPI Application

Main application entry point using AppFactory pattern.
"""
import logging
import subprocess
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings

class AppFactory:
    """
    Factory for creating the FastAPI application.
    Encapsulates setup, configuration, and lifespan management.
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._setup_logging()

    def _setup_logging(self) -> None:
        """Configure logging."""
        logging.basicConfig(
            level=logging.INFO if not settings.DEBUG else logging.DEBUG,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        )

    def print_ascii_banner(self) -> None:
        """Print colored ASCII banner."""
        banner = """
 _______  _______  ______   _______  ___      _______  _______  ___ 
|       ||       ||    _ | |   _   ||   |    |       ||   _   ||   |
|    ___||    ___||   | || |  |_|  ||   |    |_     _||  |_|  ||   |
|   | __ |   |___ |   |_|| |       ||   |      |   |  |       ||   |
|   ||  ||    ___||    __ ||       ||   |___   |   |  |       ||   |
|   |_| ||   |___ |   |  |||   _   ||       |  |   |  |   _   ||   |
|_______||_______||___|  |||__| |__||_______|  |___|  |__| |__||___|
                                                                    
    FastAPI Edition - v1.0.0
"""
        print(banner)

    @asynccontextmanager
    async def lifespan(self, app: FastAPI) -> AsyncGenerator:
        """
        Application lifespan context manager.
        Handles startup and shutdown events.
        """
        # Startup
        self.print_ascii_banner()
        self.logger.info("🚀 Starting GeraltAI API...")
        
        celery_process = None
        try:
            # Kill any existing celery workers (prevent duplicates on reload)
            subprocess.run(["pkill", "-f", "celery -A core.tasks worker"], check=False)
            
            # Start Celery Worker
            self.logger.info("👷 Starting Celery worker...")
            # ... (rest of the startup code)
            celery_process = subprocess.Popen(
                [sys.executable, "-m", "celery", "-A", "core.tasks", "worker", "--loglevel=info"],
                cwd=".",  # Ensure we are in the project root
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
                # We pipe stdout/stderr to avoid cluttering the main log, 
                # or we could let it flow to inherit/print. 
                # Let's let it inherit for now so user sees worker logs or pipe if we want to silence.
                # User asked for "run application", usually seeing logs is good.
                # But Popen defaults to inheriting if not specified? No, streams are None by default which inherits.
                # Explicitly removing PIPE to let it print to console.
            )
            # Re-creating Popen without PIPEs to let it print to console
            celery_process = subprocess.Popen(
                [sys.executable, "-m", "celery", "-A", "core.tasks", "worker", "--loglevel=info"]
            )
            self.logger.info(f"✅ Celery worker started (PID: {celery_process.pid})")
        except Exception as e:
            self.logger.error(f"❌ Failed to start Celery worker: {e}")

        # Initialize external connections
        try:
            # Verify MongoDB connection
            from api.deps import get_mongo_client
            mongo_client = get_mongo_client()
            # Check connection (async drivers might not support command in sync context like this cleanly if strict async, 
            # but usually deps return pymongo client which is sync, or motor which is async. 
            # Assuming pymongo as per prev file usage)
            mongo_client.admin.command("ping")
            self.logger.info("✅ MongoDB connected")
        except Exception as e:
            self.logger.warning(f"⚠️ MongoDB connection failed: {e}")
        
        try:
            # Verify MinIO bucket
            from api.deps import get_minio_client
            minio_client = get_minio_client()
            if not minio_client.bucket_exists(settings.MINIO_BUCKET):
                minio_client.make_bucket(settings.MINIO_BUCKET)
            self.logger.info("✅ MinIO bucket verified")
        except Exception as e:
            self.logger.warning(f"⚠️ MinIO connection failed: {e}")
        
        self.logger.info("🚀 GeraltAI API ready!")
        
        yield
        
        # Shutdown
        self.logger.info("👋 Shutting down GeraltAI API...")
        if celery_process:
            self.logger.info("🛑 Stopping Celery worker...")
            celery_process.terminate()
            try:
                celery_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                celery_process.kill()
            self.logger.info("✅ Celery worker stopped")

    def create_app(self) -> FastAPI:
        """Create and configure the FastAPI application."""
        app = FastAPI(
            title=settings.API_TITLE,
            version="1.0.0",
            description="GeraltAI - AI-powered document processing and RAG API",
            docs_url="/docs",
            redoc_url="/redoc",
            openapi_url="/openapi.json",
            lifespan=self.lifespan,
        )
        
        self._configure_middleware(app)
        self._configure_routes(app)
        
        # Mount SocketIO app
        from helpers.socketio_instance import sio_app
        # Mount at /socket.io (Note: client must connect to /socket.io or default)
        # However, ASGIApp usually handles the path matching internally if configured.
        # But for FastAPI mounting:
        app.mount("/socket.io", sio_app)
        # Alternatively, we could mount at "/" if sio_app was wrapping a dummy app, 
        # but pure mounting at /socket.io is cleaner for separation.
        
        return app

    def _configure_middleware(self, app: FastAPI) -> None:
        """Configure middleware."""
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    def _configure_routes(self, app: FastAPI) -> None:
        """Configure API routes."""
        from api.v1.router import api_router
        app.include_router(api_router, prefix="/api/v1")
        
        @app.get("/health", tags=["Health"])
        async def health_check():
            """Health check endpoint."""
            return {"status": "healthy", "version": "1.0.0"}

        @app.get("/", tags=["Health"])
        async def root():
            """Root endpoint."""
            return {
                "name": "GeraltAI API",
                "version": "1.0.0",
                "docs": "/docs",
                "health": "/health",
            }


# Create global app instance for uvicorn
app_factory = AppFactory()
app = app_factory.create_app()


# =============================================================================
# Run with Uvicorn
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info",
    )