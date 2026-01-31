#!/bin/bash
#
# คำสั่งสำหรับรันบน VPS โดยตรง
# Copy ทั้งไฟล์นี้ไป paste บน server แล้วรัน
#
# วิธีใช้:
# 1. ssh bitnami@47.129.144.109
# 2. nano setup.sh
# 3. Copy ทั้งหมดจากไฟล์นี้ paste เข้าไป
# 4. Ctrl+X, Y, Enter
# 5. bash setup.sh
#

set -e

VPS_IP="47.129.144.109"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║          Bot Manager Setup on Server                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check if project files exist
if [ -d "/opt/bot-manager" ]; then
    echo "✅ Project directory found: /opt/bot-manager"
    cd /opt/bot-manager
else
    echo "❌ Project directory not found!"
    echo ""
    echo "Please upload project first:"
    echo "  From Mac: scp bot-manager.tar.gz bitnami@47.129.144.109:/tmp/"
    echo "  Then extract:"
    echo "    sudo mkdir -p /opt/bot-manager"
    echo "    sudo chown -R bitnami:bitnami /opt/bot-manager"
    echo "    cd /opt/bot-manager"
    echo "    tar -xzf /tmp/bot-manager.tar.gz --strip-components=1"
    exit 1
fi

# Check if deploy scripts exist
if [ ! -f "deploy/auto-setup.sh" ]; then
    echo "❌ Setup scripts not found!"
    echo "Please make sure project is properly extracted."
    exit 1
fi

echo "🚀 Running auto setup..."
echo ""

# Run auto setup with VPS IP
export VPS_IP="47.129.144.109"
bash deploy/auto-setup.sh

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅ Setup Complete!                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Access: http://47.129.144.109"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "⚠️  Change password after first login!"
echo ""
