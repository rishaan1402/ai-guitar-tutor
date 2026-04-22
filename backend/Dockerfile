FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for librosa/scipy
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Build context is the project root — copy backend code and lesson data separately
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY data/ /data/

EXPOSE 8000

# start.sh runs `alembic upgrade head` then starts uvicorn
COPY backend/start.sh .
RUN chmod +x start.sh

CMD ["./start.sh"]
