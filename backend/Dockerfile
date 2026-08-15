# Build context is the repo ROOT (docker-compose sets context: .), not backend/ —
# main.py's uvicorn target and every script's `python -m backend.scripts.*` invocation
# assume `backend` is a top-level importable package, so paths below are root-relative.
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
ENV DATA_DIR=/app/demo-data
EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
