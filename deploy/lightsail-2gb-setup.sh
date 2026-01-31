#!/bin/bash
#
# Lightsail 2GB Setup for 2-3 Bots
# Optimized configuration
#

set -e

echo "========================================"
echo "Lightsail 2GB Optimization"
echo "For 2-3 Bots Setup"
echo "========================================"
echo ""

# 1. Add Swap (optional but recommended)
echo "💾 Adding 1GB Swap..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 1G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    sudo sysctl vm.swappiness=10
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
    echo "✅ Swap enabled"
else
    echo "✅ Swap already exists"
fi

# 2. Optimize System
echo "⚙️  Optimizing system settings..."

# Increase file descriptors
echo "fs.file-max = 65535" | sudo tee -a /etc/sysctl.conf

# Optimize network
echo "net.core.somaxconn = 1024" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 2048" | sudo tee -a /etc/sysctl.conf

sudo sysctl -p

# 3. Setup Log Rotation
echo "📝 Setting up log rotation..."
sudo tee /etc/logrotate.d/bot-manager > /dev/null <<EOF
/opt/bot-manager/server/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    maxsize 50M
    create 644 ubuntu ubuntu
}
EOF

echo "✅ Log rotation configured"

# 4. Create monitoring script
echo "📊 Creating monitoring script..."
cat > /opt/bot-manager/deploy/check-resources.sh <<'EOF'
#!/bin/bash
echo "=== Bot Manager Resource Check ==="
echo ""
echo "RAM Usage:"
free -h | grep -E "Mem|Swap"
echo ""
echo "Disk Usage:"
df -h / | grep -v Filesystem
echo ""
echo "Database Size:"
du -h /opt/bot-manager/server/data/bot_manager.db* 2>/dev/null | tail -1
echo ""
echo "Running Bots:"
pm2 list | grep -E "bot-manager|online|stopped" | grep -v "│"
echo ""
echo "System Load:"
uptime
EOF

chmod +x /opt/bot-manager/deploy/check-resources.sh

# 5. Setup daily cleanup (remove data older than 60 days)
echo "🧹 Setting up auto cleanup..."
cat > /opt/bot-manager/deploy/auto-cleanup.sh <<'EOF'
#!/bin/bash
# Auto cleanup old data to save disk space

DB_PATH="/opt/bot-manager/server/data/bot_manager.db"

# Keep trades for 60 days
sqlite3 $DB_PATH "DELETE FROM crypto_trades WHERE created_at < datetime('now', '-60 days');"

# Keep logs for 14 days
sqlite3 $DB_PATH "DELETE FROM bot_logs WHERE created_at < datetime('now', '-14 days');"

# Vacuum database
sqlite3 $DB_PATH "VACUUM;"

echo "✅ Cleanup completed at $(date)"
EOF

chmod +x /opt/bot-manager/deploy/auto-cleanup.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/bot-manager/deploy/auto-cleanup.sh >> /opt/bot-manager/server/logs/cleanup.log 2>&1") | crontab -

echo ""
echo "========================================"
echo "✅ Optimization Complete!"
echo "========================================"
echo ""
echo "Configured for:"
echo "  - RAM: 2GB + 1GB Swap"
echo "  - Bots: 2-3 optimal"
echo "  - Data retention: 60 days"
echo "  - Logs retention: 14 days"
echo ""
echo "Useful commands:"
echo "  - Check resources: bash /opt/bot-manager/deploy/check-resources.sh"
echo "  - View logs: pm2 logs bot-manager-api"
echo "  - Monitor: pm2 monit"
echo ""
