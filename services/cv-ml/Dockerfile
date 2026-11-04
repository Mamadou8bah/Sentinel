FROM python:3.11-slim
WORKDIR /app
ENV OMP_NUM_THREADS=2 MKL_NUM_THREADS=2
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch>=2.6,<3" \
    && pip install --no-cache-dir -r requirements.txt
COPY app ./app
ARG INSTALL_PRETRAINED=false
RUN if [ "$INSTALL_PRETRAINED" = "true" ]; then python -m app.models.install_pretrained --output /app/artifacts/pretrained; fi
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--limit-concurrency", "4"]
