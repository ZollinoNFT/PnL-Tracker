const moment = require('moment');
const logger = require('../utils/logger');

class PnLCalculator {
  constructor(database, priceTracker) {
    this.db = database;
    this.priceTracker = priceTracker;
  }

  async calculateComprehensivePnL() {
    try {
      logger.info('Starting comprehensive PnL calculation');

      const [holdings, recentTrades, currentPrices] = await Promise.all([
        this.db.getHoldings(),
        this.getRecentTrades(),
        this.db.getLatestPrices()
      ]);

      const plsPrice = this.priceTracker.getCachedPrice('PLS') || 
                      currentPrices.find(p => p.token_address === '0x0000000000000000000000000000000000000000');

      if (!plsPrice) {
        throw new Error('PLS price not available');
      }

      const results = {
        totalRealizedPnlPls: 0n,
        totalUnrealizedPnlPls: 0n,
        totalPnlUsd: 0,
        dailyPnlPls: 0n,
        weeklyPnlPls: 0n,
        activePositions: holdings.length,
        totalTrades: 0,
        tokenAnalysis: [],
        plsPrice: parseFloat(plsPrice.usd || plsPrice.price_usd)
      };

      // Calculate PnL for each holding
      for (const holding of holdings) {
        const tokenAnalysis = await this.calculateTokenPnL(holding, currentPrices, plsPrice);
        results.tokenAnalysis.push(tokenAnalysis);
        
        results.totalRealizedPnlPls += BigInt(tokenAnalysis.realizedPnlPls);
        results.totalUnrealizedPnlPls += BigInt(tokenAnalysis.unrealizedPnlPls);
        results.totalTrades += tokenAnalysis.tradeCount;
      }

      // Calculate daily and weekly PnL
      results.dailyPnlPls = await this.calculateDailyPnL();
      results.weeklyPnlPls = await this.calculateWeeklyPnL();

      // Convert total PnL to USD
      const totalPnlPls = results.totalRealizedPnlPls + results.totalUnrealizedPnlPls;
      results.totalPnlUsd = this.convertPlsToUsd(totalPnlPls, results.plsPrice);

      logger.info('PnL calculation completed');
      return results;
    } catch (error) {
      logger.error('Error calculating comprehensive PnL:', error.message);
      throw error;
    }
  }

  async calculateTokenPnL(holding, currentPrices, plsPrice) {
    try {
      const tokenPrice = currentPrices.find(p => p.token_address === holding.token_address);
      const currentTokenPricePls = tokenPrice ? parseFloat(tokenPrice.price_pls || 0) : 0;
      
      // Calculate unrealized PnL
      const currentBalance = BigInt(holding.current_balance);
      const avgBuyPrice = BigInt(holding.average_buy_price_pls);
      const currentValue = currentBalance * BigInt(Math.floor(currentTokenPricePls * 1e18)) / BigInt(1e18);
      const costBasis = currentBalance * avgBuyPrice / BigInt(1e18);
      const unrealizedPnlPls = currentValue - costBasis;

      // Calculate hold time
      const holdTime = this.calculateHoldTime(holding.first_buy_timestamp, holding.last_trade_timestamp);

      // Get trade statistics
      const tradeStats = await this.getTokenTradeStats(holding.token_address);

      // Calculate percentage returns
      const totalInvested = BigInt(holding.total_bought_pls);
      const realizedPnlPls = BigInt(holding.realized_pnl_pls);
      
      const realizedPercentage = totalInvested > 0n ? 
        Number(realizedPnlPls * 100n / totalInvested) : 0;
      
      const unrealizedPercentage = costBasis > 0n ? 
        Number(unrealizedPnlPls * 100n / costBasis) : 0;

      const totalPercentage = totalInvested > 0n ? 
        Number((realizedPnlPls + unrealizedPnlPls) * 100n / totalInvested) : 0;

      return {
        tokenAddress: holding.token_address,
        symbol: holding.symbol,
        name: holding.name || 'Unknown',
        tradeCount: holding.trade_count,
        holdTime: holdTime,
        currentBalance: holding.current_balance,
        averageBuyPricePls: holding.average_buy_price_pls,
        currentPricePls: currentTokenPricePls.toString(),
        totalInvestedPls: holding.total_bought_pls,
        totalSoldPls: holding.total_sold_pls,
        realizedPnlPls: holding.realized_pnl_pls,
        unrealizedPnlPls: unrealizedPnlPls.toString(),
        realizedPercentage: realizedPercentage,
        unrealizedPercentage: unrealizedPercentage,
        totalPercentage: totalPercentage,
        currentValueUsd: this.convertPlsToUsd(currentValue, parseFloat(plsPrice.usd || plsPrice.price_usd)),
        realizedPnlUsd: this.convertPlsToUsd(realizedPnlPls, parseFloat(plsPrice.usd || plsPrice.price_usd)),
        unrealizedPnlUsd: this.convertPlsToUsd(unrealizedPnlPls, parseFloat(plsPrice.usd || plsPrice.price_usd)),
        firstBuyDate: moment.unix(holding.first_buy_timestamp).format('YYYY-MM-DD HH:mm:ss'),
        lastTradeDate: moment.unix(holding.last_trade_timestamp).format('YYYY-MM-DD HH:mm:ss'),
        ...tradeStats
      };
    } catch (error) {
      logger.error(`Error calculating PnL for token ${holding.token_address}:`, error.message);
      throw error;
    }
  }

  async getTokenTradeStats(tokenAddress) {
    return new Promise((resolve, reject) => {
      this.db.db.all(
        `SELECT 
          COUNT(*) as total_trades,
          COUNT(CASE WHEN trade_type = 'BUY' THEN 1 END) as buy_count,
          COUNT(CASE WHEN trade_type = 'SELL' THEN 1 END) as sell_count,
          MIN(timestamp) as first_trade,
          MAX(timestamp) as last_trade,
          AVG(CASE WHEN trade_type = 'BUY' THEN CAST(price_per_token_pls AS REAL) END) as avg_buy_price,
          AVG(CASE WHEN trade_type = 'SELL' THEN CAST(price_per_token_pls AS REAL) END) as avg_sell_price
         FROM trades 
         WHERE token_address = ?`,
        [tokenAddress],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows[0] || {});
          }
        }
      );
    });
  }

  calculateHoldTime(firstBuyTimestamp, lastTradeTimestamp) {
    if (!firstBuyTimestamp) return 'N/A';
    
    const start = moment.unix(firstBuyTimestamp);
    const end = lastTradeTimestamp ? moment.unix(lastTradeTimestamp) : moment();
    
    const duration = moment.duration(end.diff(start));
    const days = Math.floor(duration.asDays());
    const hours = duration.hours();
    const minutes = duration.minutes();

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  async calculateDailyPnL() {
    try {
      const startOfDay = moment().startOf('day').unix();
      const trades = await this.db.getTradesSince(startOfDay);
      
      let dailyPnl = 0n;
      
      for (const trade of trades) {
        if (trade.trade_type === 'SELL') {
          // For sells, add the PLS received
          dailyPnl += BigInt(trade.pls_amount);
        } else if (trade.trade_type === 'BUY') {
          // For buys, subtract the PLS spent
          dailyPnl -= BigInt(trade.pls_amount);
        }
      }

      return dailyPnl;
    } catch (error) {
      logger.error('Error calculating daily PnL:', error.message);
      return 0n;
    }
  }

  async calculateWeeklyPnL() {
    try {
      const startOfWeek = moment().startOf('week').unix();
      const trades = await this.db.getTradesSince(startOfWeek);
      
      let weeklyPnl = 0n;
      
      for (const trade of trades) {
        if (trade.trade_type === 'SELL') {
          weeklyPnl += BigInt(trade.pls_amount);
        } else if (trade.trade_type === 'BUY') {
          weeklyPnl -= BigInt(trade.pls_amount);
        }
      }

      return weeklyPnl;
    } catch (error) {
      logger.error('Error calculating weekly PnL:', error.message);
      return 0n;
    }
  }

  async calculateWeeklyAverage() {
    try {
      // Get trades from the last 4 weeks to calculate average
      const fourWeeksAgo = moment().subtract(4, 'weeks').unix();
      const trades = await this.db.getTradesSince(fourWeeksAgo);
      
      // Group trades by week
      const weeklyTotals = {};
      
      for (const trade of trades) {
        const weekStart = moment.unix(trade.timestamp).startOf('week').format('YYYY-MM-DD');
        
        if (!weeklyTotals[weekStart]) {
          weeklyTotals[weekStart] = 0n;
        }
        
        if (trade.trade_type === 'SELL') {
          weeklyTotals[weekStart] += BigInt(trade.pls_amount);
        } else if (trade.trade_type === 'BUY') {
          weeklyTotals[weekStart] -= BigInt(trade.pls_amount);
        }
      }

      const weeks = Object.values(weeklyTotals);
      if (weeks.length === 0) return 0n;

      const totalPnl = weeks.reduce((sum, weekPnl) => sum + weekPnl, 0n);
      return totalPnl / BigInt(weeks.length);
    } catch (error) {
      logger.error('Error calculating weekly average:', error.message);
      return 0n;
    }
  }

  async getRecentTrades(days = 1) {
    const timestamp = moment().subtract(days, 'days').unix();
    return await this.db.getTradesSince(timestamp);
  }

  convertPlsToUsd(plsAmount, plsPrice) {
    if (typeof plsAmount === 'bigint') {
      const plsFloat = Number(plsAmount) / 1e18;
      return plsFloat * plsPrice;
    } else if (typeof plsAmount === 'string') {
      const plsFloat = parseFloat(plsAmount) / 1e18;
      return plsFloat * plsPrice;
    } else {
      return plsAmount * plsPrice;
    }
  }

  formatPnLDisplay(plsAmount, usdAmount, isPositive = null) {
    const pls = typeof plsAmount === 'bigint' ? Number(plsAmount) / 1e18 : parseFloat(plsAmount);
    const usd = parseFloat(usdAmount);
    
    const sign = isPositive !== null ? (isPositive ? '+' : '-') : (pls >= 0 ? '+' : '');
    const plsFormatted = Math.abs(pls).toLocaleString('en-US', { maximumFractionDigits: 2 });
    const usdFormatted = Math.abs(usd).toLocaleString('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 2 
    });

    return `${sign}${plsFormatted} PLS ~${usdFormatted}`;
  }

  calculateROI(initialInvestment, currentValue) {
    if (parseFloat(initialInvestment) === 0) return 0;
    
    const initial = parseFloat(initialInvestment);
    const current = parseFloat(currentValue);
    
    return ((current - initial) / initial) * 100;
  }

  async getPortfolioSummary() {
    try {
      const pnlData = await this.calculateComprehensivePnL();
      const weeklyAverage = await this.calculateWeeklyAverage();
      
      const totalPnlPls = pnlData.totalRealizedPnlPls + pnlData.totalUnrealizedPnlPls;
      
      return {
        totalPnL: {
          pls: totalPnlPls.toString(),
          usd: pnlData.totalPnlUsd,
          display: this.formatPnLDisplay(totalPnlPls, pnlData.totalPnlUsd)
        },
        realizedPnL: {
          pls: pnlData.totalRealizedPnlPls.toString(),
          usd: this.convertPlsToUsd(pnlData.totalRealizedPnlPls, pnlData.plsPrice),
          display: this.formatPnLDisplay(pnlData.totalRealizedPnlPls, this.convertPlsToUsd(pnlData.totalRealizedPnlPls, pnlData.plsPrice))
        },
        unrealizedPnL: {
          pls: pnlData.totalUnrealizedPnlPls.toString(),
          usd: this.convertPlsToUsd(pnlData.totalUnrealizedPnlPls, pnlData.plsPrice),
          display: this.formatPnLDisplay(pnlData.totalUnrealizedPnlPls, this.convertPlsToUsd(pnlData.totalUnrealizedPnlPls, pnlData.plsPrice))
        },
        dailyPnL: {
          pls: pnlData.dailyPnlPls.toString(),
          usd: this.convertPlsToUsd(pnlData.dailyPnlPls, pnlData.plsPrice),
          display: this.formatPnLDisplay(pnlData.dailyPnlPls, this.convertPlsToUsd(pnlData.dailyPnlPls, pnlData.plsPrice))
        },
        weeklyPnL: {
          pls: pnlData.weeklyPnlPls.toString(),
          usd: this.convertPlsToUsd(pnlData.weeklyPnlPls, pnlData.plsPrice),
          display: this.formatPnLDisplay(pnlData.weeklyPnlPls, this.convertPlsToUsd(pnlData.weeklyPnlPls, pnlData.plsPrice))
        },
        weeklyAverage: {
          pls: weeklyAverage.toString(),
          usd: this.convertPlsToUsd(weeklyAverage, pnlData.plsPrice),
          display: this.formatPnLDisplay(weeklyAverage, this.convertPlsToUsd(weeklyAverage, pnlData.plsPrice))
        },
        activePositions: pnlData.activePositions,
        totalTrades: pnlData.totalTrades,
        plsPrice: pnlData.plsPrice,
        lastUpdated: moment().format('YYYY-MM-DD HH:mm:ss'),
        tokens: pnlData.tokenAnalysis
      };
    } catch (error) {
      logger.error('Error generating portfolio summary:', error.message);
      throw error;
    }
  }

  async calculateTokenPnL(holding, currentPrices, plsPrice) {
    const tokenPrice = currentPrices.find(p => p.token_address === holding.token_address);
    const currentTokenPricePls = tokenPrice ? parseFloat(tokenPrice.price_pls || 0) : 0;
    const currentTokenPriceUsd = tokenPrice ? parseFloat(tokenPrice.price_usd || 0) : 0;
    
    // Calculate current position value
    const currentBalance = BigInt(holding.current_balance);
    const currentValuePls = currentBalance * BigInt(Math.floor(currentTokenPricePls * 1e18)) / BigInt(1e18);
    
    // Calculate cost basis
    const avgBuyPrice = BigInt(holding.average_buy_price_pls);
    const costBasis = currentBalance * avgBuyPrice / BigInt(1e18);
    
    // Calculate unrealized PnL
    const unrealizedPnlPls = currentValuePls - costBasis;
    const realizedPnlPls = BigInt(holding.realized_pnl_pls);
    
    // Calculate percentages
    const totalInvested = BigInt(holding.total_bought_pls);
    const realizedPercentage = totalInvested > 0n ? Number(realizedPnlPls * 100n / totalInvested) : 0;
    const unrealizedPercentage = costBasis > 0n ? Number(unrealizedPnlPls * 100n / costBasis) : 0;
    const totalPercentage = totalInvested > 0n ? Number((realizedPnlPls + unrealizedPnlPls) * 100n / totalInvested) : 0;

    // Get additional trade statistics
    const tradeStats = await this.getTokenTradeStats(holding.token_address);
    const holdTime = this.calculateHoldTime(holding.first_buy_timestamp, holding.last_trade_timestamp);

    return {
      tokenAddress: holding.token_address,
      symbol: holding.symbol,
      name: holding.name || 'Unknown',
      decimals: holding.decimals || 18,
      
      // Trading statistics
      tradeCount: holding.trade_count,
      buyCount: tradeStats.buy_count || 0,
      sellCount: tradeStats.sell_count || 0,
      
      // Timing
      holdTime: holdTime,
      firstBuyDate: moment.unix(holding.first_buy_timestamp).format('YYYY-MM-DD HH:mm:ss'),
      lastTradeDate: moment.unix(holding.last_trade_timestamp).format('YYYY-MM-DD HH:mm:ss'),
      
      // Position data
      currentBalance: this.formatTokenAmount(holding.current_balance, holding.decimals),
      currentBalanceRaw: holding.current_balance,
      
      // Prices
      averageBuyPricePls: this.formatPls(holding.average_buy_price_pls),
      currentPricePls: currentTokenPricePls.toFixed(8),
      currentPriceUsd: currentTokenPriceUsd.toFixed(8),
      
      // Investment amounts
      totalInvestedPls: this.formatPls(holding.total_bought_pls),
      totalSoldPls: this.formatPls(holding.total_sold_pls),
      currentValuePls: this.formatPls(currentValuePls.toString()),
      
      // PnL in PLS
      realizedPnlPls: holding.realized_pnl_pls,
      unrealizedPnlPls: unrealizedPnlPls.toString(),
      totalPnlPls: (realizedPnlPls + unrealizedPnlPls).toString(),
      
      // PnL in USD
      realizedPnlUsd: this.convertPlsToUsd(realizedPnlPls, parseFloat(plsPrice.usd || plsPrice.price_usd)),
      unrealizedPnlUsd: this.convertPlsToUsd(unrealizedPnlPls, parseFloat(plsPrice.usd || plsPrice.price_usd)),
      totalPnlUsd: this.convertPlsToUsd(realizedPnlPls + unrealizedPnlPls, parseFloat(plsPrice.usd || plsPrice.price_usd)),
      
      // Percentages
      realizedPercentage: realizedPercentage.toFixed(2),
      unrealizedPercentage: unrealizedPercentage.toFixed(2),
      totalPercentage: totalPercentage.toFixed(2),
      
      // Display formats
      realizedPnlDisplay: this.formatPnLDisplay(realizedPnlPls, this.convertPlsToUsd(realizedPnlPls, parseFloat(plsPrice.usd || plsPrice.price_usd))),
      unrealizedPnlDisplay: this.formatPnLDisplay(unrealizedPnlPls, this.convertPlsToUsd(unrealizedPnlPls, parseFloat(plsPrice.usd || plsPrice.price_usd))),
      totalPnlDisplay: this.formatPnLDisplay(realizedPnlPls + unrealizedPnlPls, this.convertPlsToUsd(realizedPnlPls + unrealizedPnlPls, parseFloat(plsPrice.usd || plsPrice.price_usd)))
    };
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

  async getRecentTrades(days = 7) {
    const timestamp = moment().subtract(days, 'days').unix();
    return await this.db.getTradesSince(timestamp);
  }
}

module.exports = PnLCalculator;