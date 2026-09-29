FROM python:3.12-slim
WORKDIR /app
COPY campusalert /app/campusalert
RUN pip install --no-cache-dir -r campusalert/backend/requirements.txt
WORKDIR /app/campusalert/backend
CMD gunicorn app:app --bind 0.0.0.0:$PORT
