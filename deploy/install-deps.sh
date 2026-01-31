#!/bin/bash
#
# Install project dependencies
#

set -e

echo "========================================"
echo "Installing Dependencies"
echo "========================================"
echo ""

# Install Python packages
echo "📦 Installing Python dependencies..."
pip3 install websocket-client systeminformation

# Install Node.js backend dependencies
echo "📦 Installing backend dependencies..."
cd server
npm install --production
cd ..

# Install Node.js frontend dependencies and build
echo "📦 Installing frontend dependencies..."
cd client
npm install
npm run build
cd ..

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p server/data
mkdir -p server/logs

# Initialize database
echo "💾 Initializing database..."
cd server
npm run seed
cd ..

echo ""
echo "✅ Dependencies installed successfully!"
echo ""
