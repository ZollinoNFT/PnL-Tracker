import fs from 'fs-extra';
import path from 'path';
import moment from 'moment';
import priceService from './priceService.js';

class ReportingService {
  constructor() {
    this.reportsDir = process.env.REPORTS_DIR || './reports';
    this.dataDir = process.env.DATA_DIR || './data';
    this.init();
  }

  async init() {
    await fs.ensureDir(this.reportsDir);
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(path.join(this.reportsDir, 'daily'));
    await fs.ensureDir(path.join(this.reportsDir, 'weekly'));
    await fs.ensureDir(path.join(this.reportsDir, 'summary'));
  }

  async generateDailyReport(pnlReport, date = new Date()) {
    const dateStr = moment(date).format('YYYY-MM-DD');
    const timestamp = moment(date).format('YYYY-MM-DD HH:mm:ss');
    
    const report = {
      metadata: {
        reportType: 'DAILY_PNL_REPORT',
        generatedAt: timestamp,
        date: dateStr,
        walletAddress: process.env.WALLET_ADDRESS,
        plsPrice: priceService.getCurrentPLSPrice(),
        reportVersion: '1.0'
      },
      summary: {
        ...pnlReport.summary,
        totalRealizedPnLUSD: priceService.convertPLSToUSD(parseFloat(pnlReport.summary.totalRealizedPnL)),
        totalUnrealizedPnLUSD: priceService.convertPLSToUSD(parseFloat(pnlReport.summary.totalUnrealizedPnL)),
        totalPnLUSD: priceService.convertPLSToUSD(parseFloat(pnlReport.summary.totalPnL))
      },
      dailyMetrics: {
        dayPnL: pnlReport.dailyPnL[dateStr] || '0',
        dayPnLUSD: priceService.convertPLSToUSD(parseFloat(pnlReport.dailyPnL[dateStr] || '0')),
        tradesExecuted: this.countTradesForDate(pnlReport.positions, date),
        newPositionsOpened: this.countNewPositionsForDate(pnlReport.positions, date),
        positionsClosed: this.countClosedPositionsForDate(pnlReport.positions, date)
      },
      positions: this.formatPositionsForReport(pnlReport.positions),
      performance: {
        winRate: this.calculateWinRate(pnlReport.positions),
        averageWin: this.calculateAverageWin(pnlReport.positions),
        averageLoss: this.calculateAverageLoss(pnlReport.positions),
        profitFactor: this.calculateProfitFactor(pnlReport.positions),
        sharpeRatio: this.calculateSharpeRatio(pnlReport.dailyPnL),
        maxDrawdown: this.calculateMaxDrawdown(pnlReport.dailyPnL)
      }
    };

    // Save daily report
    const filename = `daily_report_${dateStr}.json`;
    const filepath = path.join(this.reportsDir, 'daily', filename);
    await fs.writeJson(filepath, report, { spaces: 2 });

    // Generate human-readable version
    await this.generateHumanReadableReport(report, filepath.replace('.json', '.txt'));

    console.log(`Daily report generated: ${filepath}`);
    return report;
  }

  async generateWeeklyReport(pnlReport, weekStartDate = new Date()) {
    const weekStart = moment(weekStartDate).startOf('week');
    const weekEnd = moment(weekStartDate).endOf('week');
    const weekStr = `${weekStart.format('YYYY-MM-DD')}_to_${weekEnd.format('YYYY-MM-DD')}`;
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');

    const report = {
      metadata: {
        reportType: 'WEEKLY_PNL_REPORT',
        generatedAt: timestamp,
        weekStart: weekStart.format('YYYY-MM-DD'),
        weekEnd: weekEnd.format('YYYY-MM-DD'),
        walletAddress: process.env.WALLET_ADDRESS,
        plsPrice: priceService.getCurrentPLSPrice(),
        reportVersion: '1.0'
      },
      summary: {
        ...pnlReport.summary,
        totalRealizedPnLUSD: priceService.convertPLSToUSD(parseFloat(pnlReport.summary.totalRealizedPnL)),
        totalUnrealizedPnLUSD: priceService.convertPLSToUSD(parseFloat(pnlReport.summary.totalUnrealizedPnL)),
        totalPnLUSD: priceService.convertPLSToUSD(parseFloat(pnlReport.summary.totalPnL))
      },
      weeklyMetrics: {
        weekPnL: pnlReport.weeklyPnL[weekStr] || '0',
        weekPnLUSD: priceService.convertPLSToUSD(parseFloat(pnlReport.weeklyPnL[weekStr] || '0')),
        averageDailyPnL: this.calculateAverageDailyPnL(pnlReport.dailyPnL, weekStart, weekEnd),
        tradingDays: this.countTradingDays(pnlReport.dailyPnL, weekStart, weekEnd),
        totalTrades: this.countTradesForWeek(pnlReport.positions, weekStart, weekEnd),
        bestDay: this.getBestDay(pnlReport.dailyPnL, weekStart, weekEnd),
        worstDay: this.getWorstDay(pnlReport.dailyPnL, weekStart, weekEnd)
      },
      positions: this.formatPositionsForReport(pnlReport.positions),
      weeklyTrends: {
        topPerformers: this.getTopPerformers(pnlReport.positions, 5),
        worstPerformers: this.getWorstPerformers(pnlReport.positions, 5),
        mostTraded: this.getMostTradedTokens(pnlReport.positions, 5),
        newTokensTraded: this.getNewTokensForWeek(pnlReport.positions, weekStart, weekEnd)
      },
      performance: {
        winRate: this.calculateWinRate(pnlReport.positions),
        averageWin: this.calculateAverageWin(pnlReport.positions),
        averageLoss: this.calculateAverageLoss(pnlReport.positions),
        profitFactor: this.calculateProfitFactor(pnlReport.positions),
        sharpeRatio: this.calculateSharpeRatio(pnlReport.dailyPnL),
        maxDrawdown: this.calculateMaxDrawdown(pnlReport.dailyPnL),
        weeklyVolatility: this.calculateWeeklyVolatility(pnlReport.dailyPnL, weekStart, weekEnd)
      }
    };

    // Save weekly report
    const filename = `weekly_report_${weekStr}.json`;
    const filepath = path.join(this.reportsDir, 'weekly', filename);
    await fs.writeJson(filepath, report, { spaces: 2 });

    // Generate human-readable version
    await this.generateHumanReadableReport(report, filepath.replace('.json', '.txt'));

    console.log(`Weekly report generated: ${filepath}`);
    return report;
  }

  formatPositionsForReport(positions) {
    return positions.map(position => ({
      token: {
        address: position.tokenAddress,
        name: position.tokenInfo.name,
        symbol: position.tokenInfo.symbol,
        decimals: position.tokenInfo.decimals
      },
      trading: {
        totalBought: position.totalBought,
        totalSold: position.totalSold,
        currentHolding: position.currentHolding,
        tradeCount: position.tradeCount,
        isActive: position.isActive
      },
      pricing: {
        averageBuyPrice: position.averageBuyPrice,
        averageSellPrice: position.averageSellPrice,
        currentPrice: position.currentPrice
      },
      pnl: {
        realizedPnL: position.realizedPnL,
        unrealizedPnL: position.unrealizedPnL,
        totalPnL: position.totalPnL,
        realizedPnLPercent: position.realizedPnLPercent,
        unrealizedPnLPercent: position.unrealizedPnLPercent,
        totalPnLPercent: position.totalPnLPercent,
        realizedPnLUSD: priceService.convertPLSToUSD(parseFloat(position.realizedPnL)),
        unrealizedPnLUSD: priceService.convertPLSToUSD(parseFloat(position.unrealizedPnL)),
        totalPnLUSD: priceService.convertPLSToUSD(parseFloat(position.totalPnL))
      },
      timing: {
        holdDays: position.holdTime.days,
        holdHours: position.holdTime.hours,
        totalHoldTime: position.holdTime.total
      },
      investment: {
        totalPLSSpent: position.totalPLSSpent,
        totalPLSReceived: position.totalPLSReceived,
        totalUSDSpent: priceService.convertPLSToUSD(parseFloat(position.totalPLSSpent)),
        totalUSDReceived: priceService.convertPLSToUSD(parseFloat(position.totalPLSReceived))
      }
    }));
  }

  async generateHumanReadableReport(report, filepath) {
    let content = '';

    if (report.metadata.reportType === 'DAILY_PNL_REPORT') {
      content = this.generateDailyReadableContent(report);
    } else if (report.metadata.reportType === 'WEEKLY_PNL_REPORT') {
      content = this.generateWeeklyReadableContent(report);
    }

    await fs.writeFile(filepath, content);
  }

  generateDailyReadableContent(report) {
    const { metadata, summary, dailyMetrics, performance } = report;
    
    return `
PULSECHAIN MEMECOIN TRADING - DAILY PnL REPORT
=============================================
Generated: ${metadata.generatedAt}
Date: ${metadata.date}
Wallet: ${metadata.walletAddress}
PLS Price: ${priceService.formatUSDAmount(metadata.plsPrice)}

DAILY SUMMARY
-------------
Day PnL: ${priceService.formatPLSAmount(parseFloat(dailyMetrics.dayPnL))} PLS (${priceService.formatUSDAmount(dailyMetrics.dayPnLUSD)})
Trades Executed: ${dailyMetrics.tradesExecuted}
New Positions: ${dailyMetrics.newPositionsOpened}
Closed Positions: ${dailyMetrics.positionsClosed}

OVERALL PORTFOLIO
-----------------
Total Realized PnL: ${priceService.formatPLSAmount(parseFloat(summary.totalRealizedPnL))} PLS (${priceService.formatUSDAmount(summary.totalRealizedPnLUSD)})
Total Unrealized PnL: ${priceService.formatPLSAmount(parseFloat(summary.totalUnrealizedPnL))} PLS (${priceService.formatUSDAmount(summary.totalUnrealizedPnLUSD)})
Total PnL: ${priceService.formatPLSAmount(parseFloat(summary.totalPnL))} PLS (${priceService.formatUSDAmount(summary.totalPnLUSD)})
Active Positions: ${summary.activePositions}
Closed Positions: ${summary.closedPositions}
Total Trades: ${summary.totalTrades}

PERFORMANCE METRICS
-------------------
Win Rate: ${(performance.winRate * 100).toFixed(2)}%
Average Win: ${priceService.formatPLSAmount(performance.averageWin)} PLS
Average Loss: ${priceService.formatPLSAmount(performance.averageLoss)} PLS
Profit Factor: ${performance.profitFactor.toFixed(2)}
Sharpe Ratio: ${performance.sharpeRatio.toFixed(2)}
Max Drawdown: ${(performance.maxDrawdown * 100).toFixed(2)}%

ACTIVE POSITIONS
================
${this.formatActivePositionsText(report.positions)}

CLOSED POSITIONS TODAY
======================
${this.formatClosedPositionsText(report.positions, metadata.date)}
`;
  }

  generateWeeklyReadableContent(report) {
    const { metadata, summary, weeklyMetrics, weeklyTrends, performance } = report;
    
    return `
PULSECHAIN MEMECOIN TRADING - WEEKLY PnL REPORT
===============================================
Generated: ${metadata.generatedAt}
Week: ${metadata.weekStart} to ${metadata.weekEnd}
Wallet: ${metadata.walletAddress}
PLS Price: ${priceService.formatUSDAmount(metadata.plsPrice)}

WEEKLY SUMMARY
--------------
Week PnL: ${priceService.formatPLSAmount(parseFloat(weeklyMetrics.weekPnL))} PLS (${priceService.formatUSDAmount(weeklyMetrics.weekPnLUSD)})
Average Daily PnL: ${priceService.formatPLSAmount(weeklyMetrics.averageDailyPnL)} PLS
Trading Days: ${weeklyMetrics.tradingDays}/7
Total Trades: ${weeklyMetrics.totalTrades}
Best Day: ${weeklyMetrics.bestDay.date} (${priceService.formatPLSAmount(weeklyMetrics.bestDay.pnl)} PLS)
Worst Day: ${weeklyMetrics.worstDay.date} (${priceService.formatPLSAmount(weeklyMetrics.worstDay.pnl)} PLS)

OVERALL PORTFOLIO
-----------------
Total Realized PnL: ${priceService.formatPLSAmount(parseFloat(summary.totalRealizedPnL))} PLS (${priceService.formatUSDAmount(summary.totalRealizedPnLUSD)})
Total Unrealized PnL: ${priceService.formatPLSAmount(parseFloat(summary.totalUnrealizedPnL))} PLS (${priceService.formatUSDAmount(summary.totalUnrealizedPnLUSD)})
Total PnL: ${priceService.formatPLSAmount(parseFloat(summary.totalPnL))} PLS (${priceService.formatUSDAmount(summary.totalPnLUSD)})
Active Positions: ${summary.activePositions}
Closed Positions: ${summary.closedPositions}
Total Trades: ${summary.totalTrades}

PERFORMANCE METRICS
-------------------
Win Rate: ${(performance.winRate * 100).toFixed(2)}%
Average Win: ${priceService.formatPLSAmount(performance.averageWin)} PLS
Average Loss: ${priceService.formatPLSAmount(performance.averageLoss)} PLS
Profit Factor: ${performance.profitFactor.toFixed(2)}
Sharpe Ratio: ${performance.sharpeRatio.toFixed(2)}
Max Drawdown: ${(performance.maxDrawdown * 100).toFixed(2)}%
Weekly Volatility: ${(performance.weeklyVolatility * 100).toFixed(2)}%

WEEKLY TRENDS
=============
TOP PERFORMERS:
${weeklyTrends.topPerformers.map(p => `- ${p.symbol}: ${priceService.formatPLSAmount(parseFloat(p.totalPnL))} PLS (${(parseFloat(p.totalPnLPercent)).toFixed(2)}%)`).join('\n')}

WORST PERFORMERS:
${weeklyTrends.worstPerformers.map(p => `- ${p.symbol}: ${priceService.formatPLSAmount(parseFloat(p.totalPnL))} PLS (${(parseFloat(p.totalPnLPercent)).toFixed(2)}%)`).join('\n')}

MOST TRADED:
${weeklyTrends.mostTraded.map(p => `- ${p.symbol}: ${p.tradeCount} trades`).join('\n')}

NEW TOKENS TRADED:
${weeklyTrends.newTokensTraded.map(p => `- ${p.symbol} (${p.name})`).join('\n')}

ACTIVE POSITIONS
================
${this.formatActivePositionsText(report.positions)}
`;
  }

  formatActivePositionsText(positions) {
    const activePositions = positions.filter(p => p.trading.isActive);
    
    if (activePositions.length === 0) {
      return 'No active positions.';
    }

    return activePositions.map(p => `
${p.token.symbol} (${p.token.name})
  Holding: ${priceService.formatPLSAmount(parseFloat(p.trading.currentHolding))} tokens
  Avg Buy Price: ${priceService.formatPLSAmount(parseFloat(p.pricing.averageBuyPrice))} PLS
  Current Price: ${priceService.formatPLSAmount(p.pricing.currentPrice)} PLS
  Unrealized PnL: ${priceService.formatPLSAmount(parseFloat(p.pnl.unrealizedPnL))} PLS (${parseFloat(p.pnl.unrealizedPnLPercent).toFixed(2)}%)
  USD Value: ${priceService.formatUSDAmount(p.pnl.unrealizedPnLUSD)}
  Hold Time: ${p.timing.holdDays} days, ${p.timing.holdHours} hours
`).join('\n');
  }

  formatClosedPositionsText(positions, date) {
    // This would need to be implemented to show positions closed on a specific date
    return 'No positions closed today.';
  }

  // Performance calculation methods
  calculateWinRate(positions) {
    const closedPositions = positions.filter(p => !p.trading.isActive);
    if (closedPositions.length === 0) return 0;
    
    const winners = closedPositions.filter(p => parseFloat(p.pnl.realizedPnL) > 0);
    return winners.length / closedPositions.length;
  }

  calculateAverageWin(positions) {
    const winners = positions.filter(p => parseFloat(p.pnl.realizedPnL) > 0);
    if (winners.length === 0) return 0;
    
    const totalWins = winners.reduce((sum, p) => sum + parseFloat(p.pnl.realizedPnL), 0);
    return totalWins / winners.length;
  }

  calculateAverageLoss(positions) {
    const losers = positions.filter(p => parseFloat(p.pnl.realizedPnL) < 0);
    if (losers.length === 0) return 0;
    
    const totalLosses = losers.reduce((sum, p) => sum + Math.abs(parseFloat(p.pnl.realizedPnL)), 0);
    return totalLosses / losers.length;
  }

  calculateProfitFactor(positions) {
    const totalWins = this.calculateAverageWin(positions);
    const totalLosses = this.calculateAverageLoss(positions);
    
    return totalLosses > 0 ? totalWins / totalLosses : 0;
  }

  calculateSharpeRatio(dailyPnL) {
    const values = Object.values(dailyPnL).map(v => parseFloat(v));
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? mean / stdDev : 0;
  }

  calculateMaxDrawdown(dailyPnL) {
    const values = Object.values(dailyPnL).map(v => parseFloat(v));
    let maxDrawdown = 0;
    let peak = 0;
    let cumulative = 0;
    
    for (const value of values) {
      cumulative += value;
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = (peak - cumulative) / Math.abs(peak);
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  // Helper methods for counting and calculations
  countTradesForDate(positions, date) {
    const dateStr = moment(date).format('YYYY-MM-DD');
    return positions.reduce((count, position) => {
      const dayTrades = [...position.buyTransactions, ...position.sellTransactions]
        .filter(tx => moment(tx.timestamp).format('YYYY-MM-DD') === dateStr);
      return count + dayTrades.length;
    }, 0);
  }

  countNewPositionsForDate(positions, date) {
    const dateStr = moment(date).format('YYYY-MM-DD');
    return positions.filter(position => 
      moment(position.trading.firstTradeTime).format('YYYY-MM-DD') === dateStr
    ).length;
  }

  countClosedPositionsForDate(positions, date) {
    const dateStr = moment(date).format('YYYY-MM-DD');
    return positions.filter(position => 
      !position.trading.isActive && 
      moment(position.trading.lastTradeTime).format('YYYY-MM-DD') === dateStr
    ).length;
  }

  calculateAverageDailyPnL(dailyPnL, weekStart, weekEnd) {
    const weekDays = [];
    const current = moment(weekStart);
    
    while (current.isSameOrBefore(weekEnd)) {
      const dateStr = current.format('YYYY-MM-DD');
      weekDays.push(parseFloat(dailyPnL[dateStr] || '0'));
      current.add(1, 'day');
    }
    
    return weekDays.reduce((sum, v) => sum + v, 0) / weekDays.length;
  }

  countTradingDays(dailyPnL, weekStart, weekEnd) {
    const weekDays = [];
    const current = moment(weekStart);
    
    while (current.isSameOrBefore(weekEnd)) {
      const dateStr = current.format('YYYY-MM-DD');
      if (parseFloat(dailyPnL[dateStr] || '0') !== 0) {
        weekDays.push(dateStr);
      }
      current.add(1, 'day');
    }
    
    return weekDays.length;
  }

  countTradesForWeek(positions, weekStart, weekEnd) {
    return positions.reduce((count, position) => {
      const weekTrades = [...position.buyTransactions, ...position.sellTransactions]
        .filter(tx => moment(tx.timestamp).isBetween(weekStart, weekEnd, null, '[]'));
      return count + weekTrades.length;
    }, 0);
  }

  getBestDay(dailyPnL, weekStart, weekEnd) {
    let bestDay = { date: '', pnl: -Infinity };
    const current = moment(weekStart);
    
    while (current.isSameOrBefore(weekEnd)) {
      const dateStr = current.format('YYYY-MM-DD');
      const pnl = parseFloat(dailyPnL[dateStr] || '0');
      if (pnl > bestDay.pnl) {
        bestDay = { date: dateStr, pnl };
      }
      current.add(1, 'day');
    }
    
    return bestDay;
  }

  getWorstDay(dailyPnL, weekStart, weekEnd) {
    let worstDay = { date: '', pnl: Infinity };
    const current = moment(weekStart);
    
    while (current.isSameOrBefore(weekEnd)) {
      const dateStr = current.format('YYYY-MM-DD');
      const pnl = parseFloat(dailyPnL[dateStr] || '0');
      if (pnl < worstDay.pnl) {
        worstDay = { date: dateStr, pnl };
      }
      current.add(1, 'day');
    }
    
    return worstDay;
  }

  getTopPerformers(positions, limit) {
    return positions
      .filter(p => parseFloat(p.pnl.totalPnL) > 0)
      .sort((a, b) => parseFloat(b.pnl.totalPnL) - parseFloat(a.pnl.totalPnL))
      .slice(0, limit)
      .map(p => ({
        symbol: p.token.symbol,
        totalPnL: p.pnl.totalPnL,
        totalPnLPercent: p.pnl.totalPnLPercent
      }));
  }

  getWorstPerformers(positions, limit) {
    return positions
      .filter(p => parseFloat(p.pnl.totalPnL) < 0)
      .sort((a, b) => parseFloat(a.pnl.totalPnL) - parseFloat(b.pnl.totalPnL))
      .slice(0, limit)
      .map(p => ({
        symbol: p.token.symbol,
        totalPnL: p.pnl.totalPnL,
        totalPnLPercent: p.pnl.totalPnLPercent
      }));
  }

  getMostTradedTokens(positions, limit) {
    return positions
      .sort((a, b) => b.trading.tradeCount - a.trading.tradeCount)
      .slice(0, limit)
      .map(p => ({
        symbol: p.token.symbol,
        tradeCount: p.trading.tradeCount
      }));
  }

  getNewTokensForWeek(positions, weekStart, weekEnd) {
    return positions
      .filter(p => moment(p.timing.firstTradeTime).isBetween(weekStart, weekEnd, null, '[]'))
      .map(p => ({
        symbol: p.token.symbol,
        name: p.token.name
      }));
  }

  calculateWeeklyVolatility(dailyPnL, weekStart, weekEnd) {
    const weekValues = [];
    const current = moment(weekStart);
    
    while (current.isSameOrBefore(weekEnd)) {
      const dateStr = current.format('YYYY-MM-DD');
      weekValues.push(parseFloat(dailyPnL[dateStr] || '0'));
      current.add(1, 'day');
    }
    
    if (weekValues.length < 2) return 0;
    
    const mean = weekValues.reduce((sum, v) => sum + v, 0) / weekValues.length;
    const variance = weekValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / weekValues.length;
    return Math.sqrt(variance);
  }

  async getLatestDailyReport() {
    try {
      const dailyDir = path.join(this.reportsDir, 'daily');
      const files = await fs.readdir(dailyDir);
      const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();
      
      if (jsonFiles.length > 0) {
        return await fs.readJson(path.join(dailyDir, jsonFiles[0]));
      }
    } catch (error) {
      console.warn('Error getting latest daily report:', error.message);
    }
    
    return null;
  }

  async getLatestWeeklyReport() {
    try {
      const weeklyDir = path.join(this.reportsDir, 'weekly');
      const files = await fs.readdir(weeklyDir);
      const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();
      
      if (jsonFiles.length > 0) {
        return await fs.readJson(path.join(weeklyDir, jsonFiles[0]));
      }
    } catch (error) {
      console.warn('Error getting latest weekly report:', error.message);
    }
    
    return null;
  }
}

export default new ReportingService();