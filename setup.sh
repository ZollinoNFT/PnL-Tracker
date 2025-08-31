#!/bin/bash

# PulseChain PNL Tracker Setup Script
echo "🚀 Setting up PulseChain Memecoin PNL Tracker..."

# Create directory structure
mkdir -p src/api src/config src/services src/utils logs

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
  "keywords": [
    "pulsechain",
    "memecoin",
    "pnl",
    "crypto",
    "tracking",
    "defi"
  ],
  "author": "",
  "license": "MIT",
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

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "✅ Setup complete!"
echo ""
echo "⚠️  IMPORTANT: Now you need to:"
echo "1. Edit the .env file and add your wallet address"
echo "   Run: nano .env"
echo "2. Find the line: WALLET_ADDRESS=0x_YOUR_WALLET_ADDRESS_HERE"
echo "3. Replace with your actual PulseChain wallet address"
echo "4. Save and exit (Ctrl+X, then Y, then Enter)"
echo "5. Run: npm start"