# 📝 Bot Manager Cheat Sheet

คำสั่งที่ใช้บ่อย - ท่องจำง่าย

---

## 🚀 PM2 Commands

```bash
pm2 status                    # ดูสถานะ
pm2 logs                      # ดู logs ทั้งหมด
pm2 logs bot-manager-api      # ดู logs backend
pm2 restart bot-manager-api   # รีสตาร์ท
pm2 stop bot-manager-api      # หยุด
pm2 start bot-manager-api     # เริ่ม
pm2 delete bot-manager-api    # ลบ process
pm2 monit                     # Monitor real-time
pm2 save                      # Save config
```

---

## 🌐 Nginx Commands

```bash
sudo systemctl status nginx   # เช็คสถานะ
sudo systemctl start nginx    # เริ่ม
sudo systemctl stop nginx     # หยุด
sudo systemctl restart nginx  # รีสตาร์ท
sudo systemctl reload nginx   # โหลด config ใหม่
sudo nginx -t                 # ทดสอบ config
sudo tail -f /var/log/nginx/error.log  # ดู error log
```

---

## 💾 Database Commands

```bash
# เข้าใช้ database
sqlite3 /opt/bot-manager/server/data/bot_manager.db

# ดูจำนวนข้อมูล
sqlite3 /opt/bot-manager/server/data/bot_manager.db \
  "SELECT COUNT(*) FROM crypto_trades;"

# ดูข้อมูลล่าสุด 10 รายการ
sqlite3 /opt/bot-manager/server/data/bot_manager.db \
  "SELECT * FROM crypto_trades ORDER BY id DESC LIMIT 10;"

# ดูขนาด database
du -h /opt/bot-manager/server/data/bot_manager.db*

# Backup database
cp /opt/bot-manager/server/data/bot_manager.db \
   /opt/bot-manager/server/data/bot_manager.db.backup
```

---

## 📊 Monitor Commands

```bash
# เช็ค resources
bash /opt/bot-manager/deploy/check-resources.sh

# RAM usage
free -h

# Disk usage
df -h

# CPU & Memory (interactive)
htop  # กด q เพื่อออก

# ดู process
ps aux | grep python  # Python bots
ps aux | grep node    # Node.js

# System load
uptime
```

---

## 📝 Log Commands

```bash
# Backend logs
tail -f /opt/bot-manager/server/logs/pm2-out.log
tail -f /opt/bot-manager/server/logs/pm2-error.log

# Bot logs
tail -f /opt/bot-manager/server/logs/*.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -f
```

---

## 🧹 Cleanup Commands

```bash
# ลบข้อมูลเก่า (รัน script)
bash /opt/bot-manager/deploy/auto-cleanup.sh

# ลบข้อมูลเก่ากว่า 30 วัน (manual)
sqlite3 /opt/bot-manager/server/data/bot_manager.db \
  "DELETE FROM crypto_trades WHERE created_at < datetime('now', '-30 days');"

# VACUUM database (ลดขนาด)
sqlite3 /opt/bot-manager/server/data/bot_manager.db "VACUUM;"

# ลบ logs เก่า
find /opt/bot-manager/server/logs -name "*.log" -mtime +7 -delete

# ลบ compressed logs
find /opt/bot-manager/server/logs -name "*.gz" -mtime +14 -delete
```

---

## 💾 Backup Commands

```bash
# Backup database + logs
cd /opt/bot-manager
tar -czf backup-$(date +%Y%m%d).tar.gz \
  server/data \
  server/logs \
  server/.env

# Download backup to Mac
scp -i ~/Downloads/LightsailDefaultKey-*.pem \
  ubuntu@YOUR_IP:/opt/bot-manager/backup-*.tar.gz \
  ~/Downloads/

# Restore from backup
tar -xzf backup-20260131.tar.gz -C /opt/bot-manager/
```

---

## 🔄 Update Commands

```bash
# Pull latest code (if using git)
cd /opt/bot-manager
git pull
npm install --prefix server
npm install --prefix client
npm run build --prefix client
pm2 restart bot-manager-api

# Update system packages
sudo apt update
sudo apt upgrade -y

# Update Node.js packages
cd /opt/bot-manager/server
npm update

# Update Python packages
pip3 install --upgrade websocket-client
```

---

## 🔧 Troubleshooting Commands

```bash
# เช็คว่า backend รันไหม
curl http://localhost:3001/api/health

# เช็ค port ที่เปิดอยู่
sudo netstat -tulpn | grep LISTEN

# เช็ค process ที่กิน CPU สูง
ps aux --sort=-%cpu | head -10

# เช็ค process ที่กิน RAM สูง
ps aux --sort=-%mem | head -10

# Kill process (ถ้าค้าง)
pm2 delete all
pkill -f node
pkill -f python3

# รีสตาร์ท Nginx
sudo systemctl restart nginx

# ดู error ล่าสุด
tail -50 /opt/bot-manager/server/logs/pm2-error.log
```

---

## 🔐 Security Commands

```bash
# เปลี่ยน ownership
sudo chown -R ubuntu:ubuntu /opt/bot-manager

# Set permissions
chmod 600 /opt/bot-manager/server/.env
chmod +x /opt/bot-manager/deploy/*.sh

# ดูว่าใครเข้า SSH
last
who

# Update firewall (UFW)
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 📱 Quick Checks

```bash
# เช็คทุกอย่างในคำสั่งเดียว
echo "=== PM2 Status ===" && pm2 status && \
echo "=== RAM Usage ===" && free -h && \
echo "=== Disk Usage ===" && df -h / && \
echo "=== DB Size ===" && du -h /opt/bot-manager/server/data/bot_manager.db && \
echo "=== Nginx Status ===" && sudo systemctl status nginx --no-pager

# เช็ค bot ทั้งหมด
sqlite3 /opt/bot-manager/server/data/bot_manager.db \
  "SELECT id, name, status, started_at FROM bots;"

# เช็ค trades วันนี้
sqlite3 /opt/bot-manager/server/data/bot_manager.db \
  "SELECT COUNT(*) FROM crypto_trades WHERE date(created_at) = date('now');"
```

---

## 🎯 One-Liner Commands

```bash
# Restart everything
pm2 restart all && sudo systemctl reload nginx

# Full backup
cd /opt/bot-manager && tar -czf ~/backup-$(date +%Y%m%d-%H%M%S).tar.gz server/data server/logs server/.env

# Clean everything
bash /opt/bot-manager/deploy/auto-cleanup.sh && pm2 flush

# Check if running
pm2 list | grep online

# Get bot IDs
sqlite3 /opt/bot-manager/server/data/bot_manager.db "SELECT id, name FROM bots;"

# Export today's trades
sqlite3 -header -csv /opt/bot-manager/server/data/bot_manager.db \
  "SELECT * FROM crypto_trades WHERE date(created_at) = date('now');" > trades-today.csv
```

---

## 📞 Emergency Commands

```bash
# ถ้าระบบค้าง - Hard restart
sudo reboot

# ถ้า disk เต็ม - ลบข้อมูลฉุกเฉิน
sqlite3 /opt/bot-manager/server/data/bot_manager.db \
  "DELETE FROM crypto_trades WHERE id < (SELECT MAX(id) - 10000 FROM crypto_trades);"

# ถ้า RAM เต็ม - clear cache
sudo sync && sudo sysctl -w vm.drop_caches=3

# ถ้า bot error - ลบแล้วสร้างใหม่
# (ทำใน web UI)

# ถ้า database corrupt
cp /opt/bot-manager/server/data/bot_manager.db /opt/bot-manager/server/data/bot_manager.db.corrupt
sqlite3 /opt/bot-manager/server/data/bot_manager.db.corrupt ".recover" | sqlite3 /opt/bot-manager/server/data/bot_manager.db
```

---

## 🔖 Bookmarks

```bash
# เพิ่ม aliases ใน ~/.bashrc
echo 'alias pm2logs="pm2 logs bot-manager-api"' >> ~/.bashrc
echo 'alias botcheck="bash /opt/bot-manager/deploy/check-resources.sh"' >> ~/.bashrc
echo 'alias botbackup="cd /opt/bot-manager && tar -czf ~/backup-$(date +%Y%m%d).tar.gz server/data server/logs"' >> ~/.bashrc
source ~/.bashrc

# ใช้งาน:
pm2logs      # ดู logs
botcheck     # เช็ค resources
botbackup    # backup
```

---

## 📚 Quick Reference

**Config Files:**
- Backend: `/opt/bot-manager/server/.env`
- Nginx: `/etc/nginx/sites-available/bot-manager`
- PM2: `/opt/bot-manager/deploy/ecosystem.config.js`

**Data Files:**
- Database: `/opt/bot-manager/server/data/bot_manager.db`
- Logs: `/opt/bot-manager/server/logs/`

**Important URLs:**
- Web UI: `http://YOUR_IP`
- Backend API: `http://YOUR_IP:3001` (internal)
- System Monitor: In web UI dashboard

---

สั่งพิมพ์ไว้ใกล้ๆ หรือเซฟเป็น bookmark! 📌
