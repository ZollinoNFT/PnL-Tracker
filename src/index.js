#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import services
import web3Provider from './utils/web3Provider.js';
import priceService from './services/priceService.js';
import transactionService from './services/transactionService.js';
import tokenMetadataService from './services/tokenMetadataService.js';
import scheduler from './scheduler.js';
import DashboardServer from './dashboard/server.js';

class PnLTracker {
  constructor() {
    this.isInitialized = false;
    this.dashboardServer = null;
  }

  async init() {
    try {
      console.log(chalk.cyan('\n🚀 PulseChain Memecoin Trading PnL Tracker'));
      console.log(chalk.cyan('==========================================\n'));

      // Validate required environment variables
      this.validateEnvironment();

      // Initialize Web3 provider
      console.log(chalk.yellow('📡 Connecting to PulseChain...'));
      await web3Provider.init();

      // Initialize price service
      console.log(chalk.yellow('💰 Initializing price tracking...'));
      await priceService.init();

      // Initialize transaction service
      console.log(chalk.yellow('📊 Loading transaction history...'));
      await transactionService.init(process.env.WALLET_ADDRESS);

      // Initialize token metadata service
      console.log(chalk.yellow('🏷️  Loading token metadata cache...'));
      await tokenMetadataService.loadCache();

      // Start scheduler
      console.log(chalk.yellow('⏰ Starting automated scheduler...'));
      await scheduler.init();

      // Start dashboard server
      console.log(chalk.yellow('🌐 Starting web dashboard...'));
      this.dashboardServer = new DashboardServer();
      this.dashboardServer.start();

      this.isInitialized = true;
      
      console.log(chalk.green('\n✅ PnL Tracker initialized successfully!'));
      console.log(chalk.green('📈 Monitoring your trades every 1.5 minutes'));
      console.log(chalk.green('📊 Dashboard available at http://localhost:3000\n'));

      // Display initial status
      await this.displayInitialStatus();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      console.error(chalk.red('\n❌ Failed to initialize PnL Tracker:'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  }

  validateEnvironment() {
    const required = ['WALLET_ADDRESS'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}\nPlease copy .env.example to .env and fill in the required values.`);
    }

    // Validate wallet address format
    const walletAddress = process.env.WALLET_ADDRESS;
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new Error('Invalid wallet address format. Please provide a valid Ethereum address.');
    }

    console.log(chalk.green('✅ Environment validation passed'));
    console.log(chalk.blue(`📍 Tracking wallet: ${walletAddress}`));
  }

  async displayInitialStatus() {
    try {
      const plsPrice = priceService.getCurrentPLSPrice();
      const transactionCount = transactionService.getTransactionCount();
      const tokenCount = transactionService.getAllTokens().length;

      console.log(chalk.cyan('\n📊 INITIAL STATUS'));
      console.log(chalk.cyan('=================='));
      console.log(chalk.white(`💎 PLS Price: ${priceService.formatUSDAmount(plsPrice)}`));
      console.log(chalk.white(`📈 Transactions Loaded: ${transactionCount}`));
      console.log(chalk.white(`🪙 Unique Tokens: ${tokenCount}`));
      
      if (transactionCount > 0) {
        const latestTx = transactionService.getLatestTransactions(1)[0];
        if (latestTx) {
          console.log(chalk.white(`🕒 Latest Trade: ${new Date(latestTx.timestamp).toLocaleString()}`));
        }
      }

      console.log(chalk.cyan('==================\n'));

    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not display initial status:', error.message));
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(chalk.yellow(`\n📴 Received ${signal}. Shutting down gracefully...`));
      
      try {
        // Save metadata cache
        await tokenMetadataService.saveCache();
        
        // Stop dashboard server
        if (this.dashboardServer) {
          this.dashboardServer.stop();
        }
        
        // Stop scheduler
        scheduler.stop();
        
        console.log(chalk.green('✅ Shutdown complete'));
        process.exit(0);
      } catch (error) {
        console.error(chalk.red('❌ Error during shutdown:', error.message));
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error(chalk.red('\n💥 Uncaught Exception:'), error);
      shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error(chalk.red('\n💥 Unhandled Rejection at:'), promise, 'reason:', reason);
      shutdown('UNHANDLED_REJECTION');
    });
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      web3Connected: web3Provider.isConnected,
      plsPrice: priceService.getCurrentPLSPrice(),
      transactionCount: transactionService.getTransactionCount(),
      tokenCount: transactionService.getAllTokens().length,
      schedulerStatus: scheduler.getStatus()
    };
  }
}

// Create and start the tracker
const tracker = new PnLTracker();

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
PulseChain Memecoin Trading PnL Tracker

Usage: npm start [options]

Options:
  --help, -h     Show this help message
  --version, -v  Show version information

Environment Variables (set in .env file):
  WALLET_ADDRESS          Your PulseChain wallet address (required)
  PULSECHAIN_RPC_URL      PulseChain RPC endpoint (optional)
  COINGECKO_API_KEY       CoinGecko API key (optional)
  PORT                    Dashboard server port (default: 3000)
  UPDATE_INTERVAL_MS      Update interval in milliseconds (default: 90000)

Examples:
  npm start                    # Start the tracker
  npm run dev                  # Start with nodemon for development

Dashboard: http://localhost:3000
  `);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  const packageJson = await import('../package.json', { assert: { type: 'json' } });
  console.log(`PnL Tracker v${packageJson.default.version}`);
  process.exit(0);
}

// Start the application
tracker.init().catch(error => {
  console.error(chalk.red('Failed to start PnL Tracker:'), error);
  process.exit(1);
});

export default tracker;