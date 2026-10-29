FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AI_SUMMARY_HOST=0.0.0.0 \
    AI_SUMMARY_PORT=5001

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .

RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('AI_SUMMARY_PORT','5001')+'/health')"

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${AI_SUMMARY_PORT:-5001} --workers 2 --timeout 300 run:app"]
