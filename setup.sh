#!/bin/bash

# PulseChain PnL Tracker - Automated Setup Script
# This script will set up everything you need to run the tracker

set -e  # Exit on any error

echo "🚀 PulseChain Memecoin Trading PnL Tracker Setup"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Node.js is installed
echo "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed!"
    echo ""
    echo "Please install Node.js first:"
    echo "1. Visit https://nodejs.org/"
    echo "2. Download and install the LTS version"
    echo "3. Run this setup script again"
    echo ""
    echo "Or install via Homebrew:"
    echo "  brew install node"
    exit 1
fi

NODE_VERSION=$(node --version)
print_status "Node.js found: $NODE_VERSION"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not available!"
    exit 1
fi

NPM_VERSION=$(npm --version)
print_status "npm found: $NPM_VERSION"

echo ""
echo "Installing dependencies..."
npm install

print_status "Dependencies installed successfully"

echo ""
echo "Setting up environment configuration..."

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    cp .env.example .env
    print_status "Created .env configuration file"
else
    print_warning ".env file already exists, skipping creation"
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p data reports/daily reports/weekly reports/summary logs
print_status "Created data directories"

echo ""
echo "🎯 Setup Complete!"
echo "=================="
echo ""
print_info "Next steps:"
echo "1. Edit the .env file and add your wallet address:"
echo "   nano .env"
echo ""
echo "2. Replace this line:"
echo "   WALLET_ADDRESS=0x..."
echo "   with your actual PulseChain wallet address"
echo ""
echo "3. Start the tracker:"
echo "   npm start"
echo ""
echo "4. Open your browser to:"
echo "   http://localhost:3000"
echo ""
print_warning "IMPORTANT: You must set your WALLET_ADDRESS in the .env file before starting!"
echo ""

# Check if .env has been configured
if grep -q "WALLET_ADDRESS=0x\.\.\." .env; then
    print_warning "Remember to update your wallet address in .env before starting!"
    echo ""
    echo "Quick setup:"
    echo "1. nano .env"
    echo "2. Replace 0x... with your wallet address"
    echo "3. npm start"
fi

echo "Setup script completed successfully! 🎉"