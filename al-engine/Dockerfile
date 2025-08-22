# AL-Engine Dockerfile
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy AL-Engine source code
COPY . .

# Create directory for data and outputs
RUN mkdir -p /app/data /app/outputs

# Set environment variables
ENV PYTHONPATH=/app
ENV AL_ENGINE_DATA_DIR=/app/data
ENV AL_ENGINE_OUTPUT_DIR=/app/outputs

# Expose port (if needed for API)
EXPOSE 8080

# Default command
CMD ["python", "main.py", "--help"] 