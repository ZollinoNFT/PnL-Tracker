#!/bin/bash

# Quick Start Script - Prompts for wallet address and starts immediately
set -e

echo "🚀 PulseChain PnL Tracker - Quick Start"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if setup has been run
if [ ! -f "node_modules/.package-lock.json" ] && [ ! -f "node_modules/package-lock.json" ]; then
    print_warning "Dependencies not installed. Running setup first..."
    ./setup.sh
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    cp .env.example .env
fi

# Check if wallet address is configured
if grep -q "WALLET_ADDRESS=0x\.\.\." .env; then
    echo ""
    print_info "Please enter your PulseChain wallet address:"
    echo "Example: 0x1234567890123456789012345678901234567890"
    echo ""
    read -p "Wallet Address: " wallet_address
    
    # Validate wallet address format
    if [[ $wallet_address =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        # Update the .env file
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/WALLET_ADDRESS=0x.../WALLET_ADDRESS=$wallet_address/" .env
        else
            # Linux
            sed -i "s/WALLET_ADDRESS=0x.../WALLET_ADDRESS=$wallet_address/" .env
        fi
        print_status "Wallet address configured!"
    else
        print_error "Invalid wallet address format!"
        echo "Please ensure your address:"
        echo "- Starts with 0x"
        echo "- Is exactly 42 characters long"
        echo "- Contains only hexadecimal characters"
        exit 1
    fi
fi

echo ""
print_status "Starting PulseChain PnL Tracker..."
print_info "Dashboard will be available at: http://localhost:3000"
print_info "Press Ctrl+C to stop the tracker"
echo ""

# Start the application
npm start