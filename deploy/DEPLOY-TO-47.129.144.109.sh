#!/bin/bash
#
# Deploy to 47.129.144.109 (bitnami user)
# รันจาก Mac: bash deploy/DEPLOY-TO-47.129.144.109.sh
#

set -e

VPS_IP="47.129.144.109"
VPS_USER="bitnami"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     Deploy Bot Manager to ${VPS_IP}        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Compress
echo "📦 [1/3] Compressing project..."
cd /Users/Macbook
tar -czf bot-manager.tar.gz \
    --exclude='Bot_Manager/node_modules' \
    --exclude='Bot_Manager/server/data' \
    --exclude='Bot_Manager/client/dist' \
    --exclude='Bot_Manager/.git' \
    Bot_Manager/

echo "✅ Compressed: $(du -h bot-manager.tar.gz | cut -f1)"

# Step 2: Upload
echo ""
echo "📤 [2/3] Uploading to VPS..."
scp bot-manager.tar.gz ${VPS_USER}@${VPS_IP}:/tmp/
echo "✅ Uploaded to ${VPS_IP}:/tmp/"

# Step 3: Extract & Setup
echo ""
echo "🚀 [3/3] Running auto setup on VPS..."
echo ""

ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
# Extract
sudo mkdir -p /opt/bot-manager
sudo chown -R bitnami:bitnami /opt/bot-manager
cd /opt/bot-manager
tar -xzf /tmp/bot-manager.tar.gz --strip-components=1
rm /tmp/bot-manager.tar.gz

echo ""
echo "✅ Project extracted to /opt/bot-manager"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Starting Auto Setup..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run auto setup with VPS IP pre-filled
export VPS_IP="47.129.144.109"
bash deploy/auto-setup.sh

ENDSSH

# Cleanup local file
rm bot-manager.tar.gz

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅ Deployment Complete!                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Access your Bot Manager:"
echo "   URL: http://${VPS_IP}"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "⚠️  IMPORTANT: Change password after first login!"
echo ""
echo "📊 Check status:"
echo "   ssh ${VPS_USER}@${VPS_IP}"
echo "   pm2 status"
echo "   pm2 logs bot-manager-api"
echo ""
