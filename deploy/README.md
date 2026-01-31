# 🚀 VPS Deployment Guide

Complete guide to deploy Bot Manager to your VPS (Ubuntu 22.04 LTS)

---

## 📋 Prerequisites

1. **VPS Requirements:**
   - Ubuntu 22.04 LTS
   - 2GB RAM minimum
   - 1-2 CPU cores
   - 50GB SSD
   - Root or sudo access

2. **Local Requirements:**
   - SSH access to VPS
   - Git installed

---

## 🔧 Step 1: Prepare VPS

### 1.1 Connect to VPS
```bash
ssh root@your-vps-ip
# or
ssh username@your-vps-ip
```

### 1.2 Run Setup Script
```bash
# Download and run setup script
curl -O https://raw.githubusercontent.com/your-repo/Bot_Manager/main/deploy/setup-vps.sh
bash setup-vps.sh
```

Or manually:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3
sudo apt install -y python3 python3-pip

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Create directory
sudo mkdir -p /opt/bot-manager
sudo chown -R $USER:$USER /opt/bot-manager
```

---

## 📦 Step 2: Upload Project

### Option A: Using Git (Recommended)
```bash
cd /opt/bot-manager
git clone https://github.com/your-username/Bot_Manager.git .
```

### Option B: Using SCP (from your Mac)
```bash
# On your Mac, compress the project
cd /Users/Macbook/Bot_Manager
tar -czf bot-manager.tar.gz --exclude='node_modules' --exclude='server/data' --exclude='client/dist' .

# Upload to VPS
scp bot-manager.tar.gz username@your-vps-ip:/tmp/

# On VPS, extract
cd /opt/bot-manager
tar -xzf /tmp/bot-manager.tar.gz
rm /tmp/bot-manager.tar.gz
```

### Option C: Using rsync (from your Mac)
```bash
# On your Mac
cd /Users/Macbook
rsync -avz --exclude='node_modules' --exclude='server/data' --exclude='client/dist' \
  Bot_Manager/ username@your-vps-ip:/opt/bot-manager/
```

---

## 🔨 Step 3: Install Dependencies

```bash
cd /opt/bot-manager
bash deploy/install-deps.sh
```

---

## ⚙️ Step 4: Configure Environment

### 4.1 Create .env file
```bash
cp deploy/.env.production server/.env
nano server/.env
```

### 4.2 Update values:
```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://your-vps-ip
JWT_SECRET=YOUR_RANDOM_SECRET_HERE_MIN_32_CHARACTERS
```

**Generate secure JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🚀 Step 5: Start Backend

```bash
cd /opt/bot-manager
bash deploy/start-production.sh
```

**Check status:**
```bash
pm2 status
pm2 logs bot-manager-api
```

---

## 🌐 Step 6: Setup Nginx (Recommended)

### 6.1 Configure Nginx
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/bot-manager
sudo nano /etc/nginx/sites-available/bot-manager
# Update server_name to your domain or VPS IP
```

### 6.2 Enable site
```bash
sudo ln -s /etc/nginx/sites-available/bot-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6.3 Allow HTTP/HTTPS through firewall
```bash
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 🔒 Step 7: SSL Certificate (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically
```

---

## 📊 Step 8: Monitor & Manage

### PM2 Commands
```bash
pm2 status                    # Check status
pm2 logs bot-manager-api      # View logs
pm2 restart bot-manager-api   # Restart
pm2 stop bot-manager-api      # Stop
pm2 delete bot-manager-api    # Delete
```

### Nginx Commands
```bash
sudo systemctl status nginx   # Check status
sudo systemctl restart nginx  # Restart
sudo nginx -t                 # Test config
```

### View bot logs
```bash
tail -f /opt/bot-manager/server/logs/*.log
```

---

## 🔄 Update Deployment

### From Git:
```bash
cd /opt/bot-manager
git pull
npm install --prefix server
npm install --prefix client
npm run build --prefix client
pm2 restart bot-manager-api
```

### From Mac:
```bash
# On Mac
rsync -avz --exclude='node_modules' --exclude='server/data' \
  Bot_Manager/ username@your-vps-ip:/opt/bot-manager/

# On VPS
cd /opt/bot-manager
bash deploy/install-deps.sh
pm2 restart bot-manager-api
```

---

## 🧪 Testing

### Test Backend API
```bash
curl http://localhost:3001/api/health
```

### Test Frontend
Open browser: `http://your-vps-ip`

### Test System Monitor
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3001/api/system/info
```

---

## 🐛 Troubleshooting

### Backend not starting
```bash
pm2 logs bot-manager-api
cd /opt/bot-manager/server
node server.js  # Test manually
```

### Database errors
```bash
cd /opt/bot-manager/server
npm run seed  # Reinitialize database
```

### Nginx errors
```bash
sudo nginx -t
sudo journalctl -u nginx -f
```

### Bot process issues
```bash
ps aux | grep python  # Check running Python processes
pm2 list              # Check PM2 processes
```

---

## 📝 Default Login

**Username:** `admin`
**Password:** `admin123`

⚠️ **Change this immediately after first login!**

---

## 🔐 Security Checklist

- [ ] Changed default admin password
- [ ] Set strong JWT_SECRET
- [ ] Enabled firewall (ufw)
- [ ] Installed SSL certificate
- [ ] Updated server packages
- [ ] Configured backup strategy
- [ ] Set up monitoring

---

## 📞 Support

If you encounter issues, check:
1. PM2 logs: `pm2 logs bot-manager-api`
2. Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. System logs: `sudo journalctl -xe`
