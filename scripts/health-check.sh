#!/bin/bash

# ==========================================
# Alice VPS Services Health Check Script
# ==========================================

URL="http://localhost:3000/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")

if [ "$RESPONSE" -eq 200 ]; then
    echo "🟢 System is healthy (HTTP 200)"
    exit 0
else
    echo "🔴 System degraded or unreachable (HTTP $RESPONSE)"
    exit 1
fi
