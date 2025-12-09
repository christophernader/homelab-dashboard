#!/bin/bash
# Deployment script for Homelab Dashboard
# Usage: ./deploy.sh

set -e

SERVER="192.168.50.10"
USER="chris"
REMOTE_PATH="~/homelab-dashboard"

echo "🚀 Deploying Homelab Dashboard to $USER@$SERVER..."
echo ""

# Use rsync to sync files
echo "📦 Syncing files..."
rsync -avz \
  --exclude '.git' \
  --exclude '__pycache__' \
  --exclude '.venv' \
  --exclude 'venv' \
  --exclude 'data' \
  --exclude '.DS_Store' \
  --exclude '*.pyc' \
  ./ ${USER}@${SERVER}:${REMOTE_PATH}/

echo ""
echo "🐳 Rebuilding Docker container..."
ssh ${USER}@${SERVER} "cd ${REMOTE_PATH} && docker compose down && docker compose up -d --build"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 View logs with:"
echo "   ssh ${USER}@${SERVER} 'docker logs -f homelab-dashboard'"
