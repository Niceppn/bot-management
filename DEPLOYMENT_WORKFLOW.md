# Deployment Workflow

## Production Server Setup

**Frontend (Static Files):**
- Location: `/opt/bitnami/apache/htdocs/`
- Served by: Bitnami Apache (port 80)
- Files: HTML, CSS, JS assets

**Backend API:**
- Location: `/opt/bot-manager/server/`
- Served by: Node.js (port 3001)
- Process: Multiple instances running

**Python Bots:**
- Location: `/opt/bot-manager/bots/`
- Process: Background Python processes

## Correct Deploy Steps

### 1. Local Development
```bash
# Make changes locally
git add .
git commit -m "Your message"
git push
```

### 2. Server Update
```bash
# Pull latest code
ssh bitnami@47.129.144.109 "cd /opt/bot-manager && git pull origin main"

# Build frontend
ssh bitnami@47.129.144.109 "cd /opt/bot-manager/client && npm run build"

# Deploy to Apache htdocs (CRITICAL STEP)
ssh bitnami@47.129.144.109 "sudo cp -r /opt/bot-manager/client/dist/* /opt/bitnami/apache/htdocs/"
```

### 3. Restart Services (if needed)
```bash
# Restart Apache
ssh bitnami@47.129.144.109 "sudo /opt/bitnami/ctlscript.sh restart apache"

# Check backend processes
ssh bitnami@47.129.144.109 "ps aux | grep node"
```

## Common Mistakes (FIXED)

❌ **Wrong Path**: `/opt/bot-manager/dist/` - Apache doesn't serve from here
✅ **Correct Path**: `/opt/bitnami/apache/htdocs/` - Apache serves from here

❌ **Missing Step**: Forgetting to copy to htdocs after build
✅ **Fixed**: Always copy from `client/dist/*` to `/opt/bitnami/apache/htdocs/`

## Process Management

**PM2 Location**: `/opt/bitnami/node/bin/pm2`

**Node.js Servers Running:**
- `/opt/bot-manager/server/server.js` (Main API server)
- Multiple instances for load balancing

**Python Bots Running:**
- Price collectors for various symbols
- Background data collection processes

## File Structure

```
/opt/bot-manager/           # Git repository
├── client/dist/           # Build output (temporary)
├── server/               # Node.js API
└── bots/                # Python bots

/opt/bitnami/apache/htdocs/  # ACTUAL web files served by Apache
├── index.html
└── assets/
```

## Deployment Verification

After deployment, check:
1. `cat /opt/bitnami/apache/htdocs/index.html` - Should show latest asset filenames
2. Browser hard refresh (Ctrl+F5) to see changes
3. Check Apache serves the correct files: `curl -I http://your-server/`