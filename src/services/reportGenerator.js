const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const logger = require('../utils/logger');

class ReportGenerator {
  constructor(database, pnlCalculator, priceTracker) {
    this.db = database;
    this.pnlCalculator = pnlCalculator;
    this.priceTracker = priceTracker;
    this.reportsDir = process.env.REPORTS_DIR || './reports';
    this.ensureReportsDirectory();
  }

  async ensureReportsDirectory() {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
      
      // Create subdirectories
      await Promise.all([
        fs.mkdir(path.join(this.reportsDir, 'daily'), { recursive: true }),
        fs.mkdir(path.join(this.reportsDir, 'weekly'), { recursive: true }),
        fs.mkdir(path.join(this.reportsDir, 'csv'), { recursive: true })
      ]);
    } catch (error) {
      logger.error('Error creating reports directory:', error.message);
    }
  }

  async generateDailyReport(date = null) {
    try {
      const reportDate = date || moment().format('YYYY-MM-DD');
      logger.info(`Generating daily report for ${reportDate}`);

      // Get data for the report
      const [portfolioSummary, dailyTrades, tokenAnalysis] = await Promise.all([
        this.pnlCalculator.getPortfolioSummary(),
        this.getDailyTrades(reportDate),
        this.getTokenAnalysis()
      ]);

      const reportData = {
        date: reportDate,
        generatedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
        summary: portfolioSummary,
        dailyTrades: dailyTrades,
        tokenAnalysis: tokenAnalysis,
        metadata: {
          totalTrades: dailyTrades.length,
          uniqueTokensTraded: [...new Set(dailyTrades.map(t => t.token_address))].length,
          plsPrice: portfolioSummary.plsPrice
        }
      };

      // Generate different report formats
      await Promise.all([
        this.generateTextReport(reportData),
        this.generateCsvReport(reportData),
        this.generateJsonReport(reportData)
      ]);

      // Store report summary in database
      await this.storeDailyReportSummary(reportData);

      logger.info(`Daily report generated successfully for ${reportDate}`);
      return reportData;
    } catch (error) {
      logger.error('Error generating daily report:', error.message);
      throw error;
    }
  }

  async generateTextReport(reportData) {
    const { date, summary, dailyTrades, tokenAnalysis } = reportData;
    
    let report = [];
    report.push('='.repeat(80));
    report.push(`PULSECHAIN MEMECOIN TRADING REPORT - ${date.toUpperCase()}`);
    report.push('='.repeat(80));
    report.push('');
    
    // Portfolio Summary
    report.push('PORTFOLIO SUMMARY');
    report.push('-'.repeat(40));
    report.push(`Total PnL: ${summary.totalPnL.display}`);
    report.push(`Realized PnL: ${summary.realizedPnL.display}`);
    report.push(`Unrealized PnL: ${summary.unrealizedPnL.display}`);
    report.push(`Daily PnL: ${summary.dailyPnL.display}`);
    report.push(`Weekly PnL: ${summary.weeklyPnL.display}`);
    report.push(`Weekly Average: ${summary.weeklyAverage.display}`);
    report.push(`Active Positions: ${summary.activePositions}`);
    report.push(`Total Trades: ${summary.totalTrades}`);
    report.push(`PLS Price: $${summary.plsPrice.toFixed(6)}`);
    report.push('');

    // Daily Trades
    if (dailyTrades.length > 0) {
      report.push('TODAY\'S TRADES');
      report.push('-'.repeat(40));
      
      for (const trade of dailyTrades) {
        const time = moment.unix(trade.timestamp).format('HH:mm:ss');
        const plsAmount = this.formatPls(trade.pls_amount);
        const tokenAmount = this.formatTokenAmount(trade.token_amount, 18);
        const price = this.formatPls(trade.price_per_token_pls);
        
        report.push(`${time} | ${trade.trade_type} ${tokenAmount} ${trade.symbol} @ ${price} PLS/token`);
        report.push(`         Total: ${plsAmount} PLS`);
        report.push('');
      }
    } else {
      report.push('NO TRADES TODAY');
      report.push('');
    }

    // Token Analysis
    if (tokenAnalysis.length > 0) {
      report.push('TOKEN ANALYSIS');
      report.push('-'.repeat(40));
      
      // Sort by total PnL (highest first)
      const sortedTokens = tokenAnalysis.sort((a, b) => 
        parseFloat(b.totalPnlUsd) - parseFloat(a.totalPnlUsd)
      );

      for (const token of sortedTokens.slice(0, 10)) { // Top 10 tokens
        report.push(`${token.symbol} (${token.name})`);
        report.push(`  Address: ${token.tokenAddress}`);
        report.push(`  Trades: ${token.tradeCount} | Hold Time: ${token.holdTime}`);
        report.push(`  Current Balance: ${token.currentBalance} tokens`);
        report.push(`  Average Buy Price: ${token.averageBuyPricePls} PLS`);
        report.push(`  Current Price: ${token.currentPricePls} PLS (~$${token.currentPriceUsd})`);
        report.push(`  Total PnL: ${token.totalPnlDisplay} (${token.totalPercentage}%)`);
        report.push(`  Realized: ${token.realizedPnlDisplay} (${token.realizedPercentage}%)`);
        report.push(`  Unrealized: ${token.unrealizedPnlDisplay} (${token.unrealizedPercentage}%)`);
        report.push('');
      }
    }

    // Footer
    report.push('-'.repeat(80));
    report.push(`Report generated at: ${reportData.generatedAt}`);
    report.push('PulseChain PnL Tracker - Professional Trading Analytics');
    report.push('='.repeat(80));

    const reportContent = report.join('\\n');
    const filename = path.join(this.reportsDir, 'daily', `report_${date}.txt`);
    
    await fs.writeFile(filename, reportContent, 'utf8');
    logger.info(`Text report saved: ${filename}`);
  }

  async generateCsvReport(reportData) {
    const { date, dailyTrades, tokenAnalysis } = reportData;
    
    // Generate trades CSV
    if (dailyTrades.length > 0) {
      const tradesFilename = path.join(this.reportsDir, 'csv', `trades_${date}.csv`);
      const tradesCsvWriter = createCsvWriter({
        path: tradesFilename,
        header: [
          { id: 'timestamp', title: 'Timestamp' },
          { id: 'time', title: 'Time' },
          { id: 'symbol', title: 'Token' },
          { id: 'name', title: 'Token Name' },
          { id: 'trade_type', title: 'Type' },
          { id: 'token_amount_formatted', title: 'Token Amount' },
          { id: 'pls_amount_formatted', title: 'PLS Amount' },
          { id: 'price_per_token_formatted', title: 'Price Per Token (PLS)' },
          { id: 'transaction_hash', title: 'Transaction Hash' }
        ]
      });

      const tradesData = dailyTrades.map(trade => ({
        timestamp: moment.unix(trade.timestamp).format('YYYY-MM-DD HH:mm:ss'),
        time: moment.unix(trade.timestamp).format('HH:mm:ss'),
        symbol: trade.symbol,
        name: trade.name || 'Unknown',
        trade_type: trade.trade_type,
        token_amount_formatted: this.formatTokenAmount(trade.token_amount, 18),
        pls_amount_formatted: this.formatPls(trade.pls_amount),
        price_per_token_formatted: this.formatPls(trade.price_per_token_pls),
        transaction_hash: trade.transaction_hash
      }));

      await tradesCsvWriter.writeRecords(tradesData);
      logger.info(`Trades CSV saved: ${tradesFilename}`);
    }

    // Generate token analysis CSV
    if (tokenAnalysis.length > 0) {
      const tokensFilename = path.join(this.reportsDir, 'csv', `tokens_${date}.csv`);
      const tokensCsvWriter = createCsvWriter({
        path: tokensFilename,
        header: [
          { id: 'symbol', title: 'Symbol' },
          { id: 'name', title: 'Name' },
          { id: 'tokenAddress', title: 'Address' },
          { id: 'tradeCount', title: 'Total Trades' },
          { id: 'buyCount', title: 'Buy Trades' },
          { id: 'sellCount', title: 'Sell Trades' },
          { id: 'holdTime', title: 'Hold Time' },
          { id: 'currentBalance', title: 'Current Balance' },
          { id: 'totalInvestedPls', title: 'Total Invested (PLS)' },
          { id: 'currentValuePls', title: 'Current Value (PLS)' },
          { id: 'realizedPnlUsd', title: 'Realized PnL (USD)' },
          { id: 'unrealizedPnlUsd', title: 'Unrealized PnL (USD)' },
          { id: 'totalPnlUsd', title: 'Total PnL (USD)' },
          { id: 'totalPercentage', title: 'Total Return (%)' },
          { id: 'currentPricePls', title: 'Current Price (PLS)' },
          { id: 'currentPriceUsd', title: 'Current Price (USD)' },
          { id: 'firstBuyDate', title: 'First Buy Date' },
          { id: 'lastTradeDate', title: 'Last Trade Date' }
        ]
      });

      await tokensCsvWriter.writeRecords(tokenAnalysis);
      logger.info(`Tokens CSV saved: ${tokensFilename}`);
    }
  }

  async generateJsonReport(reportData) {
    const filename = path.join(this.reportsDir, 'daily', `report_${reportData.date}.json`);
    await fs.writeFile(filename, JSON.stringify(reportData, null, 2), 'utf8');
    logger.info(`JSON report saved: ${filename}`);
  }

  async generateWeeklyReport() {
    try {
      const weekStart = moment().startOf('week');
      const weekEnd = moment().endOf('week');
      const weekLabel = `${weekStart.format('YYYY-MM-DD')}_to_${weekEnd.format('YYYY-MM-DD')}`;
      
      logger.info(`Generating weekly report for week: ${weekLabel}`);

      // Get weekly data
      const weeklyTrades = await this.getWeeklyTrades(weekStart.unix());
      const portfolioSummary = await this.pnlCalculator.getPortfolioSummary();
      
      // Calculate weekly statistics
      const weeklyStats = this.calculateWeeklyStats(weeklyTrades);
      
      const reportData = {
        weekStart: weekStart.format('YYYY-MM-DD'),
        weekEnd: weekEnd.format('YYYY-MM-DD'),
        generatedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
        summary: portfolioSummary,
        weeklyTrades: weeklyTrades,
        weeklyStats: weeklyStats,
        dailyBreakdown: this.getDailyBreakdown(weeklyTrades)
      };

      // Generate weekly report files
      await this.generateWeeklyTextReport(reportData, weekLabel);
      await this.generateWeeklyJsonReport(reportData, weekLabel);

      logger.info(`Weekly report generated successfully for ${weekLabel}`);
      return reportData;
    } catch (error) {
      logger.error('Error generating weekly report:', error.message);
      throw error;
    }
  }

  async generateWeeklyTextReport(reportData, weekLabel) {
    const { weekStart, weekEnd, summary, weeklyStats, dailyBreakdown } = reportData;
    
    let report = [];
    report.push('='.repeat(80));
    report.push(`WEEKLY TRADING REPORT: ${weekStart} to ${weekEnd}`);
    report.push('='.repeat(80));
    report.push('');
    
    // Weekly Summary
    report.push('WEEKLY SUMMARY');
    report.push('-'.repeat(40));
    report.push(`Total Trades: ${weeklyStats.totalTrades}`);
    report.push(`Unique Tokens Traded: ${weeklyStats.uniqueTokens}`);
    report.push(`Weekly PnL: ${summary.weeklyPnL.display}`);
    report.push(`Total Portfolio PnL: ${summary.totalPnL.display}`);
    report.push(`Active Positions: ${summary.activePositions}`);
    report.push(`Average Daily Trades: ${(weeklyStats.totalTrades / 7).toFixed(1)}`);
    report.push('');

    // Daily Breakdown
    report.push('DAILY BREAKDOWN');
    report.push('-'.repeat(40));
    
    for (const [date, dayData] of Object.entries(dailyBreakdown)) {
      const dayName = moment(date).format('dddd');
      report.push(`${dayName} ${date}: ${dayData.trades} trades, PnL: ${dayData.pnlDisplay}`);
    }
    report.push('');

    // Top Performing Tokens
    if (weeklyStats.topPerformers.length > 0) {
      report.push('TOP WEEKLY PERFORMERS');
      report.push('-'.repeat(40));
      
      weeklyStats.topPerformers.forEach((token, index) => {
        report.push(`${index + 1}. ${token.symbol}: ${token.pnlDisplay} (${token.percentage}%)`);
      });
      report.push('');
    }

    // Footer
    report.push('-'.repeat(80));
    report.push(`Report generated at: ${reportData.generatedAt}`);
    report.push('PulseChain PnL Tracker - Weekly Performance Analysis');
    report.push('='.repeat(80));

    const reportContent = report.join('\\n');
    const filename = path.join(this.reportsDir, 'weekly', `weekly_report_${weekLabel}.txt`);
    
    await fs.writeFile(filename, reportContent, 'utf8');
    logger.info(`Weekly text report saved: ${filename}`);
  }

  async generateWeeklyJsonReport(reportData, weekLabel) {
    const filename = path.join(this.reportsDir, 'weekly', `weekly_report_${weekLabel}.json`);
    await fs.writeFile(filename, JSON.stringify(reportData, null, 2), 'utf8');
    logger.info(`Weekly JSON report saved: ${filename}`);
  }

  async getDailyTrades(date) {
    const startOfDay = moment(date).startOf('day').unix();
    const endOfDay = moment(date).endOf('day').unix();
    
    return new Promise((resolve, reject) => {
      this.db.db.all(
        `SELECT t.*, tk.symbol, tk.name 
         FROM trades t 
         JOIN tokens tk ON t.token_address = tk.address 
         WHERE t.timestamp >= ? AND t.timestamp <= ?
         ORDER BY t.timestamp DESC`,
        [startOfDay, endOfDay],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  async getWeeklyTrades(weekStartTimestamp) {
    const weekEndTimestamp = weekStartTimestamp + (7 * 24 * 60 * 60);
    
    return new Promise((resolve, reject) => {
      this.db.db.all(
        `SELECT t.*, tk.symbol, tk.name 
         FROM trades t 
         JOIN tokens tk ON t.token_address = tk.address 
         WHERE t.timestamp >= ? AND t.timestamp <= ?
         ORDER BY t.timestamp DESC`,
        [weekStartTimestamp, weekEndTimestamp],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  async getTokenAnalysis() {
    const holdings = await this.db.getHoldings();
    const currentPrices = await this.db.getLatestPrices();
    const plsPrice = this.priceTracker.getCachedPrice('PLS') || 
                    currentPrices.find(p => p.token_address === '0x0000000000000000000000000000000000000000');

    const tokenAnalysis = [];
    
    for (const holding of holdings) {
      try {
        const analysis = await this.pnlCalculator.calculateTokenPnL(holding, currentPrices, plsPrice);
        tokenAnalysis.push(analysis);
      } catch (error) {
        logger.error(`Error analyzing token ${holding.token_address}:`, error.message);
      }
    }

    return tokenAnalysis;
  }

  calculateWeeklyStats(weeklyTrades) {
    const stats = {
      totalTrades: weeklyTrades.length,
      uniqueTokens: [...new Set(weeklyTrades.map(t => t.token_address))].length,
      totalVolumePls: 0n,
      topPerformers: []
    };

    // Calculate total volume
    for (const trade of weeklyTrades) {
      stats.totalVolumePls += BigInt(trade.pls_amount);
    }

    // Calculate top performers (simplified)
    const tokenPerformance = {};
    for (const trade of weeklyTrades) {
      if (!tokenPerformance[trade.token_address]) {
        tokenPerformance[trade.token_address] = {
          symbol: trade.symbol,
          pnl: 0n,
          trades: 0
        };
      }
      
      if (trade.trade_type === 'SELL') {
        tokenPerformance[trade.token_address].pnl += BigInt(trade.pls_amount);
      } else {
        tokenPerformance[trade.token_address].pnl -= BigInt(trade.pls_amount);
      }
      
      tokenPerformance[trade.token_address].trades++;
    }

    // Sort and format top performers
    stats.topPerformers = Object.values(tokenPerformance)
      .sort((a, b) => Number(b.pnl - a.pnl))
      .slice(0, 5)
      .map(token => ({
        symbol: token.symbol,
        pnl: token.pnl.toString(),
        pnlDisplay: this.formatPls(token.pnl.toString()),
        percentage: '0.00' // Would need more complex calculation
      }));

    return stats;
  }

  getDailyBreakdown(weeklyTrades) {
    const dailyBreakdown = {};
    
    for (const trade of weeklyTrades) {
      const date = moment.unix(trade.timestamp).format('YYYY-MM-DD');
      
      if (!dailyBreakdown[date]) {
        dailyBreakdown[date] = {
          trades: 0,
          pnl: 0n,
          pnlDisplay: '+0 PLS ~$0.00'
        };
      }
      
      dailyBreakdown[date].trades++;
      
      if (trade.trade_type === 'SELL') {
        dailyBreakdown[date].pnl += BigInt(trade.pls_amount);
      } else {
        dailyBreakdown[date].pnl -= BigInt(trade.pls_amount);
      }
      
      // Update display format
      dailyBreakdown[date].pnlDisplay = this.formatPls(dailyBreakdown[date].pnl.toString());
    }

    return dailyBreakdown;
  }

  async storeDailyReportSummary(reportData) {
    try {
      const summary = reportData.summary;
      const report = {
        date: reportData.date,
        totalPnlPls: summary.totalPnL.pls,
        totalPnlUsd: summary.totalPnL.usd.toString(),
        dailyTrades: reportData.dailyTrades.length,
        activePositions: summary.activePositions,
        realizedPnlPls: summary.realizedPnL.pls,
        unrealizedPnlPls: summary.unrealizedPnL.pls,
        plsPriceUsd: summary.plsPrice.toString(),
        detailedData: {
          tokenAnalysis: reportData.tokenAnalysis.length,
          uniqueTokensTraded: reportData.metadata.uniqueTokensTraded,
          weeklyPnl: summary.weeklyPnL.pls,
          weeklyAverage: summary.weeklyAverage.pls
        }
      };

      await this.db.insertDailyReport(report);
      logger.info(`Daily report summary stored in database for ${reportData.date}`);
    } catch (error) {
      logger.error('Error storing daily report summary:', error.message);
    }
  }

  formatPls(amount) {
    const pls = typeof amount === 'bigint' ? Number(amount) / 1e18 : parseFloat(amount) / 1e18;
    return pls.toLocaleString('en-US', { maximumFractionDigits: 6 });
  }

  formatTokenAmount(amount, decimals = 18) {
    const divisor = Math.pow(10, decimals);
    const formatted = typeof amount === 'bigint' ? Number(amount) / divisor : parseFloat(amount) / divisor;
    return formatted.toLocaleString('en-US', { maximumFractionDigits: 6 });
  }

  async getRecentReports(days = 7) {
    return new Promise((resolve, reject) => {
      this.db.db.all(
        `SELECT * FROM daily_reports 
         WHERE date >= date('now', '-${days} days')
         ORDER BY date DESC`,
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  async cleanupOldReports(daysToKeep = 30) {
    try {
      const cutoffDate = moment().subtract(daysToKeep, 'days').format('YYYY-MM-DD');
      
      // Clean up files
      const dailyDir = path.join(this.reportsDir, 'daily');
      const weeklyDir = path.join(this.reportsDir, 'weekly');
      const csvDir = path.join(this.reportsDir, 'csv');

      for (const dir of [dailyDir, weeklyDir, csvDir]) {
        try {
          const files = await fs.readdir(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);
            const fileDate = moment(stats.mtime);
            
            if (fileDate.isBefore(cutoffDate)) {
              await fs.unlink(filePath);
              logger.info(`Cleaned up old report: ${file}`);
            }
          }
        } catch (error) {
          logger.error(`Error cleaning up directory ${dir}:`, error.message);
        }
      }

      logger.info(`Report cleanup completed, kept reports from ${cutoffDate} onwards`);
    } catch (error) {
      logger.error('Error during report cleanup:', error.message);
    }
  }
}

module.exports = ReportGenerator;