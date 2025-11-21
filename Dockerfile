FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including SSH and locales
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client \
    sshpass \
    curl \
    iputils-ping \
    net-tools \
    locales \
    && rm -rf /var/lib/apt/lists/* \
    && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen \
    && locale-gen en_US.UTF-8

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

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
