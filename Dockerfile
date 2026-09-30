FROM python:3.11-slim

# Install system dependencies (ffmpeg is required for audio processing, nodejs for yt-dlp JS challenges)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app
ENV PYTHONUNBUFFERED=1

# Copy requirements and install
COPY Requirements.txt .
RUN pip install --no-cache-dir -r Requirements.txt

# Copy application code
COPY . .

# Expose port (Render sets PORT env variable dynamically)
EXPOSE 8000

# Start FastAPI worker
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
