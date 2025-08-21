# PulseChain PnL Tracker - macOS Setup Instructions

## Quick Setup Guide

### Step 1: Install Node.js
1. Visit [nodejs.org](https://nodejs.org/) and download the LTS version
2. Run the installer and follow the prompts
3. Verify installation by opening Terminal and running:
   ```bash
   node --version
   npm --version
   ```

### Step 2: Prepare the Project
1. Open Terminal
2. Navigate to where you want to install the tracker:
   ```bash
   cd ~/Desktop  # or wherever you want to put it
   ```
3. If you have the project files, navigate to that folder:
   ```bash
   cd pulsechain-pnl-tracker
   ```

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Configure Your Wallet
1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Edit the `.env` file:
   ```bash
   open .env  # Opens in default text editor
   ```
3. Replace `0x...` with your actual PulseChain wallet address:
   ```
   WALLET_ADDRESS=0xYourActualWalletAddressHere
   ```

### Step 5: Start the Tracker
```bash
npm start
```

### Step 6: Open Dashboard
1. Open your web browser
2. Go to: `http://localhost:3000`
3. You should see your PnL dashboard loading

## What You'll See

### Initial Startup
- The application will connect to PulseChain
- It will start loading your transaction history (past 3 weeks)
- Price data will begin updating
- The dashboard will show real-time data

### Dashboard Features
- **Summary Cards**: Total PnL, Realized/Unrealized gains
- **Positions Tab**: All your current and closed positions
- **Transactions Tab**: Recent trading activity
- **Reports Tab**: Generate daily/weekly reports
- **Settings Tab**: System status and configuration

### Automated Features
- Updates every 1.5 minutes automatically
- Generates daily reports at 11:59 PM UTC
- Generates weekly reports every Sunday at 11:59 PM UTC
- Tracks PLS price changes and converts to USD

## Important Notes

### What This Tracker Does
✅ **Tracks your trades** from the past 3 weeks and going forward  
✅ **Calculates PnL in PLS** with USD conversion  
✅ **Shows token metadata** (names, symbols, launch dates)  
✅ **Provides professional reports** for tax/record keeping  
✅ **Monitors positions** with hold times and trade counts  
✅ **Updates automatically** every 1.5 minutes  
✅ **Generates daily documents** with all stats  

### What You Need to Know
- **Only reads data** - no private keys or signing required
- **Tracks PulseChain only** - designed specifically for PulseChain DEX trades
- **Requires continuous running** for best results
- **All data stored locally** on your machine
- **Professional grade** - suitable for serious traders

### System Requirements
- **macOS 10.14+** (should work on older versions too)
- **4GB RAM minimum** (8GB recommended)
- **1GB free disk space** for reports and cache
- **Stable internet connection** for price updates

## Troubleshooting

### Common Issues

**"Command not found: npm"**
- Node.js isn't installed properly
- Restart Terminal after installing Node.js
- Try installing via Homebrew: `brew install node`

**"Invalid wallet address"**
- Make sure your address starts with `0x`
- Must be exactly 42 characters long
- Copy directly from your wallet app

**"No transactions found"**
- Make sure you've traded in the past 3 weeks
- Check that your wallet address is correct
- Wait a few minutes for initial sync

**Dashboard won't load**
- Check if port 3000 is already in use
- Try changing PORT=3001 in your .env file
- Make sure the application started without errors

**Price data not updating**
- Check your internet connection
- The app uses multiple price sources for reliability
- Some delay is normal during high network traffic

### Getting Help

1. **Check the Terminal output** for error messages
2. **Look at the dashboard Settings tab** for system status
3. **Try restarting** the application
4. **Check your .env file** for correct configuration

## Advanced Usage

### Running in Background
To keep the tracker running when you close Terminal:
```bash
nohup npm start > tracker.log 2>&1 &
```

### Development Mode
For debugging or development:
```bash
npm run dev
```

### Force Manual Updates
Use the "Force Update" button in the dashboard or:
```bash
# This would require adding CLI commands to the app
```

### Viewing Reports
- Reports are saved in the `reports/` folder
- Both JSON and human-readable text formats
- Daily reports: `reports/daily/`
- Weekly reports: `reports/weekly/`

## Security & Privacy

- **No private keys required** - only reads public blockchain data
- **All data stays on your machine** - nothing sent to external servers
- **Your wallet address** is the only sensitive info needed
- **Open source code** - you can review everything it does

## Performance Tips

- **Keep it running 24/7** for complete trade tracking
- **Close other heavy applications** if you notice slowdown
- **Check disk space** occasionally (reports can accumulate)
- **Restart weekly** to clear memory if needed

---

## Ready to Start Trading Analysis?

Once you have everything running:

1. **Monitor your dashboard** - bookmark `http://localhost:3000`
2. **Check daily reports** - generated automatically each night
3. **Review weekly summaries** - comprehensive performance analysis
4. **Track your progress** - all data is preserved and searchable

Your PnL tracker is now running professionally and will continue monitoring your PulseChain memecoin trades with institutional-grade precision and reporting.