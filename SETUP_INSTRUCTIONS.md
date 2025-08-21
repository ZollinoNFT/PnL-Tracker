# PulseChain PnL Tracker - macOS Setup Instructions

## Quick Start Guide

### Step 1: Install Node.js
1. Visit [nodejs.org](https://nodejs.org/)
2. Download the LTS version for macOS
3. Run the installer and follow the prompts
4. Verify installation:
   ```bash
   node --version
   npm --version
   ```

### Step 2: Download and Setup Project
1. Open Terminal (Applications > Utilities > Terminal)
2. Navigate to your desired directory:
   ```bash
   cd ~/Desktop  # or wherever you want the project
   ```
3. If you have the project files, navigate to the project directory:
   ```bash
   cd pulsechain-pnl-tracker
   ```

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Configure the Application
```bash
npm run setup
```

Follow the interactive setup prompts:
- Enter your PulseChain wallet address (0x...)
- Optionally add API keys for better performance
- Configure update intervals and tracking period

### Step 5: Start the Tracker
```bash
npm start
```

## Detailed Configuration

### Required Information
- **Wallet Address**: Your PulseChain wallet address (starts with 0x)
  - Example: `0x1234567890123456789012345678901234567890`
  - This is your public address, NOT your private key

### Optional API Keys (Recommended)

#### Moralis API Key (Free)
1. Go to [moralis.io](https://moralis.io/)
2. Click "Start for Free"
3. Create account and verify email
4. Go to "Web3 APIs" in dashboard
5. Copy your API key
6. Benefits: Faster data fetching, higher rate limits

#### CoinGecko API Key (Free)
1. Go to [coingecko.com/en/api](https://www.coingecko.com/en/api)
2. Click "Get Free API Key"
3. Create account and verify email
4. Copy your API key from dashboard
5. Benefits: More reliable price data, higher rate limits

## Running the Application

### Normal Operation
```bash
npm start
```

The application will:
- Start monitoring your wallet immediately
- Update prices every 1.5 minutes
- Generate daily reports at midnight
- Generate weekly reports every Sunday

### Development Mode
```bash
npm run dev
```
Uses nodemon for automatic restarts during development.

### Interactive Commands
While running, type these commands:

| Command | Description |
|---------|-------------|
| `status` | Show current PnL summary |
| `report` | Generate manual daily report |
| `weekly` | Generate manual weekly report |
| `sync` | Force data synchronization |
| `help` | Show available commands |
| `exit` | Stop the application |

## Understanding the Output

### Console Display
```
PULSECHAIN PNL TRACKER - CURRENT STATUS
========================================
Wallet: 0x1234...
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

### Report Files
Reports are saved in the `./reports/` directory:

#### Daily Reports
- **Text**: `./reports/daily/report_2024-01-15.txt`
- **JSON**: `./reports/daily/report_2024-01-15.json`
- **CSV**: `./reports/csv/trades_2024-01-15.csv`

#### Weekly Reports
- **Text**: `./reports/weekly/weekly_report_2024-01-08_to_2024-01-14.txt`
- **JSON**: `./reports/weekly/weekly_report_2024-01-08_to_2024-01-14.json`

## Automation Setup (Optional)

### Running as Background Service
To run the tracker continuously in the background:

1. Create a launch agent plist file:
   ```bash
   nano ~/Library/LaunchAgents/com.pnltracker.plist
   ```

2. Add this content (replace `/path/to/project` with your actual path):
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>Label</key>
       <string>com.pnltracker</string>
       <key>ProgramArguments</key>
       <array>
           <string>/usr/local/bin/node</string>
           <string>/path/to/project/src/index.js</string>
       </array>
       <key>WorkingDirectory</key>
       <string>/path/to/project</string>
       <key>RunAtLoad</key>
       <true/>
       <key>KeepAlive</key>
       <true/>
   </dict>
   </plist>
   ```

3. Load the service:
   ```bash
   launchctl load ~/Library/LaunchAgents/com.pnltracker.plist
   ```

### Manual Startup on Boot
Add to your shell profile (`~/.zshrc` or `~/.bash_profile`):
```bash
# Auto-start PnL Tracker (optional)
# cd /path/to/pulsechain-pnl-tracker && npm start &
```

## File Locations

### Configuration
- **Main config**: `.env`
- **Constants**: `config/constants.js`

### Data Storage
- **Database**: `./data/trading_data.db`
- **Logs**: `./logs/combined.log`, `./logs/error.log`

### Reports
- **Daily**: `./reports/daily/`
- **Weekly**: `./reports/weekly/`
- **CSV Data**: `./reports/csv/`

## Monitoring Your Tracker

### Check if Running
```bash
ps aux | grep "node.*index.js"
```

### View Live Logs
```bash
tail -f logs/combined.log
```

### Check Database Size
```bash
ls -lh data/trading_data.db
```

## Troubleshooting

### Installation Issues
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Permission Issues
```bash
# Fix permissions
chmod +x scripts/setup.js
chmod -R 755 data/ reports/ logs/
```

### Network Issues
- Check internet connection
- Verify PulseChain RPC endpoints are accessible
- Consider using VPN if RPC access is blocked

### Performance Issues
- Monitor CPU usage: Activity Monitor > CPU tab
- Check available disk space
- Review log files for errors

## Updating the Application

### Manual Update
1. Stop the current tracker (Ctrl+C or `exit` command)
2. Backup your data directory:
   ```bash
   cp -r data/ data_backup/
   ```
3. Update application files
4. Restart: `npm start`

### Database Migration
If database schema changes are needed, backup first:
```bash
cp data/trading_data.db data/trading_data_backup.db
```

## Security Best Practices

1. **Never share your .env file**
2. **Keep API keys secure**
3. **Only enter your public wallet address** (never private keys)
4. **Regular backups of data directory**
5. **Monitor logs for suspicious activity**

## Support and Maintenance

### Regular Maintenance
- **Weekly**: Review generated reports for accuracy
- **Monthly**: Check log files and clean up if needed
- **Quarterly**: Backup data directory

### Performance Monitoring
- Monitor CPU usage (should be minimal)
- Check network usage (API calls every 1.5 minutes)
- Review error logs for any recurring issues

### Data Backup
```bash
# Backup all data
tar -czf pnl_backup_$(date +%Y%m%d).tar.gz data/ reports/

# Backup just database
cp data/trading_data.db backups/trading_data_$(date +%Y%m%d).db
```

## Advanced Usage

### Custom Report Generation
```javascript
// Generate custom date range report
const tracker = require('./src/index.js');
// Use tracker methods for custom analysis
```

### API Integration
The tracker can be extended to integrate with:
- Portfolio management tools
- Tax reporting software
- Trading bots
- Custom dashboards

## Technical Specifications

- **Language**: Node.js (JavaScript)
- **Database**: SQLite3
- **Blockchain**: PulseChain (EVM-compatible)
- **APIs**: PulseChain RPC, Moralis, CoinGecko, DexScreener
- **Scheduling**: node-cron
- **Logging**: Winston
- **Reports**: CSV, JSON, Text formats

## License

MIT License - See LICENSE file for details.