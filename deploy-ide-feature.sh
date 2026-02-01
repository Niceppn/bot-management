#!/bin/bash
#
# Deploy IDE Temporary Bot Feature to Production
# Server: 47.129.144.109
#

set -e

VPS_IP="47.129.144.109"
VPS_USER="bitnami"
PROJECT_DIR="/Users/Macbook/Crypto_Monitoring"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Deploy IDE Temporary Bot Feature to Production         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Ask for password
echo "Please enter SSH password for ${VPS_USER}@${VPS_IP}:"
read -s SSH_PASS
echo ""

# Test connection
echo "🔐 Testing SSH connection..."
sshpass -p "${SSH_PASS}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "echo 'Connection OK'" || {
    echo "❌ SSH connection failed. Please check your password."
    exit 1
}
echo "✅ SSH connection successful"
echo ""

# Step 2: Backup database
echo "📦 [1/8] Backing up production database..."
sshpass -p "${SSH_PASS}" ssh ${VPS_USER}@${VPS_IP} "cp /opt/bot-manager/server/data/bot_manager.db /opt/bot-manager/server/data/bot_manager.db.backup_\$(date +%Y%m%d_%H%M%S)"
echo "✅ Database backed up"
echo ""

# Step 3: Package server files
echo "📦 [2/8] Packaging server updates..."
cd ${PROJECT_DIR}
tar -czf server-update.tar.gz \
    server/routes/tempBot.js \
    server/server.js \
    server/config/database.js \
    server/package.json
echo "✅ Server files packaged"
echo ""

# Step 4: Upload server files
echo "📤 [3/8] Uploading server files..."
sshpass -p "${SSH_PASS}" scp server-update.tar.gz ${VPS_USER}@${VPS_IP}:/opt/bot-manager/
echo "✅ Server files uploaded"
echo ""

# Step 5: Upload frontend dist
echo "📤 [4/8] Uploading frontend build..."
sshpass -p "${SSH_PASS}" scp -r client/dist/* ${VPS_USER}@${VPS_IP}:/opt/bot-manager/dist/
echo "✅ Frontend uploaded"
echo ""

# Step 6: Extract and install dependencies
echo "🔧 [5/8] Extracting files and installing dependencies..."
sshpass -p "${SSH_PASS}" ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
cd /opt/bot-manager
tar -xzf server-update.tar.gz
rm server-update.tar.gz
cd server
npm install multer
ENDSSH
echo "✅ Dependencies installed"
echo ""

# Step 7: Create temp_bots directory
echo "📁 [6/8] Creating temp_bots directory..."
sshpass -p "${SSH_PASS}" ssh ${VPS_USER}@${VPS_IP} "mkdir -p /opt/bot-manager/temp_bots && chmod 755 /opt/bot-manager/temp_bots"
echo "✅ Directory created"
echo ""

# Step 8: Restart services
echo "🔄 [7/8] Restarting services..."
sshpass -p "${SSH_PASS}" ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
pm2 stop bot-manager-backend || pm2 stop bot-manager-api || true
sleep 2
pm2 start bot-manager-backend || pm2 start bot-manager-api || pm2 start /opt/bot-manager/server/server.js --name bot-manager-backend
sleep 3
sudo /opt/bitnami/ctlscript.sh restart apache || true
ENDSSH
echo "✅ Services restarted"
echo ""

# Step 9: Add cache busting
echo "🗑️  [8/8] Adding cache busting..."
sshpass -p "${SSH_PASS}" ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
cd /opt/bot-manager/dist
TIMESTAMP=$(date +%s)
cp index.html index.html.bak
sed "s/\(index-[^.]*\.js\)/\1?v=${TIMESTAMP}/g" index.html.bak | sed "s/\(index-[^.]*\.css\)/\1?v=${TIMESTAMP}/g" > index.html
ENDSSH
echo "✅ Cache busting added"
echo ""

# Cleanup
rm ${PROJECT_DIR}/server-update.tar.gz

echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅ Deployment Complete!                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Test the deployment:"
echo "   URL: http://${VPS_IP}"
echo "   Login and click 'Create Price Collector'"
echo "   Should see the IDE interface"
echo ""
echo "📊 Verify backend:"
sshpass -p "${SSH_PASS}" ssh ${VPS_USER}@${VPS_IP} "pm2 status && echo '' && echo 'Checking temp_bots directory:' && ls -la /opt/bot-manager/temp_bots"
echo ""
echo "📊 Check database migration:"
sshpass -p "${SSH_PASS}" ssh ${VPS_USER}@${VPS_IP} "sqlite3 /opt/bot-manager/server/data/bot_manager.db 'PRAGMA table_info(bots);' | grep is_temporary && echo '✅ is_temporary column exists' || echo '❌ Migration failed'"
echo ""
echo "📝 View logs:"
echo "   ssh ${VPS_USER}@${VPS_IP}"
echo "   pm2 logs bot-manager-backend"
echo ""
