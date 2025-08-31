# PulseChain Memecoin PNL Tracker 📈

A professional-grade Profit and Loss tracking system for memecoin trading on the PulseChain network. Track your gains, analyze token performance, and monitor your portfolio in real-time.

## 🚀 Quick Start Guide for Mac

### Prerequisites
- macOS (any recent version)
- Node.js v16+ (already installed)
- A PulseChain wallet address
- Internet connection

### 📋 Step-by-Step Setup Instructions

#### 1. **Configure Your Wallet Address**

Open the `.env` file and add your PulseChain wallet address:

```bash
# Open the .env file in your text editor
nano .env

# Or use any text editor you prefer:
open -e .env  # Opens in TextEdit
```

Find this line and replace it with your actual wallet address:
```
WALLET_ADDRESS=0x_YOUR_WALLET_ADDRESS_HERE
```

Example:
```
WALLET_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4
```

#### 2. **Install Dependencies** (Already Done!)

The dependencies are already installed, but if you need to reinstall:
```bash
npm install
```

#### 3. **Run the Tracker**

Start the PNL tracker:
```bash
npm start
```

That's it! The tracker will start and update every 3 minutes.

## 📊 Features

- **Real-time PNL Tracking**: Updates every 3 minutes with latest prices
- **Per-Token Analytics**: Detailed breakdown for each memecoin
- **Transaction History**: Complete buy/sell history
- **Multi-timeframe Analysis**: Daily, weekly, and monthly summaries
- **Blacklist Support**: Exclude specific tokens from tracking
- **USD Conversion**: Shows values in both PLS and USD

## ⚙️ Configuration Options

Edit the `.env` file to customize:

| Setting | Description | Example |
|---------|-------------|---------|
| `WALLET_ADDRESS` | Your PulseChain wallet address | `0x742d35...` |
| `UPDATE_INTERVAL` | Update frequency in minutes | `3` |
| `BLACKLISTED_TOKENS` | Comma-separated token addresses to exclude | `0xtoken1,0xtoken2` |
| `TRACKING_START_DATE` | Start date for tracking | `2025-08-01` |
| `DISPLAY_CURRENCY` | Display currency | `USD`, `EUR`, `GBP` |
| `DEBUG_MODE` | Enable debug logging | `true` or `false` |

## 🖥️ Sample Output

```
═══════════════════════════════════════════════════════════════════════
  PULSECHAIN MEMECOIN PNL TRACKER
═══════════════════════════════════════════════════════════════════════

📊 TOTAL PNL SUMMARY
────────────────────────────────────────────────────────────────────────
Total PNL: +12,289,000 PLS (~$521.16 USD)
Current PLS Price: $0.000042

Realized PNL: +8,500,000 PLS (~$357.00 USD)
Unrealized PNL: +3,789,000 PLS (~$164.16 USD)
Tokens Tracked: 15

📈 TIME-BASED PNL
────────────────────────────────────────────────────────────────────────
Daily: +500,000 PLS (~$21.00) | Transactions: 5
Weekly: +2,100,000 PLS (~$88.20) | Transactions: 23
Monthly: +12,289,000 PLS (~$521.16) | Transactions: 87

💰 PER-TOKEN ANALYTICS
────────────────────────────────────────────────────────────────────────
PEPE2.0 (PEPE2)
Address: 0x1234...

Transactions: 5 buys, 3 sells
Total Bought: 1,000,000.00 PEPE2
Total Sold: 600,000.00 PEPE2
Current Balance: 400,000.00 PEPE2

Avg Buy Price: 0.000012 PLS
Avg Sell Price: 0.000018 PLS

Realized PNL: +3,600,000 PLS (~$151.20)
Unrealized PNL: +1,200,000 PLS (~$50.40)
Total PNL: +4,800,000 PLS (~$201.60)

Avg Holding Time: 15 days
```

## 🔧 Troubleshooting

### Common Issues and Solutions

**Issue: "Wallet address is not configured"**
- Solution: Make sure you've added your wallet address to the `.env` file

**Issue: "No token transfers found"**
- Solution: Check that your wallet address is correct and has transaction history
- Try adjusting the `TRACKING_START_DATE` to an earlier date

**Issue: "API rate limit exceeded"**
- Solution: The script handles rate limits automatically, but you can increase `UPDATE_INTERVAL` if needed

**Issue: Script stops unexpectedly**
- Solution: Check the log files in `./logs/` for error details
- Ensure stable internet connection

## 📝 How to Use Blacklist Feature

To exclude specific tokens from tracking:

1. Open the `.env` file
2. Add token addresses to `BLACKLISTED_TOKENS`:
```
BLACKLISTED_TOKENS=0x123abc...,0x456def...,0x789ghi...
```

## 🛑 Stopping the Tracker

To stop the tracker gracefully:
- Press `Ctrl + C` in the terminal
- The tracker will save current state and exit cleanly

## 📁 Project Structure

```
pulsechain-pnl-tracker/
├── index.js                 # Main entry point
├── package.json            # Dependencies
├── .env                    # Your configuration (don't share!)
├── .env.example           # Example configuration
├── README.md              # This file
├── logs/                  # Log files (created automatically)
└── src/
    ├── api/              # API client modules
    │   ├── moralisClient.js
    │   ├── coingeckoClient.js
    │   └── pulsechainRPC.js
    ├── config/           # Configuration
    │   └── config.js
    ├── services/         # Core services
    │   ├── pnlCalculator.js
    │   └── tokenAnalytics.js
    └── utils/            # Utilities
        ├── logger.js
        └── displayFormatter.js
```

## 🔒 Security Notes

- **Never share your `.env` file** - it contains your API keys
- The script only needs your public wallet address (read-only access)
- No private keys are required or stored
- API keys are already configured but keep them private

## 📊 Understanding the Analytics

### Realized vs Unrealized PNL
- **Realized PNL**: Actual profit/loss from tokens you've sold
- **Unrealized PNL**: Potential profit/loss if you sold your current holdings

### FIFO Calculation Method
The script uses First-In-First-Out (FIFO) method for calculating profits:
- When you sell, it matches against your oldest purchases first
- This provides accurate tax-compliant PNL calculations

### Average Holding Time
Shows how long you typically hold tokens before selling, helping identify your trading patterns.

## 🆘 Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Review log files in `./logs/` directory
3. Ensure all dependencies are installed: `npm install`
4. Verify your wallet address is correct in `.env`

## 📈 Tips for Best Results

1. **Regular Updates**: Keep the tracker running for continuous monitoring
2. **Blacklist Scams**: Add known scam tokens to blacklist immediately
3. **Monitor Logs**: Check `./logs/` periodically for any warnings
4. **Stable Connection**: Ensure stable internet for accurate real-time data
5. **Historical Data**: Set `TRACKING_START_DATE` to when you started trading

## ⚡ Performance Notes

- Handles hundreds of tokens efficiently
- Batches API requests to avoid rate limits
- Caches token metadata to reduce API calls
- Updates every 3 minutes (configurable)

---

**Ready to track your gains? Just add your wallet address and run `npm start`!** 🚀