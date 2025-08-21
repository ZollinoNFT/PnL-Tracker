# PulseChain Memecoin Trading PnL Tracker

A comprehensive, professional-grade JavaScript application for tracking profits and losses from memecoin trading on PulseChain. This tool provides real-time monitoring, detailed analytics, and automated reporting for your trading activities.

## Features

### Core Functionality
- **Real-time PnL Tracking**: Monitor profits/losses in PLS tokens with USD conversion
- **Automated Updates**: Updates every 1.5 minutes with latest price and transaction data
- **Trade Analysis**: Detailed breakdown of buy/sell transactions with profit calculations
- **Position Management**: Track current holdings, average prices, and unrealized gains/losses
- **Professional Dashboard**: Web-based interface with real-time updates via WebSocket

### Analytics & Reporting
- **Daily Reports**: Automated generation of daily trading summaries
- **Weekly Reports**: Comprehensive weekly performance analysis
- **Performance Metrics**: Win rate, profit factor, Sharpe ratio, max drawdown
- **Token Metadata**: Automatic fetching of token names, symbols, and launch dates
- **Trade Statistics**: Hold times, trade counts, and position sizing

### Technical Features
- **PulseChain Integration**: Native Web3 integration with PulseChain network
- **Multi-source Price Feeds**: Redundant price sources for reliability
- **Data Persistence**: Local caching and report storage
- **Professional UI**: Modern, responsive design with real-time updates
- **Error Handling**: Robust error handling and automatic recovery

## Installation & Setup (macOS)

### Prerequisites
- Node.js 18+ (Install from [nodejs.org](https://nodejs.org/) or use `brew install node`)
- Git (Install with `xcode-select --install` or `brew install git`)

### Installation Steps

1. **Clone/Download the Project**
   ```bash
   # If you have the files, navigate to the project directory
   cd /path/to/pulsechain-pnl-tracker
   
   # Or download and extract the files to a folder
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit the .env file with your settings
   nano .env  # or use any text editor
   ```

4. **Required Configuration**
   Edit the `.env` file and set:
   ```env
   # Your PulseChain wallet address (REQUIRED)
   WALLET_ADDRESS=0x1234567890123456789012345678901234567890
   
   # Optional: Custom RPC endpoint
   PULSECHAIN_RPC_URL=https://rpc.pulsechain.com
   
   # Optional: CoinGecko API key for better price data
   COINGECKO_API_KEY=your_api_key_here
   
   # Optional: Dashboard port (default: 3000)
   PORT=3000
   
   # Optional: Update interval in milliseconds (default: 90000 = 1.5 minutes)
   UPDATE_INTERVAL_MS=90000
   ```

5. **Start the Application**
   ```bash
   # Production mode
   npm start
   
   # Development mode (with auto-restart)
   npm run dev
   ```

6. **Access the Dashboard**
   Open your browser and navigate to: `http://localhost:3000`

## Usage

### Dashboard Interface

The web dashboard provides several sections:

#### Summary Cards
- **Total PnL**: Overall profit/loss across all positions
- **Realized PnL**: Profits/losses from completed trades
- **Unrealized PnL**: Current value of open positions
- **Trading Stats**: Active positions, total trades, and token count

#### Positions Tab
- View all current and closed positions
- Filter by active/closed, profitable/losing positions
- See hold times, trade counts, and performance metrics
- Real-time price updates for current holdings

#### Transactions Tab
- Recent trading activity with buy/sell indicators
- Token amounts, PLS values, and USD conversions
- Direct links to PulseChain block explorer
- Filterable by transaction count

#### Reports Tab
- Generate daily and weekly performance reports
- Detailed analytics including win rates and profit factors
- Export functionality for record keeping
- Historical performance tracking

#### Settings Tab
- System status and configuration
- Scheduler information and next update times
- Transaction and token statistics
- Manual update controls

### Automated Features

#### Continuous Monitoring
- Updates every 1.5 minutes automatically
- Fetches new transactions and price data
- Calculates real-time PnL for all positions
- Updates dashboard via WebSocket

#### Daily Reports (23:59 UTC)
- Comprehensive daily trading summary
- Day-specific PnL calculations
- New and closed position tracking
- Performance metrics and statistics

#### Weekly Reports (Sunday 23:59 UTC)
- Weekly performance overview
- Top/worst performing tokens
- Trading patterns and trends
- Volatility and risk metrics

### File Structure

```
pulsechain-pnl-tracker/
├── src/
│   ├── config/
│   │   └── constants.js          # Configuration constants
│   ├── utils/
│   │   └── web3Provider.js       # Web3 connection management
│   ├── services/
│   │   ├── priceService.js       # PLS price tracking
│   │   ├── transactionService.js # Transaction fetching & parsing
│   │   ├── pnlCalculator.js      # PnL calculation engine
│   │   ├── tokenMetadataService.js # Token information fetching
│   │   └── reportingService.js   # Report generation
│   ├── dashboard/
│   │   ├── server.js             # Web server & API
│   │   └── public/               # Frontend assets
│   ├── scheduler.js              # Automated task scheduling
│   └── index.js                  # Main application entry
├── reports/                      # Generated reports
├── data/                         # Cached data
├── logs/                         # Application logs
└── package.json                  # Dependencies & scripts
```

## API Endpoints

The dashboard server provides several API endpoints:

- `GET /api/status` - Current system status and summary
- `GET /api/pnl` - Complete PnL report
- `GET /api/positions` - All trading positions
- `GET /api/transactions?limit=50` - Recent transactions
- `GET /api/reports/daily` - Latest daily report
- `GET /api/reports/weekly` - Latest weekly report
- `POST /api/force-update` - Trigger manual update
- `POST /api/force-report` - Generate report manually

## Troubleshooting

### Common Issues

1. **"Invalid wallet address format"**
   - Ensure your wallet address in `.env` is a valid Ethereum address
   - Format: `0x` followed by 40 hexadecimal characters

2. **"Failed to connect to PulseChain"**
   - Check your internet connection
   - Verify the RPC URL in your `.env` file
   - Try using the default PulseChain RPC

3. **"No transactions found"**
   - Ensure you've made trades in the past 3 weeks
   - Check that your wallet address is correct
   - Wait for the initial sync to complete

4. **Dashboard not loading**
   - Check that port 3000 is not in use by another application
   - Try changing the PORT in your `.env` file
   - Check the console for error messages

### Logs and Debugging

- Application logs are displayed in the terminal
- Check the `logs/` directory for persistent logs
- Use `npm run dev` for detailed debugging output
- Monitor the browser console for frontend issues

## Performance Notes

- Initial sync may take several minutes depending on trading history
- The application is optimized for continuous operation
- Memory usage typically stays under 200MB
- Network usage is minimal (price updates and new transactions only)

## Security Considerations

- This application only reads from the blockchain (no private keys required)
- Your wallet address is the only sensitive information needed
- All data is stored locally on your machine
- No external services have access to your trading data

## Support

This is a professional-grade trading tool designed for serious traders. The application includes:

- Comprehensive error handling and recovery
- Automatic data backup and caching
- Professional reporting suitable for tax purposes
- Real-time monitoring with minimal resource usage

For best results, run this application continuously on a dedicated machine or server to ensure complete trade tracking and reporting.