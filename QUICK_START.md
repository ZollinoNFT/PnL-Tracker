# Quick Start Guide - PulseChain PnL Tracker

## 🚀 Get Started in 5 Minutes

### Prerequisites
- macOS computer
- Your PulseChain wallet address (public address starting with 0x)
- Internet connection

### Step 1: Install Node.js (if not already installed)
```bash
# Check if Node.js is installed
node --version

# If not installed, download from: https://nodejs.org/
```

### Step 2: Setup the Tracker
```bash
# Navigate to the project directory
cd pulsechain-pnl-tracker

# Install dependencies
npm install

# Run the interactive setup
npm run setup
```

### Step 3: Start Tracking
```bash
npm start
```

That's it! Your PnL tracker is now running.

## 📊 What You'll See

### Initial Output
```
PULSECHAIN PNL TRACKER - CURRENT STATUS
========================================
Wallet: 0x1234567890123456789012345678901234567890
Last Updated: 2024-01-15 14:30:45
PLS Price: $0.000123

PORTFOLIO SUMMARY:
Total PnL: +1,250,000 PLS ~$153.75
Realized PnL: +800,000 PLS ~$98.40
Unrealized PnL: +450,000 PLS ~$55.35
Daily PnL: +125,000 PLS ~$15.38
Weekly PnL: +875,000 PLS ~$107.63
Active Positions: 12
Total Trades: 47
```

### Commands While Running
Type these commands in the terminal:
- `status` - Show current PnL
- `report` - Generate daily report
- `weekly` - Generate weekly report
- `sync` - Update data manually
- `exit` - Stop the tracker

## 📁 Where Reports Are Saved

### Daily Reports (Generated at Midnight)
- **Text**: `./reports/daily/report_2024-01-15.txt`
- **JSON**: `./reports/daily/report_2024-01-15.json`
- **CSV**: `./reports/csv/trades_2024-01-15.csv`

### Weekly Reports (Generated Sundays)
- **Text**: `./reports/weekly/weekly_report_2024-01-08_to_2024-01-14.txt`
- **JSON**: `./reports/weekly/weekly_report_2024-01-08_to_2024-01-14.json`

## 🔧 Configuration

The setup script creates a `.env` file with your configuration:

```env
WALLET_ADDRESS=0x1234567890123456789012345678901234567890
UPDATE_INTERVAL=1.5
TRACKING_START_DATE=2024-01-01
```

## ⚡ Key Features

### Automatic Tracking
- ✅ Updates every 1.5 minutes
- ✅ Tracks PLS price in real-time
- ✅ Monitors all your memecoin trades
- ✅ Calculates realized and unrealized PnL

### Professional Reports
- ✅ Daily trade summaries
- ✅ Weekly performance analysis
- ✅ Per-token breakdown
- ✅ Hold time calculations
- ✅ Percentage returns

### Data Formats
- ✅ Human-readable text reports
- ✅ JSON data for integrations
- ✅ CSV files for spreadsheets
- ✅ SQLite database for history

## 🎯 Understanding Your Data

### PnL Display Format
```
+1,250,000 PLS ~$153.75
```
- **+**: Profit (- for loss)
- **1,250,000 PLS**: Amount in PLS tokens
- **~$153.75**: USD equivalent

### Token Analysis
Each token shows:
- Trade count and frequency
- Current holdings
- Average buy price vs current price
- Realized profits from sales
- Unrealized profits from current holdings
- Total return percentage
- Time held

## 🛠️ Troubleshooting

### Common Issues

#### "WALLET_ADDRESS is required"
- Run `npm run setup` again
- Enter a valid wallet address starting with 0x

#### "Cannot connect to PulseChain"
- Check internet connection
- The app will automatically try backup RPCs

#### "No trades found"
- Verify your wallet address is correct
- Ensure you've made trades on PulseChain in the last 3 weeks
- Check that transactions are confirmed on-chain

### Getting Help

1. Check the logs: `./logs/error.log`
2. Verify your `.env` file has correct wallet address
3. Ensure your wallet has trading activity on PulseChain

## 🔒 Security

- ✅ Only uses your public wallet address (read-only)
- ✅ No private keys required
- ✅ All data stored locally on your computer
- ✅ No sensitive information sent to external services

## 📈 Performance Tips

### For Better Accuracy
- Add Moralis API key during setup (free)
- Add CoinGecko API key during setup (free)
- Let it run continuously for best tracking

### For High-Volume Traders
- Monitor the `./logs/` directory for performance
- Consider increasing update interval if needed
- Regular database cleanup happens automatically

## 🔄 Updates and Maintenance

### Automatic Features
- Old reports cleaned up after 30 days
- Database optimized automatically
- Price data updated every 1.5 minutes
- Reports generated at scheduled times

### Manual Maintenance
```bash
# Check status
npm run status

# Generate report manually
npm run report

# Force data sync
npm run sync
```

## 📞 Support

This is a professional-grade tool designed for serious memecoin traders. All data is processed locally for maximum privacy and reliability.

### File Structure
```
pulsechain-pnl-tracker/
├── data/           # Your trading database
├── reports/        # Generated reports
├── logs/           # Application logs
├── .env            # Your configuration
└── README.md       # Full documentation
```

---

**Ready to track your PulseChain trading performance?**

Run `npm start` and let the tracker do the work for you!