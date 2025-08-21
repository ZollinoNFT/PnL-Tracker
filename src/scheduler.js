import cron from 'node-cron';
import moment from 'moment';
import transactionService from './services/transactionService.js';
import priceService from './services/priceService.js';
import pnlCalculator from './services/pnlCalculator.js';
import reportingService from './services/reportingService.js';
import tokenMetadataService from './services/tokenMetadataService.js';

class Scheduler {
  constructor() {
    this.isRunning = false;
    this.lastUpdate = null;
    this.updateInterval = parseInt(process.env.UPDATE_INTERVAL_MS) || 90000; // 1.5 minutes
  }

  async init() {
    console.log('Initializing scheduler...');
    
    // Start continuous updates every 1.5 minutes
    this.startContinuousUpdates();
    
    // Schedule daily report generation at 23:59 every day
    cron.schedule('59 23 * * *', async () => {
      await this.generateDailyReport();
    }, {
      timezone: 'UTC'
    });
    
    // Schedule weekly report generation at 23:59 every Sunday
    cron.schedule('59 23 * * 0', async () => {
      await this.generateWeeklyReport();
    }, {
      timezone: 'UTC'
    });
    
    // Schedule metadata cache update every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      await this.updateMetadataCache();
    }, {
      timezone: 'UTC'
    });
    
    console.log('Scheduler initialized with the following schedules:');
    console.log('- Continuous updates: Every 1.5 minutes');
    console.log('- Daily reports: 23:59 UTC every day');
    console.log('- Weekly reports: 23:59 UTC every Sunday');
    console.log('- Metadata updates: Every 6 hours');
  }

  startContinuousUpdates() {
    // Initial update
    this.performUpdate();
    
    // Set up interval for continuous updates
    setInterval(async () => {
      await this.performUpdate();
    }, this.updateInterval);
  }

  async performUpdate() {
    if (this.isRunning) {
      console.log('Update already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log(`\n=== UPDATE CYCLE STARTED: ${moment().format('YYYY-MM-DD HH:mm:ss')} ===`);
      
      // Update PLS price
      await this.updatePLSPrice();
      
      // Update transactions
      await this.updateTransactions();
      
      // Calculate PnL
      const pnlReport = await this.calculatePnL();
      
      // Log current status
      this.logCurrentStatus(pnlReport);
      
      this.lastUpdate = Date.now();
      const duration = this.lastUpdate - startTime;
      
      console.log(`=== UPDATE CYCLE COMPLETED in ${duration}ms ===\n`);
      
    } catch (error) {
      console.error('Error during update cycle:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  async updatePLSPrice() {
    try {
      await priceService.updatePLSPrice();
      const price = priceService.getCurrentPLSPrice();
      console.log(`PLS Price: ${priceService.formatUSDAmount(price)}`);
    } catch (error) {
      console.error('Error updating PLS price:', error.message);
    }
  }

  async updateTransactions() {
    try {
      const beforeCount = transactionService.getTransactionCount();
      await transactionService.updateTransactions();
      const afterCount = transactionService.getTransactionCount();
      const newTransactions = afterCount - beforeCount;
      
      if (newTransactions > 0) {
        console.log(`Found ${newTransactions} new transactions`);
      }
    } catch (error) {
      console.error('Error updating transactions:', error.message);
    }
  }

  async calculatePnL() {
    try {
      const transactions = transactionService.transactions;
      const pnlReport = await pnlCalculator.calculatePnL(transactions);
      return pnlReport;
    } catch (error) {
      console.error('Error calculating PnL:', error.message);
      return null;
    }
  }

  logCurrentStatus(pnlReport) {
    if (!pnlReport) {
      console.log('No PnL data available');
      return;
    }

    const { summary } = pnlReport;
    const plsPrice = priceService.getCurrentPLSPrice();
    
    console.log('\n--- CURRENT STATUS ---');
    console.log(`Total PnL: ${pnlCalculator.formatPnLForDisplay(summary.totalPnL)}`);
    console.log(`Realized PnL: ${pnlCalculator.formatPnLForDisplay(summary.totalRealizedPnL)}`);
    console.log(`Unrealized PnL: ${pnlCalculator.formatPnLForDisplay(summary.totalUnrealizedPnL)}`);
    console.log(`Active Positions: ${summary.activePositions}`);
    console.log(`Total Trades: ${summary.totalTrades}`);
    console.log(`PLS Price: ${priceService.formatUSDAmount(plsPrice)}`);
    
    // Show top 3 active positions
    const activePositions = pnlReport.positions
      .filter(p => p.isActive)
      .sort((a, b) => parseFloat(b.unrealizedPnL) - parseFloat(a.unrealizedPnL))
      .slice(0, 3);
      
    if (activePositions.length > 0) {
      console.log('\nTop Active Positions:');
      activePositions.forEach(p => {
        console.log(`- ${p.tokenInfo.symbol}: ${pnlCalculator.formatPnLForDisplay(p.unrealizedPnL)} (${parseFloat(p.unrealizedPnLPercent).toFixed(2)}%)`);
      });
    }
    
    console.log('----------------------\n');
  }

  async generateDailyReport() {
    try {
      console.log('Generating daily report...');
      
      const transactions = transactionService.transactions;
      const pnlReport = await pnlCalculator.calculatePnL(transactions);
      
      if (pnlReport) {
        const report = await reportingService.generateDailyReport(pnlReport);
        console.log('Daily report generated successfully');
        
        // Log summary to console
        console.log('\n=== DAILY REPORT SUMMARY ===');
        console.log(`Date: ${report.metadata.date}`);
        console.log(`Day PnL: ${pnlCalculator.formatPnLForDisplay(report.dailyMetrics.dayPnL)}`);
        console.log(`Trades: ${report.dailyMetrics.tradesExecuted}`);
        console.log(`Total PnL: ${pnlCalculator.formatPnLForDisplay(report.summary.totalPnL)}`);
        console.log('============================\n');
      }
    } catch (error) {
      console.error('Error generating daily report:', error.message);
    }
  }

  async generateWeeklyReport() {
    try {
      console.log('Generating weekly report...');
      
      const transactions = transactionService.transactions;
      const pnlReport = await pnlCalculator.calculatePnL(transactions);
      
      if (pnlReport) {
        const report = await reportingService.generateWeeklyReport(pnlReport);
        console.log('Weekly report generated successfully');
        
        // Log summary to console
        console.log('\n=== WEEKLY REPORT SUMMARY ===');
        console.log(`Week: ${report.metadata.weekStart} to ${report.metadata.weekEnd}`);
        console.log(`Week PnL: ${pnlCalculator.formatPnLForDisplay(report.weeklyMetrics.weekPnL)}`);
        console.log(`Trades: ${report.weeklyMetrics.totalTrades}`);
        console.log(`Total PnL: ${pnlCalculator.formatPnLForDisplay(report.summary.totalPnL)}`);
        console.log('=============================\n');
      }
    } catch (error) {
      console.error('Error generating weekly report:', error.message);
    }
  }

  async updateMetadataCache() {
    try {
      console.log('Updating token metadata cache...');
      await tokenMetadataService.updateAllCachedMetadata();
      console.log('Token metadata cache updated successfully');
    } catch (error) {
      console.error('Error updating metadata cache:', error.message);
    }
  }

  async forceUpdate() {
    console.log('Forcing immediate update...');
    await this.performUpdate();
  }

  async forceDailyReport() {
    console.log('Forcing daily report generation...');
    await this.generateDailyReport();
  }

  async forceWeeklyReport() {
    console.log('Forcing weekly report generation...');
    await this.generateWeeklyReport();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastUpdate: this.lastUpdate,
      lastUpdateFormatted: this.lastUpdate ? moment(this.lastUpdate).format('YYYY-MM-DD HH:mm:ss') : null,
      updateInterval: this.updateInterval,
      nextUpdate: this.lastUpdate ? this.lastUpdate + this.updateInterval : null,
      nextUpdateFormatted: this.lastUpdate ? moment(this.lastUpdate + this.updateInterval).format('YYYY-MM-DD HH:mm:ss') : null
    };
  }

  stop() {
    console.log('Stopping scheduler...');
    // Note: In a real implementation, you'd want to properly clean up intervals
    process.exit(0);
  }
}

export default new Scheduler();