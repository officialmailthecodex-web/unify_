FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY . .
WORKDIR /app/backend
CMD exec gunicorn --bind :${PORT:-8080} app:app
