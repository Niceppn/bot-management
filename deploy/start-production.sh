#!/bin/bash
#
# Start Bot Manager in Production Mode
#

set -e

echo "========================================"
echo "Starting Bot Manager (Production)"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f "server/.env" ]; then
    echo "❌ Error: server/.env not found!"
    echo ""
    echo "Please create server/.env from deploy/.env.production:"
    echo "  cp deploy/.env.production server/.env"
    echo "  nano server/.env  # Edit the values"
    exit 1
fi

# Stop existing PM2 processes
echo "🛑 Stopping existing processes..."
pm2 delete bot-manager-api 2>/dev/null || true

# Start backend with PM2
echo "🚀 Starting backend server..."
pm2 start deploy/ecosystem.config.js

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 startup script
echo "⚙️  Setting up PM2 startup..."
pm2 startup

echo ""
echo "✅ Bot Manager started successfully!"
echo ""
echo "📊 Check status: pm2 status"
echo "📄 View logs:   pm2 logs bot-manager-api"
echo "🔄 Restart:     pm2 restart bot-manager-api"
echo "🛑 Stop:        pm2 stop bot-manager-api"
echo ""
echo "🌐 Backend API: http://localhost:3001"
echo ""
echo "⚠️  Note: Frontend needs to be served separately"
echo "   Option 1: Use Nginx to serve built files"
echo "   Option 2: Run 'npm run preview' in client folder"
echo ""
