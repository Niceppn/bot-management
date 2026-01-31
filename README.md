# Bot Manager - Monitoring Dashboard

🤖 เว็บแอปสำหรับ manage และ monitor Python bots ที่รันผ่าน nohup บน VPS

## ✨ Features

- 📊 **Dashboard**: แสดง Bot Status Cards พร้อม Start/Stop controls
- 📄 **Bot Detail Page**: ดู live logs และ statistics แบบ real-time
- 🎨 **Minimalist Dark UI**: ธีมสีมืดสวยงามสไตล์ Vercel/Linear
- 🔐 **Authentication**: Login ด้วย JWT
- 💾 **SQLite Database**: เก็บข้อมูล bots และ logs
- 🔄 **Auto-refresh**: อัพเดทสถานะทุก 5 วินาที
- 📡 **Live Log Streaming**: ดู logs แบบ real-time ผ่าน Server-Sent Events
- ⚡ **Process Management**: Start/Stop/Restart bots ได้จากหน้าเว็บ

## 🚀 Quick Start

### 1. ติดตั้ง Dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Seed Database

```bash
cd server
npm run seed
```

สร้าง:
- User: `admin` / `admin123`
- 3 sample bots (Demo Bot 1, Demo Bot 2, Monitor Bot)

### 3. Start Backend

```bash
cd server
npm start
```

Server จะรันที่ http://localhost:3001

### 4. Start Frontend

```bash
cd client
npm run dev
```

Frontend จะรันที่ http://localhost:5173

### 5. Login

เปิดเบราว์เซอร์ไปที่ http://localhost:5173

- Username: `admin`
- Password: `admin123`

## 📂 Project Structure

```
Bot_Manager/
├── server/                    # Backend (Node.js + Express)
│   ├── config/
│   │   └── database.js       # SQLite configuration
│   ├── middleware/
│   │   └── auth.js           # JWT authentication
│   ├── routes/
│   │   ├── auth.js           # Login/Register endpoints
│   │   ├── bots.js           # Bot management API
│   │   └── logs.js           # Log retrieval API
│   ├── services/
│   │   ├── botManager.js     # Process management
│   │   └── logReader.js      # Log file reading
│   ├── scripts/
│   │   └── seedBots.js       # Database seeding
│   ├── data/                 # SQLite database
│   ├── logs/                 # Bot log files
│   └── server.js             # Main server file
│
├── client/                    # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx            # Login page
│   │   │   ├── Sidebar.jsx          # Navigation sidebar
│   │   │   ├── BotDashboard.jsx     # Main dashboard
│   │   │   ├── BotCard.jsx          # Bot card component
│   │   │   ├── BotDetail.jsx        # Bot detail & logs
│   │   │   └── *.css                # Component styles
│   │   ├── services/
│   │   │   └── api.js               # API client
│   │   ├── styles/
│   │   │   └── App.css              # Global styles
│   │   ├── App.jsx                  # Main app router
│   │   └── main.jsx                 # Entry point
│   ├── index.html
│   └── vite.config.js
│
├── bots/                      # Python bot scripts (ต้องสร้างเอง)
│   ├── demo_bot1.py
│   ├── demo_bot2.py
│   └── monitor_bot.py
│
└── README.md
```

## 🎮 Usage

### Bot Dashboard

1. ดูรายการ bots ทั้งหมด
2. คลิก **▶ Start** เพื่อเริ่ม bot
3. คลิก **⏹ Stop** เพื่อหยุด bot
4. คลิก **View Details** เพื่อดู logs และ stats

### Bot Detail Page

- ดู live logs แบบ real-time
- ดู statistics (uptime, restart count, log count)
- Start/Stop/Restart bot
- Toggle auto-scroll สำหรับ log viewer

## 🐍 สร้าง Python Bot

สร้างไฟล์ Python script ในโฟลเดอร์ `bots/`:

```python
# bots/demo_bot1.py
import time
import sys

print("Demo Bot 1 started!")
sys.stdout.flush()

while True:
    print(f"Bot is running at {time.strftime('%Y-%m-%d %H:%M:%S')}")
    sys.stdout.flush()
    time.sleep(10)
```

**สำคัญ**: ต้องใช้ `sys.stdout.flush()` เพื่อให้ logs แสดงแบบ real-time

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register new user
- `GET /api/auth/verify` - Verify token

### Bots
- `GET /api/bots` - Get all bots
- `GET /api/bots/:id` - Get bot by ID
- `POST /api/bots/:id/start` - Start bot
- `POST /api/bots/:id/stop` - Stop bot
- `POST /api/bots/:id/restart` - Restart bot
- `GET /api/bots/:id/stats` - Get bot statistics

### Logs
- `GET /api/logs/:botId` - Get paginated logs
- `GET /api/logs/:botId/stream` - Stream logs (SSE)
- `GET /api/logs/:botId/tail` - Get last N lines

## 🔧 Configuration

### Backend (.env)

```env
PORT=3001
JWT_SECRET=your-secret-key-change-this-in-production
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### Frontend

แก้ไข `client/src/services/api.js`:

```javascript
const API_BASE_URL = 'http://localhost:3001/api'
```

## 🎨 UI Theme

- **Dark Background**: Gradient from #0f0f23 to #1a1a3e
- **Primary Color**: Purple (#8b5cf6) to Blue (#6366f1)
- **Success**: Green (#10b981)
- **Error**: Red (#ef4444)
- **Warning**: Orange (#f59e0b)
- **Glass Effect**: Semi-transparent with backdrop blur

## 🚢 Deployment

### Backend (VPS)

```bash
# Clone repository
git clone <repo-url>
cd Bot_Manager/server

# Install dependencies
npm install

# Set environment variables
nano .env

# Seed database
npm run seed

# Start with PM2
pm2 start server.js --name bot-manager-server
```

### Frontend (Vercel/Netlify)

```bash
cd client
npm run build
# Deploy dist/ folder
```

## 🔒 Security

- JWT authentication with bcrypt password hashing
- Environment variables for secrets
- CORS configuration
- Input validation
- SQL injection prevention with prepared statements

## 📝 TODO

- [ ] สร้าง Python bot scripts
- [ ] เพิ่มฟีเจอร์ Schedule bot runs (cron-like)
- [ ] เพิ่มฟีเจอร์ Log search และ filtering
- [ ] Export logs to file
- [ ] Email notifications on failures
- [ ] Bot performance metrics
- [ ] Multi-bot start/stop
- [ ] Bot groups/tags

## 📄 License

MIT

## 🙏 Credits

สร้างด้วย React, Node.js, Express, และ SQLite
