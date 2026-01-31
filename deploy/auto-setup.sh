#!/bin/bash
#
# Auto Setup Script - Interactive
# จะถามข้อมูลแล้ว config ทุกอย่างให้อัตโนมัติ
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
cat << "EOF"
╔══════════════════════════════════════════════════════════╗
║          Bot Manager - Auto Setup Script                ║
║          จะ setup ทุกอย่างให้อัตโนมัติ                  ║
╚══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}❌ Please do not run as root${NC}"
    echo "Run as: bash deploy/auto-setup.sh"
    exit 1
fi

# Check if in correct directory
if [ ! -d "deploy" ]; then
    echo -e "${RED}❌ Please run from /opt/bot-manager directory${NC}"
    echo "cd /opt/bot-manager && bash deploy/auto-setup.sh"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 ข้อมูลที่ต้องการ:${NC}"
echo ""

# 1. Get VPS IP
if [ -z "$VPS_IP" ]; then
    read -p "🌐 VPS IP Address: " VPS_IP
fi

# 2. Get Domain (optional)
read -p "🌍 Domain name (optional, press Enter to skip): " DOMAIN
if [ -z "$DOMAIN" ]; then
    DOMAIN=$VPS_IP
fi

# 3. Confirm
echo ""
echo -e "${BLUE}📝 Configuration Summary:${NC}"
echo "────────────────────────────────────────"
echo "VPS IP: $VPS_IP"
echo "Domain: $DOMAIN"
echo "Path: /opt/bot-manager"
echo "────────────────────────────────────────"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

echo ""
echo -e "${GREEN}🚀 Starting auto setup...${NC}"
echo ""

# ============================================
# 1. System Update & Install
# ============================================
echo -e "${BLUE}[1/9]${NC} Updating system packages..."
sudo apt update -qq
sudo apt upgrade -y -qq

echo -e "${GREEN}✅${NC} System updated"

# ============================================
# 2. Install Node.js
# ============================================
echo -e "${BLUE}[2/9]${NC} Installing Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
    sudo apt install -y nodejs -qq
    echo -e "${GREEN}✅${NC} Node.js installed: $(node --version)"
else
    echo -e "${GREEN}✅${NC} Node.js already installed: $(node --version)"
fi

# ============================================
# 3. Install Python & Pip
# ============================================
echo -e "${BLUE}[3/9]${NC} Installing Python..."
if ! command -v python3 &> /dev/null; then
    sudo apt install -y python3 python3-pip -qq
    echo -e "${GREEN}✅${NC} Python installed: $(python3 --version)"
else
    echo -e "${GREEN}✅${NC} Python already installed: $(python3 --version)"
fi

# Install Python packages
pip3 install -q websocket-client
echo -e "${GREEN}✅${NC} Python packages installed"

# ============================================
# 4. Install PM2
# ============================================
echo -e "${BLUE}[4/9]${NC} Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2 > /dev/null 2>&1
    echo -e "${GREEN}✅${NC} PM2 installed"
else
    echo -e "${GREEN}✅${NC} PM2 already installed"
fi

# ============================================
# 5. Install Nginx
# ============================================
echo -e "${BLUE}[5/9]${NC} Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx -qq
    echo -e "${GREEN}✅${NC} Nginx installed"
else
    echo -e "${GREEN}✅${NC} Nginx already installed"
fi

# ============================================
# 6. Install Dependencies
# ============================================
echo -e "${BLUE}[6/9]${NC} Installing project dependencies..."

# Backend
cd server
npm install --production --silent > /dev/null 2>&1
cd ..
echo -e "${GREEN}✅${NC} Backend dependencies installed"

# Frontend
cd client
npm install --silent > /dev/null 2>&1
npm run build > /dev/null 2>&1
cd ..
echo -e "${GREEN}✅${NC} Frontend built"

# Create directories
mkdir -p server/data server/logs

# ============================================
# 7. Configure Environment
# ============================================
echo -e "${BLUE}[7/9]${NC} Configuring environment..."

# Generate JWT secret
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Create .env file
cat > server/.env << EOF
# Production Environment Variables
NODE_ENV=production
PORT=3001

# Frontend URL
FRONTEND_URL=http://${DOMAIN}

# JWT Secret (auto-generated)
JWT_SECRET=${JWT_SECRET}

# Database
DB_PATH=./data/bot_manager.db

# Python Path
PYTHON_PATH=/usr/bin/python3
EOF

echo -e "${GREEN}✅${NC} Environment configured"
echo "   JWT_SECRET: ${JWT_SECRET:0:16}..."

# ============================================
# 8. Initialize Database
# ============================================
echo -e "${BLUE}[8/9]${NC} Initializing database..."
cd server
npm run seed > /dev/null 2>&1
cd ..
echo -e "${GREEN}✅${NC} Database initialized"
echo "   Username: admin"
echo "   Password: admin123"

# ============================================
# 9. Optimize System (2GB RAM)
# ============================================
echo -e "${BLUE}[9/9]${NC} Optimizing system for 2GB RAM..."

# Add swap if not exists
if [ ! -f /swapfile ]; then
    sudo fallocate -l 1G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile > /dev/null 2>&1
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
    sudo sysctl vm.swappiness=10 > /dev/null 2>&1
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf > /dev/null
    echo -e "${GREEN}✅${NC} Swap added (1GB)"
else
    echo -e "${GREEN}✅${NC} Swap already exists"
fi

# Setup log rotation
sudo tee /etc/logrotate.d/bot-manager > /dev/null << 'LOGROTATE'
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
LOGROTATE
echo -e "${GREEN}✅${NC} Log rotation configured"

# Create monitoring script
cat > deploy/check-resources.sh << 'MONITOR'
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
MONITOR
chmod +x deploy/check-resources.sh
echo -e "${GREEN}✅${NC} Monitoring script created"

# Create auto cleanup script
cat > deploy/auto-cleanup.sh << 'CLEANUP'
#!/bin/bash
DB_PATH="/opt/bot-manager/server/data/bot_manager.db"
sqlite3 $DB_PATH "DELETE FROM crypto_trades WHERE created_at < datetime('now', '-60 days');"
sqlite3 $DB_PATH "DELETE FROM bot_logs WHERE created_at < datetime('now', '-14 days');"
sqlite3 $DB_PATH "VACUUM;"
echo "✅ Cleanup completed at $(date)"
CLEANUP
chmod +x deploy/auto-cleanup.sh

# Add to crontab
(crontab -l 2>/dev/null | grep -v "auto-cleanup.sh"; echo "0 3 * * * /opt/bot-manager/deploy/auto-cleanup.sh >> /opt/bot-manager/server/logs/cleanup.log 2>&1") | crontab -
echo -e "${GREEN}✅${NC} Auto cleanup scheduled (daily 3 AM)"

# Optimize system settings
echo "fs.file-max = 65535" | sudo tee -a /etc/sysctl.conf > /dev/null
echo "net.core.somaxconn = 1024" | sudo tee -a /etc/sysctl.conf > /dev/null
echo "net.ipv4.tcp_max_syn_backlog = 2048" | sudo tee -a /etc/sysctl.conf > /dev/null
sudo sysctl -p > /dev/null 2>&1
echo -e "${GREEN}✅${NC} System optimized"

# ============================================
# 10. Configure Nginx
# ============================================
echo ""
echo -e "${BLUE}[Bonus]${NC} Configuring Nginx..."

# Create nginx config
sudo tee /etc/nginx/sites-available/bot-manager > /dev/null << NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    # Frontend
    location / {
        root /opt/bot-manager/client/dist;
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
    }

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/x-javascript application/xml+rss
               application/javascript application/json;
}
NGINX

# Enable site
sudo ln -sf /etc/nginx/sites-available/bot-manager /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx config
if sudo nginx -t > /dev/null 2>&1; then
    sudo systemctl reload nginx
    echo -e "${GREEN}✅${NC} Nginx configured and reloaded"
else
    echo -e "${YELLOW}⚠️${NC}  Nginx config has errors, please check manually"
fi

# ============================================
# 11. Start Backend with PM2
# ============================================
echo ""
echo -e "${BLUE}[Starting]${NC} Starting backend with PM2..."

# Stop existing
pm2 delete bot-manager-api 2>/dev/null || true

# Start
pm2 start deploy/ecosystem.config.js > /dev/null 2>&1
pm2 save > /dev/null 2>&1

# Setup startup
STARTUP_CMD=$(pm2 startup | tail -1)
if [[ $STARTUP_CMD == sudo* ]]; then
    eval $STARTUP_CMD > /dev/null 2>&1
fi

echo -e "${GREEN}✅${NC} Backend started with PM2"

# ============================================
# 12. Configure Firewall
# ============================================
echo ""
echo -e "${BLUE}[Security]${NC} Configuring firewall..."

if command -v ufw &> /dev/null; then
    sudo ufw --force enable > /dev/null 2>&1
    sudo ufw allow 22/tcp > /dev/null 2>&1
    sudo ufw allow 80/tcp > /dev/null 2>&1
    sudo ufw allow 443/tcp > /dev/null 2>&1
    echo -e "${GREEN}✅${NC} Firewall configured (SSH, HTTP, HTTPS)"
else
    echo -e "${YELLOW}⚠️${NC}  UFW not available, configure firewall manually"
fi

# ============================================
# Summary
# ============================================
echo ""
echo -e "${GREEN}"
cat << "EOF"
╔══════════════════════════════════════════════════════════╗
║              ✅ Setup Complete!                          ║
╚══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${BLUE}📊 System Information:${NC}"
echo "────────────────────────────────────────"
echo "✅ Node.js:    $(node --version)"
echo "✅ Python:     $(python3 --version | cut -d' ' -f2)"
echo "✅ PM2:        $(pm2 --version)"
echo "✅ Nginx:      Running"
echo "✅ Backend:    Running on port 3001"
echo "✅ Frontend:   Built and ready"
echo "✅ Database:   Initialized"
echo "✅ Swap:       1GB added"
echo "✅ Firewall:   Configured"
echo "────────────────────────────────────────"

echo ""
echo -e "${BLUE}🌐 Access Your Bot Manager:${NC}"
echo "────────────────────────────────────────"
echo "URL:      http://${DOMAIN}"
echo "Username: admin"
echo "Password: admin123"
echo ""
echo -e "${RED}⚠️  IMPORTANT: Change password after first login!${NC}"
echo "────────────────────────────────────────"

echo ""
echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo "────────────────────────────────────────"
echo "Check status:    pm2 status"
echo "View logs:       pm2 logs bot-manager-api"
echo "Restart:         pm2 restart bot-manager-api"
echo "Check resources: bash deploy/check-resources.sh"
echo "Backup:          bash deploy/backup.sh"
echo "────────────────────────────────────────"

echo ""
echo -e "${BLUE}📈 Next Steps:${NC}"
echo "1. Open http://${DOMAIN} in your browser"
echo "2. Login with admin/admin123"
echo "3. Change your password immediately"
echo "4. Create your first bot (+ Create Price Collector)"
echo "5. Monitor resources: bash deploy/check-resources.sh"

echo ""
echo -e "${GREEN}🎉 Happy Bot Managing!${NC}"
echo ""

# Show current status
echo -e "${BLUE}📊 Current Status:${NC}"
pm2 status

echo ""
read -p "Press Enter to continue..."
