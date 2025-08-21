#!/bin/bash

# One-line installer for PulseChain PnL Tracker
# Usage: curl -sSL https://raw.githubusercontent.com/yourusername/pulsechain-pnl-tracker/main/install.sh | bash

set -e

echo "🚀 PulseChain PnL Tracker - One-Line Installer"
echo "=============================================="
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

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed!"
    echo ""
    echo "Installing Node.js via Homebrew..."
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        print_info "Installing Homebrew first..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    brew install node
    print_status "Node.js installed!"
fi

# Clone the repository
REPO_URL="https://github.com/yourusername/pulsechain-pnl-tracker.git"  # Update this with your actual repo
PROJECT_DIR="pulsechain-pnl-tracker"

print_info "Cloning PulseChain PnL Tracker..."

if [ -d "$PROJECT_DIR" ]; then
    print_warning "Directory $PROJECT_DIR already exists. Updating..."
    cd "$PROJECT_DIR"
    git pull origin main
else
    git clone "$REPO_URL"
    cd "$PROJECT_DIR"
fi

print_status "Repository cloned/updated successfully"

# Run setup
print_info "Running setup..."
./setup.sh

echo ""
echo "🎉 Installation Complete!"
echo "========================"
echo ""
print_info "To start the tracker:"
echo "cd $PROJECT_DIR"
echo "./quick-start.sh"
echo ""
print_info "Or configure manually:"
echo "1. cd $PROJECT_DIR"
echo "2. nano .env  # Add your wallet address"
echo "3. npm start"
echo ""
print_status "Happy trading! 📈"