#!/bin/bash

# ==========================================
# Alice VPS Automated Deployment Script
# ==========================================

echo "🚀 Starting Alice deployment sequence..."

# 1. Update project assets
git pull origin main

# 2. Re-compile containers in detached mode
docker compose down
docker compose up --build -d

# 3. Clean untagged images to preserve memory
docker image prune -f

echo "✅ Alice monorepo services deployed successfully!"
