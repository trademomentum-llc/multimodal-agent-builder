#!/usr/bin/env python
"""Script to run the FastAPI application."""

import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

import uvicorn
from config.config import settings


def main():
    """Run the FastAPI application."""
    print("=" * 60)
    print(f"🚀 Starting {settings.app_name}")
    print(f"📌 Version: {settings.app_version}")
    print(f"🌍 Environment: {settings.app_env}")
    print("=" * 60)

    # Check API keys
    api_keys = settings.validate_api_keys()
    print("\n🔑 API Key Status:")
    for provider, configured in api_keys.items():
        status = "✅" if configured else "❌"
        print(f"  {status} ******")

    print("\n📡 Server Configuration:")
    print(f"  Host: {settings.app_host}")
    print(f"  Port: {settings.app_port}")
    print(f"  Debug: {settings.app_debug}")
    print(f"  Log Level: {settings.log_level}")

    print("\n🔗 Access URLs:")
    print(f"  API: http://{settings.app_host}:{settings.app_port}")
    print(f"  Docs: http://{settings.app_host}:{settings.app_port}/docs")
    print(f"  ReDoc: http://{settings.app_host}:{settings.app_port}/redoc")
    print("=" * 60)
    print("\nPress CTRL+C to stop the server\n")

    # Run the server
    uvicorn.run(
        "src.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_debug,
        log_level=settings.log_level.lower(),
        access_log=True,
    )


if __name__ == "__main__":
    main()
