FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including SSH
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client \
    curl \
    iputils-ping \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./
COPY homelab ./homelab
COPY templates ./templates
COPY static ./static
RUN mkdir -p data

ENV FLASK_ENV=production
ENV FLASK_APP=app.py
ENV PORT=5050

EXPOSE 5050

CMD ["python", "app.py"]
