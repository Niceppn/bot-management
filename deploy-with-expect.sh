#!/bin/bash
#
# Deploy IDE Temporary Bot Feature with Expect
# This script will ask for password once and use it for all SSH/SCP operations
#

set -e

VPS_IP="47.129.144.109"
VPS_USER="bitnami"
PROJECT_DIR="/Users/Macbook/Crypto_Monitoring"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Deploy IDE Temporary Bot Feature to Production         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "This script will deploy the IDE Temporary Bot feature to:"
echo "Server: ${VPS_IP}"
echo "User: ${VPS_USER}"
echo ""

# Check if expect is installed
if ! command -v expect &> /dev/null; then
    echo "❌ 'expect' is not installed. Installing via homebrew..."
    brew install expect
fi

# Ask for password once
echo "Please enter SSH password for ${VPS_USER}@${VPS_IP}:"
read -s SSH_PASS
echo ""

# Function to run SSH command
run_ssh() {
    expect << EOF
set timeout 60
spawn ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "$1"
expect {
    "password:" {
        send "${SSH_PASS}\r"
        expect eof
    }
    eof
}
EOF
}

# Function to run SCP
run_scp() {
    expect << EOF
set timeout 120
spawn scp -r $1 ${VPS_USER}@${VPS_IP}:$2
expect {
    "password:" {
        send "${SSH_PASS}\r"
        expect eof
    }
    eof
}
EOF
}

# Test connection
echo "🔐 Testing SSH connection..."
run_ssh "echo 'Connection OK'" || {
    echo "❌ SSH connection failed. Please check your password."
    exit 1
}
echo "✅ SSH connection successful"
echo ""

# Step 1: Backup database
echo "📦 [1/8] Backing up production database..."
run_ssh "cp /opt/bot-manager/server/data/bot_manager.db /opt/bot-manager/server/data/bot_manager.db.backup_\$(date +%Y%m%d_%H%M%S)"
echo "✅ Database backed up"
echo ""

# Step 2: Package server files
echo "📦 [2/8] Packaging server updates..."
cd ${PROJECT_DIR}
tar -czf server-update.tar.gz \
    server/routes/tempBot.js \
    server/server.js \
    server/config/database.js \
    server/package.json
echo "✅ Server files packaged"
echo ""

# Step 3: Upload server files
echo "📤 [3/8] Uploading server files..."
run_scp "server-update.tar.gz" "/opt/bot-manager/"
echo "✅ Server files uploaded"
echo ""

# Step 4: Upload frontend
echo "📤 [4/8] Uploading frontend build..."
run_scp "client/dist/*" "/opt/bot-manager/dist/"
echo "✅ Frontend uploaded"
echo ""

# Step 5: Extract and install
echo "🔧 [5/8] Extracting files and installing dependencies..."
run_ssh "cd /opt/bot-manager && tar -xzf server-update.tar.gz && rm server-update.tar.gz && cd server && npm install multer"
echo "✅ Dependencies installed"
echo ""

# Step 6: Create directory
echo "📁 [6/8] Creating temp_bots directory..."
run_ssh "mkdir -p /opt/bot-manager/temp_bots && chmod 755 /opt/bot-manager/temp_bots"
echo "✅ Directory created"
echo ""

# Step 7: Restart services
echo "🔄 [7/8] Restarting services..."
run_ssh "pm2 stop bot-manager-backend || pm2 stop bot-manager-api || true; sleep 2; pm2 start bot-manager-backend || pm2 start bot-manager-api || pm2 start /opt/bot-manager/server/server.js --name bot-manager-backend; sleep 3; sudo /opt/bitnami/ctlscript.sh restart apache || true"
echo "✅ Services restarted"
echo ""

# Step 8: Cache busting
echo "🗑️  [8/8] Adding cache busting..."
run_ssh "cd /opt/bot-manager/dist && TIMESTAMP=\$(date +%s) && cp index.html index.html.bak && sed \"s/\(index-[^.]*\.js\)/\1?v=\${TIMESTAMP}/g\" index.html.bak | sed \"s/\(index-[^.]*\.css\)/\1?v=\${TIMESTAMP}/g\" > index.html"
echo "✅ Cache busting added"
echo ""

# Cleanup
rm ${PROJECT_DIR}/server-update.tar.gz 2>/dev/null || true

echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅ Deployment Complete!                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Test the deployment at: http://${VPS_IP}"
echo ""

# Verification
echo "📊 Running verification checks..."
echo ""
run_ssh "pm2 status"
echo ""
run_ssh "ls -la /opt/bot-manager/temp_bots"
echo ""
run_ssh "sqlite3 /opt/bot-manager/server/data/bot_manager.db 'PRAGMA table_info(bots);' | grep is_temporary && echo '✅ is_temporary column exists' || echo '❌ Migration might have failed'"
echo ""
