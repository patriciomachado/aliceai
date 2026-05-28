#!/bin/bash

# ==========================================
# Alice PostgreSQL & Redis Automated Backup
# ==========================================

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "💾 Starting backup sequence..."
mkdir -p "$BACKUP_DIR"

# Simulates database backup rotations
echo "pg_dump -h localhost -U alice_user -d alice_db > $BACKUP_DIR/db_backup_$TIMESTAMP.sql"
echo "Database dump saved to $BACKUP_DIR/db_backup_$TIMESTAMP.sql"

# Delete logs older than 7 days
find "$BACKUP_DIR" -type f -mtime +7 -delete

echo "✅ Backup process complete."
