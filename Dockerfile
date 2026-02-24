FROM python:3.11-slim

WORKDIR /app

# Copy requirements first for layer caching
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Railway injects $PORT at runtime
CMD ["sh", "-c", "uvicorn server:socket_app --host 0.0.0.0 --port ${PORT:-8000}"]
