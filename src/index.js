require('dotenv').config();
const cron = require('node-cron');
const moment = require('moment');

const Database = require('./database/database');
const WalletTracker = require('./services/walletTracker');
const PriceTracker = require('./services/priceTracker');
const PnLCalculator = require('./services/pnlCalculator');
const ReportGenerator = require('./services/reportGenerator');
const logger = require('./utils/logger');
const config = require('../config/constants');

class PulseChainPnLTracker {
  constructor() {
    this.walletAddress = process.env.WALLET_ADDRESS;
    this.isRunning = false;
    this.lastUpdate = null;
    
    if (!this.walletAddress) {
      throw new Error('WALLET_ADDRESS environment variable is required');
    }

    // Initialize services
    this.db = new Database(process.env.DB_PATH || config.PATHS.DATABASE);
    this.walletTracker = new WalletTracker(this.walletAddress, this.db);
    this.priceTracker = new PriceTracker(this.db);
    this.pnlCalculator = new PnLCalculator(this.db, this.priceTracker);
    this.reportGenerator = new ReportGenerator(this.db, this.pnlCalculator, this.priceTracker);
  }

  async initialize() {
    try {
      logger.info('Initializing PulseChain PnL Tracker');
      logger.info(`Tracking wallet: ${this.walletAddress}`);
      
      // Perform initial data sync
      await this.performFullSync();
      
      // Schedule regular updates
      this.scheduleUpdates();
      
      // Schedule daily reports
      this.scheduleDailyReports();
      
      // Schedule weekly reports
      this.scheduleWeeklyReports();
      
      logger.info('PulseChain PnL Tracker initialized successfully');
      
      // Display initial summary
      await this.displayCurrentSummary();
      
    } catch (error) {
      logger.error('Error initializing tracker:', error.message);
      throw error;
    }
  }

  async performFullSync() {
    try {
      logger.info('Performing full data synchronization');
      
      // Sync wallet transactions
      await this.walletTracker.syncTransactions();
      
      // Update all prices
      await this.priceTracker.updateAllPrices();
      
      this.lastUpdate = moment();
      logger.info('Full synchronization completed');
    } catch (error) {
      logger.error('Error during full sync:', error.message);
      throw error;
    }
  }

  async performRegularUpdate() {
    if (this.isRunning) {
      logger.warn('Update already in progress, skipping');
      return;
    }

    try {
      this.isRunning = true;
      logger.info('Performing regular update');

      // Sync new transactions
      await this.walletTracker.syncTransactions();
      
      // Update prices
      await this.priceTracker.updateAllPrices();
      
      this.lastUpdate = moment();
      logger.info('Regular update completed');
      
    } catch (error) {
      logger.error('Error during regular update:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  scheduleUpdates() {
    // Update every 1.5 minutes
    const updateInterval = config.TRADING.UPDATE_INTERVAL_MINUTES;
    const cronExpression = `*/${Math.floor(updateInterval)} * * * *`;
    
    cron.schedule(cronExpression, async () => {
      await this.performRegularUpdate();
    });
    
    logger.info(`Scheduled regular updates every ${updateInterval} minutes`);
  }

  scheduleDailyReports() {
    // Generate daily report at midnight
    cron.schedule('0 0 * * *', async () => {
      try {
        logger.info('Generating scheduled daily report');
        const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
        await this.reportGenerator.generateDailyReport(yesterday);
        
        // Clean up old reports (keep 30 days)
        await this.reportGenerator.cleanupOldReports(30);
        
      } catch (error) {
        logger.error('Error generating scheduled daily report:', error.message);
      }
    });
    
    logger.info('Scheduled daily reports at midnight');
  }

  scheduleWeeklyReports() {
    // Generate weekly report every Sunday at 1 AM
    cron.schedule('0 1 * * 0', async () => {
      try {
        logger.info('Generating scheduled weekly report');
        await this.reportGenerator.generateWeeklyReport();
      } catch (error) {
        logger.error('Error generating scheduled weekly report:', error.message);
      }
    });
    
    logger.info('Scheduled weekly reports every Sunday at 1 AM');
  }

  async displayCurrentSummary() {
    try {
      const summary = await this.pnlCalculator.getPortfolioSummary();
      
      console.log('\\n' + '='.repeat(60));
      console.log('PULSECHAIN PNL TRACKER - CURRENT STATUS');
      console.log('='.repeat(60));
      console.log(`Wallet: ${this.walletAddress}`);
      console.log(`Last Updated: ${this.lastUpdate ? this.lastUpdate.format('YYYY-MM-DD HH:mm:ss') : 'Never'}`);
      console.log(`PLS Price: $${summary.plsPrice.toFixed(6)}`);
      console.log('');
      console.log('PORTFOLIO SUMMARY:');
      console.log(`Total PnL: ${summary.totalPnL.display}`);
      console.log(`Realized PnL: ${summary.realizedPnL.display}`);
      console.log(`Unrealized PnL: ${summary.unrealizedPnL.display}`);
      console.log(`Daily PnL: ${summary.dailyPnL.display}`);
      console.log(`Weekly PnL: ${summary.weeklyPnL.display}`);
      console.log(`Weekly Average: ${summary.weeklyAverage.display}`);
      console.log(`Active Positions: ${summary.activePositions}`);
      console.log(`Total Trades: ${summary.totalTrades}`);
      console.log('='.repeat(60));
      
      if (summary.tokens.length > 0) {
        console.log('\\nTOP HOLDINGS:');
        console.log('-'.repeat(60));
        
        // Show top 5 holdings by value
        const topHoldings = summary.tokens
          .sort((a, b) => parseFloat(b.totalPnlUsd) - parseFloat(a.totalPnlUsd))
          .slice(0, 5);
          
        for (const token of topHoldings) {
          console.log(`${token.symbol}: ${token.totalPnlDisplay} (${token.totalPercentage}%)`);
          console.log(`  Balance: ${token.currentBalance} | Trades: ${token.tradeCount} | Hold: ${token.holdTime}`);
        }
      }
      
      console.log('\\n');
    } catch (error) {
      logger.error('Error displaying current summary:', error.message);
    }
  }

  async generateManualReport(type = 'daily', date = null) {
    try {
      if (type === 'daily') {
        const reportDate = date || moment().format('YYYY-MM-DD');
        return await this.reportGenerator.generateDailyReport(reportDate);
      } else if (type === 'weekly') {
        return await this.reportGenerator.generateWeeklyReport();
      } else {
        throw new Error('Invalid report type. Use "daily" or "weekly"');
      }
    } catch (error) {
      logger.error('Error generating manual report:', error.message);
      throw error;
    }
  }

  async getQuickStatus() {
    try {
      const summary = await this.pnlCalculator.getPortfolioSummary();
      return {
        totalPnL: summary.totalPnL.display,
        dailyPnL: summary.dailyPnL.display,
        activePositions: summary.activePositions,
        totalTrades: summary.totalTrades,
        plsPrice: `$${summary.plsPrice.toFixed(6)}`,
        lastUpdated: this.lastUpdate ? this.lastUpdate.format('YYYY-MM-DD HH:mm:ss') : 'Never'
      };
    } catch (error) {
      logger.error('Error getting quick status:', error.message);
      return null;
    }
  }

  async shutdown() {
    try {
      logger.info('Shutting down PnL Tracker');
      
      // Generate final report
      await this.reportGenerator.generateDailyReport();
      
      // Close database connection
      this.db.close();
      
      logger.info('PnL Tracker shutdown completed');
    } catch (error) {
      logger.error('Error during shutdown:', error.message);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\\nReceived SIGINT, shutting down gracefully...');
  if (global.tracker) {
    await global.tracker.shutdown();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\\nReceived SIGTERM, shutting down gracefully...');
  if (global.tracker) {
    await global.tracker.shutdown();
  }
  process.exit(0);
});

// Main execution
async function main() {
  try {
    const tracker = new PulseChainPnLTracker();
    global.tracker = tracker;
    
    await tracker.initialize();
    
    // Keep the process running
    console.log('\\nPnL Tracker is now running. Press Ctrl+C to stop.');
    console.log('Updates every 1.5 minutes | Daily reports at midnight | Weekly reports on Sundays');
    
    // Set up CLI commands
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', async () => {
      const chunk = process.stdin.read();
      if (chunk !== null) {
        const command = chunk.trim().toLowerCase();
        
        switch (command) {
          case 'status':
            const status = await tracker.getQuickStatus();
            if (status) {
              console.log('\\nCURRENT STATUS:');
              console.log(`Total PnL: ${status.totalPnL}`);
              console.log(`Daily PnL: ${status.dailyPnL}`);
              console.log(`Active Positions: ${status.activePositions}`);
              console.log(`PLS Price: ${status.plsPrice}`);
              console.log(`Last Updated: ${status.lastUpdated}\\n`);
            }
            break;
            
          case 'report':
            console.log('Generating manual daily report...');
            await tracker.generateManualReport('daily');
            console.log('Daily report generated successfully\\n');
            break;
            
          case 'weekly':
            console.log('Generating manual weekly report...');
            await tracker.generateManualReport('weekly');
            console.log('Weekly report generated successfully\\n');
            break;
            
          case 'sync':
            console.log('Performing manual sync...');
            await tracker.performFullSync();
            console.log('Manual sync completed\\n');
            break;
            
          case 'help':
            console.log('\\nAvailable commands:');
            console.log('  status  - Show current PnL status');
            console.log('  report  - Generate daily report');
            console.log('  weekly  - Generate weekly report');
            console.log('  sync    - Perform manual sync');
            console.log('  help    - Show this help message');
            console.log('  exit    - Exit the application\\n');
            break;
            
          case 'exit':
            await tracker.shutdown();
            process.exit(0);
            break;
            
          default:
            if (command) {
              console.log(`Unknown command: ${command}. Type 'help' for available commands.\\n`);
            }
        }
      }
    });
    
  } catch (error) {
    logger.error('Fatal error in main:', error.message);
    process.exit(1);
  }
}

// Export for testing
module.exports = PulseChainPnLTracker;

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error:', error.message);
    process.exit(1);
  });
}