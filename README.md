# PulseChain PnL Tracker

A comprehensive, professional-grade profit and loss tracker for memecoin trading on PulseChain. This application monitors your wallet transactions, calculates PnL in PLS tokens with USD conversions, and generates detailed reports.

## Features

### Core Functionality
- **Real-time PnL Tracking**: Monitors profits and losses in PLS tokens with USD conversion
- **Comprehensive Trade Analysis**: Tracks trade count, hold time, realized/unrealized gains per token
- **Automated Reporting**: Generates daily and weekly reports with detailed statistics
- **Price Monitoring**: Updates PLS and token prices every 1.5 minutes
- **Historical Data**: Maintains complete trading history and performance metrics

### Key Metrics Tracked
- Total PnL (realized + unrealized) in PLS and USD
- Per-token analysis with trade frequency and hold times
- Current holdings with up-to-date valuations
- Daily and weekly PnL performance
- Weekly average PnL calculations
- Realized vs unrealized percentage returns

### Professional Features
- SQLite database for reliable data persistence
- Comprehensive logging system
- Automatic report generation and cleanup
- CLI interface for manual operations
- Graceful error handling and RPC failover
- Rate limiting for API calls

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **macOS**: Optimized for macOS environment
- **PulseChain Wallet**: Valid wallet address for tracking

## Installation

### 1. Clone or Download the Project
```bash
# If you have the files, navigate to the project directory
cd pulsechain-pnl-tracker
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Setup Script
```bash
npm run setup
```

The setup script will guide you through:
- Entering your PulseChain wallet address
- Configuring optional API keys for better performance
- Setting update intervals and tracking periods
- Creating necessary directories and configuration files

### 4. Start the Tracker
```bash
npm start
```

## Configuration

### Environment Variables (.env)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `WALLET_ADDRESS` | Your PulseChain wallet address | Yes | - |
| `PULSECHAIN_RPC_URL` | Primary RPC endpoint | No | https://pulsechain-rpc.publicnode.com |
| `MORALIS_API_KEY` | Moralis API key for enhanced data | No | - |
| `COINGECKO_API_KEY` | CoinGecko API key for better rate limits | No | - |
| `UPDATE_INTERVAL` | Update frequency in minutes | No | 1.5 |
| `TRACKING_START_DATE` | Start date for tracking (YYYY-MM-DD) | No | 21 days ago |
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | No | info |

### API Keys (Optional but Recommended)

#### Moralis API Key
1. Visit [Moralis.io](https://moralis.io/)
2. Create a free account
3. Get your API key from the dashboard
4. Add to `.env`: `MORALIS_API_KEY=your_key_here`

#### CoinGecko API Key
1. Visit [CoinGecko API](https://www.coingecko.com/en/api)
2. Sign up for a free account
3. Get your API key
4. Add to `.env`: `COINGECKO_API_KEY=your_key_here`

## Usage

### Starting the Application
```bash
npm start
```

### Interactive Commands
While the tracker is running, you can use these commands:

- `status` - Display current PnL summary
- `report` - Generate manual daily report
- `weekly` - Generate manual weekly report
- `sync` - Perform manual data synchronization
- `help` - Show available commands
- `exit` - Stop the tracker gracefully

### Development Mode
```bash
npm run dev
```
Uses nodemon for automatic restarts during development.

## Reports

### Daily Reports
Generated automatically at midnight and include:
- Portfolio summary with total PnL
- All trades for the day
- Token-by-token analysis
- Performance metrics

**File Locations:**
- Text format: `./reports/daily/report_YYYY-MM-DD.txt`
- JSON format: `./reports/daily/report_YYYY-MM-DD.json`
- CSV format: `./reports/csv/trades_YYYY-MM-DD.csv` and `./reports/csv/tokens_YYYY-MM-DD.csv`

### Weekly Reports
Generated every Sunday at 1 AM and include:
- Weekly performance summary
- Daily breakdown for the week
- Top performing tokens
- Comprehensive statistics

**File Locations:**
- Text format: `./reports/weekly/weekly_report_YYYY-MM-DD_to_YYYY-MM-DD.txt`
- JSON format: `./reports/weekly/weekly_report_YYYY-MM-DD_to_YYYY-MM-DD.json`

## Data Storage

### Database Schema
The application uses SQLite with the following tables:
- `transactions` - Raw transaction data
- `tokens` - Token metadata and information
- `trades` - Processed trading data
- `holdings` - Current position tracking
- `price_history` - Historical price data
- `daily_reports` - Report summaries

### File Structure
```
pulsechain-pnl-tracker/
├── src/
│   ├── blockchain/         # Blockchain interaction
│   ├── database/          # Database management
│   ├── services/          # Core business logic
│   └── utils/             # Utility functions
├── config/                # Configuration files
├── scripts/               # Setup and utility scripts
├── data/                  # Database files
├── reports/               # Generated reports
├── logs/                  # Application logs
└── README.md
```

## Monitoring and Maintenance

### Logs
Application logs are stored in the `./logs/` directory:
- `combined.log` - All log entries
- `error.log` - Error-level logs only

### Automatic Cleanup
- Old reports are automatically cleaned up (30-day retention)
- Log rotation is handled by Winston
- Database is optimized with proper indexing

### Performance Monitoring
The application includes:
- RPC endpoint failover for reliability
- Rate limiting for API calls
- Memory-efficient data processing
- Comprehensive error handling

## Troubleshooting

### Common Issues

#### "Cannot connect to PulseChain RPC"
- Check your internet connection
- Verify RPC endpoints are accessible
- The application will automatically try backup RPCs

#### "API rate limit exceeded"
- Add API keys to `.env` for higher rate limits
- Reduce update frequency if needed

#### "Database locked"
- Ensure only one instance is running
- Check file permissions in the `data/` directory

#### "No trades found"
- Verify wallet address is correct
- Check if trades occurred within the tracking period
- Ensure transactions are on PulseChain mainnet

### Support
For issues or questions:
1. Check the logs in `./logs/error.log`
2. Verify your configuration in `.env`
3. Ensure your wallet has trading activity on PulseChain

## Security Notes

- Never commit your `.env` file to version control
- Your wallet address is read-only (no private keys required)
- API keys should be kept secure and not shared
- The application only reads blockchain data, never writes

## Performance Optimization

### For High-Volume Traders
- Consider using Moralis API key for faster data access
- Increase database cache size if needed
- Monitor log files for performance bottlenecks

### For Better Accuracy
- Use multiple price sources (enabled by default)
- Verify token contract addresses are correct
- Check for wrapped token conversions

## License

MIT License - See LICENSE file for details.

## Disclaimer

This software is for informational purposes only. Always verify trading data independently. The developers are not responsible for any financial decisions made based on this tool's output.