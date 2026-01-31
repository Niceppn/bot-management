#!/bin/bash
#
# Bot Manager VPS Setup Script
# For Ubuntu 22.04 LTS
#
# Usage: bash setup-vps.sh
#

set -e

echo "========================================"
echo "Bot Manager VPS Setup"
echo "========================================"
echo ""

# Update system
echo "📦 Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install Node.js 20.x
echo "📦 Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3 and pip
echo "📦 Installing Python 3..."
sudo apt install -y python3 python3-pip python3-venv

# Install Git
echo "📦 Installing Git..."
sudo apt install -y git

# Install PM2 for process management
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install Nginx (optional - for reverse proxy)
echo "📦 Installing Nginx..."
sudo apt install -y nginx

# Create app directory
echo "📁 Creating application directory..."
sudo mkdir -p /opt/bot-manager
sudo chown -R $USER:$USER /opt/bot-manager

# Clone project (you'll need to upload it first)
echo ""
echo "✅ System setup complete!"
echo ""
echo "Next steps:"
echo "1. Upload your project to /opt/bot-manager"
echo "2. Run: cd /opt/bot-manager && bash deploy/install-deps.sh"
echo "3. Run: bash deploy/start-production.sh"
echo ""
