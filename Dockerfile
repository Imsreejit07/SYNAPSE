# ─── Build Stage ───
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies for PyTorch (no GPU needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir orjson scikit-learn

# ─── Runtime Stage ───
FROM python:3.11-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY synapse_compiler.py .
COPY server.py .

# Copy pre-trained models (optional — users can also upload their own)
COPY model.pt .
COPY test_vectors.json .
COPY mnist_model.pt .
COPY mnist_test_vectors.json .

# Expose the API port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/docs')" || exit 1

# Run with production settings
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
