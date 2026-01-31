#!/bin/bash
#
# Backup Bot Manager Data
#

set -e

BACKUP_DIR="/opt/bot-manager-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="bot-manager-backup-${DATE}.tar.gz"

echo "========================================"
echo "Creating Backup"
echo "========================================"
echo ""

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database and logs
echo "📦 Creating backup archive..."
tar -czf "${BACKUP_DIR}/${BACKUP_FILE}" \
    -C /opt/bot-manager \
    server/data \
    server/logs \
    server/.env

echo "✅ Backup created: ${BACKUP_DIR}/${BACKUP_FILE}"

# Keep only last 7 backups
echo "🧹 Cleaning old backups (keeping last 7)..."
cd $BACKUP_DIR
ls -t bot-manager-backup-*.tar.gz | tail -n +8 | xargs -r rm

echo ""
echo "✅ Backup complete!"
echo "📁 Location: ${BACKUP_DIR}/${BACKUP_FILE}"
echo ""

# Show backup size
du -h "${BACKUP_DIR}/${BACKUP_FILE}"
