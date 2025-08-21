# PulseChain Memecoin Trading PnL Tracker

A comprehensive, professional-grade JavaScript application for tracking profits and losses from memecoin trading on PulseChain. This tool provides real-time monitoring, detailed analytics, and automated reporting for your trading activities.

## 🚀 **Super Quick Setup** (Recommended)

### **Option 1: One-Line Install** (Coming Soon)
```bash
curl -sSL https://raw.githubusercontent.com/yourusername/pulsechain-pnl-tracker/main/install.sh | bash
```

### **Option 2: Git Clone + Quick Start** (Available Now)
```bash
# Clone the repository
git clone https://github.com/yourusername/pulsechain-pnl-tracker.git
cd pulsechain-pnl-tracker

# Quick setup and start
./quick-start.sh
```

That's it! The quick-start script will:
- Install all dependencies automatically
- Prompt you for your wallet address
- Start the tracker immediately
- Open the dashboard at `http://localhost:3000`

### **Option 3: Manual Setup**
```bash
git clone https://github.com/yourusername/pulsechain-pnl-tracker.git
cd pulsechain-pnl-tracker
./setup.sh
nano .env  # Add your wallet address
npm start
```

## ✨ **What You Get**

### **Professional PnL Tracking**
- ✅ **Real-time PnL in PLS** with USD conversion (e.g., "+10,000,000 PLS ~$500")
- ✅ **Past 3 weeks + ongoing** trade monitoring
- ✅ **1.5-minute updates** for maximum precision
- ✅ **Professional dashboard** with live WebSocket updates
- ✅ **Automated daily reports** generated every 24 hours

### **Comprehensive Analytics**
- 📊 **Token metadata** - names, tickers, launch dates
- 📈 **Trade statistics** - count, hold times, realized/unrealized PnL
- 🎯 **Performance metrics** - win rates, profit factors, Sharpe ratios
- 💼 **Position tracking** - current holdings, average prices, USD values
- 📋 **Professional reports** - suitable for tax/business records

### **Technical Excellence**
- 🔗 **PulseChain native** Web3 integration
- 🔄 **Multi-source price feeds** (CoinGecko, DEXScreener, PulseX)
- 🛡️ **Error handling & recovery** for 24/7 operation
- 💾 **Data persistence** with local caching
- 🎨 **Modern responsive UI** with professional styling

## 📊 **Dashboard Features**

### **Real-time Overview**
- Live PnL tracking with instant USD conversion
- Current positions with unrealized gains/losses
- Trading statistics and performance metrics
- Recent transaction history with buy/sell indicators

### **Detailed Analytics**
- **Positions Tab**: All current and closed positions with filtering
- **Transactions Tab**: Recent trades with PulseChain explorer links
- **Reports Tab**: Generate and view daily/weekly performance reports
- **Settings Tab**: System status, configuration, and manual controls

### **Automated Reporting**
- **Daily documents** with complete trade analysis (generated at 23:59 UTC)
- **Weekly summaries** with performance trends (Sundays at 23:59 UTC)
- **Professional formatting** suitable for record keeping
- **Multiple formats** (JSON + human-readable text)

## 🔧 **Requirements**

- **macOS 10.14+** (or Linux/Windows with minor modifications)
- **Node.js 18+** (automatically installed by setup scripts)
- **4GB RAM minimum** (8GB recommended)
- **Stable internet connection**
- **Your PulseChain wallet address** (read-only, no private keys needed)

## 🛠 **Advanced Usage**

### **Running Scripts**
```bash
./setup.sh          # Full setup with dependency installation
./quick-start.sh     # Interactive setup + immediate start
npm start           # Start the tracker (after setup)
npm run dev         # Development mode with auto-restart
```

### **Configuration**
Edit `.env` file for custom settings:
```env
WALLET_ADDRESS=0xYourWalletAddress     # Required
PORT=3000                              # Dashboard port
UPDATE_INTERVAL_MS=90000               # Update frequency (1.5 min)
PULSECHAIN_RPC_URL=https://rpc.pulsechain.com
COINGECKO_API_KEY=your_api_key         # Optional, for better price data
```

### **File Structure**
```
pulsechain-pnl-tracker/
├── setup.sh              # Automated setup script
├── quick-start.sh         # Interactive quick start
├── src/                   # Application source code
├── reports/               # Generated reports (daily/weekly)
├── data/                  # Cached data and metadata
└── package.json           # Dependencies and scripts
```

## 🔒 **Security & Privacy**

- **Read-only access** - no private keys or signing required
- **Local data storage** - everything stays on your machine
- **No external data sharing** - your trading data is private
- **Open source** - review all code before running

## 📈 **Professional Features**

### **What This Tracker Provides**
✅ **Institutional-grade precision** - updates every 90 seconds  
✅ **Complete trade history** - past 3 weeks + ongoing monitoring  
✅ **Professional reporting** - daily documents with all statistics  
✅ **Token intelligence** - automatic metadata and launch date fetching  
✅ **Performance analytics** - win rates, profit factors, volatility metrics  
✅ **Real-time dashboard** - WebSocket-powered live updates  
✅ **Data reliability** - multiple backup systems and error recovery  

### **Perfect For**
- Serious memecoin traders on PulseChain
- Tax preparation and record keeping
- Performance analysis and strategy optimization
- Portfolio management and risk assessment

## 🆘 **Support**

### **Common Issues**
- **"Command not found"** → Make sure you're in the project directory
- **"Invalid wallet address"** → Use your complete PulseChain address (0x...)
- **"No transactions found"** → Ensure you've traded in the past 3 weeks
- **Dashboard won't load** → Check if port 3000 is available

### **Getting Help**
1. Check the terminal output for error messages
2. Review the Settings tab in the dashboard for system status
3. Try restarting with `./quick-start.sh`
4. Ensure your `.env` file has the correct wallet address

## 🎯 **Ready to Track Your PnL?**

The easiest way to get started:

```bash
git clone https://github.com/yourusername/pulsechain-pnl-tracker.git
cd pulsechain-pnl-tracker
./quick-start.sh
```

Your professional PnL tracker will be running at `http://localhost:3000` in under 2 minutes! 🚀

---

**Built for professional traders who demand precision, reliability, and comprehensive analytics for their PulseChain memecoin trading activities.**