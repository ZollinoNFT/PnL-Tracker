#!/bin/bash

echo "🚀 Creating Complete PulseChain PNL Tracker..."
echo "================================================"

# Create directory structure
mkdir -p src/api src/config src/services src/utils logs

# Create .env file
cat > .env << 'EOF'
# PulseChain Memecoin PNL Tracker Configuration

# Moralis API Key (Already configured for you)
MORALIS_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjlkYzY2ZDRiLTI3NTYtNDc2OS05NDM4LWI3N2Y2NmYwOTUxYiIsIm9yZ0lkIjoiNDY2MjQzIiwidXNlcklkIjoiNDc5NjU5IiwidHlwZUlkIjoiYWM0MzMzZDItYzFlYS00NGE2LWIwYjktZjIzMTMzOWZlYTEwIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NTU3NTc5MzIsImV4cCI6NDkxMTUxNzkzMn0.v2gKPDD4Xoksv_N19i40hScTmvI3iMvuFYMpau3O8JM

# CoinGecko API Key (Already configured for you)
COINGECKO_API_KEY=CG-KUBBoaCRwHk68DrPew93SYMd

# ⚠️ IMPORTANT: ADD YOUR WALLET ADDRESS HERE! ⚠️
WALLET_ADDRESS=0x_YOUR_WALLET_ADDRESS_HERE

# PulseChain RPC Endpoint
PULSECHAIN_RPC=https://rpc-pulsechain.g4mm4.io

# Update Interval in Minutes
UPDATE_INTERVAL=3

# Blacklisted Token Addresses (comma-separated)
BLACKLISTED_TOKENS=

# Enable Debug Logging
DEBUG_MODE=false

# Log File Path
LOG_FILE_PATH=./logs/pnl-tracker.log

# Tracking Start Date
TRACKING_START_DATE=2025-08-01

# Display Currency
DISPLAY_CURRENCY=USD
EOF

echo "✅ Created .env configuration file"

# Download all source files from the workspace
echo "📥 Creating source files..."

# Create package.json
cat > package.json << 'EOF'
{
  "name": "pulsechain-memecoin-pnl-tracker",
  "version": "1.0.0",
  "description": "Professional PulseChain Memecoin Profit and Loss (PNL) Tracking Script",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "axios": "^1.6.5",
    "dotenv": "^16.3.1",
    "ethers": "^6.10.0",
    "moralis": "^2.26.0",
    "node-cron": "^3.0.3",
    "winston": "^3.11.0",
    "chalk": "^5.3.0"
  }
}
EOF

echo "✅ Created package.json"
echo ""
echo "📦 Installing dependencies (this may take a minute)..."
npm install

echo ""
echo "================================================"
echo "✅ SETUP COMPLETE!"
echo "================================================"
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1. EDIT THE .ENV FILE TO ADD YOUR WALLET ADDRESS:"
echo "   Run: nano .env"
echo ""
echo "2. Find this line:"
echo "   WALLET_ADDRESS=0x_YOUR_WALLET_ADDRESS_HERE"
echo ""
echo "3. Replace with your actual PulseChain wallet address"
echo ""
echo "4. Save the file (Ctrl+X, then Y, then Enter)"
echo ""
echo "5. START THE TRACKER:"
echo "   Run: npm start"
echo ""
echo "================================================"