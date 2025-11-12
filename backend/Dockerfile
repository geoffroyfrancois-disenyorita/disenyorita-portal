# Multi-stage build for Python FastAPI backend
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set default port
ENV BACKEND_PORT=8000

# Expose port (will be overridden by environment variable)
EXPOSE ${BACKEND_PORT}

# Health check (uses environment variable for port)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD python -c "import os, requests; port = os.getenv('BACKEND_PORT', '8000'); requests.get(f'http://localhost:{port}/api/v1/health', timeout=2)" || exit 1

# Run the application with configurable port
CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${BACKEND_PORT}"
