import Big from 'big.js';
import priceService from './priceService.js';
import web3Provider from '../utils/web3Provider.js';

class PnLCalculator {
  constructor() {
    this.positions = new Map();
    this.realizedPnL = new Map();
    this.tradeHistory = new Map();
  }

  async calculatePnL(transactions) {
    this.reset();
    
    // Sort transactions by timestamp
    const sortedTransactions = transactions.sort((a, b) => a.timestamp - b.timestamp);
    
    // Process each transaction
    for (const tx of sortedTransactions) {
      await this.processTransaction(tx);
    }
    
    // Update unrealized PnL for current positions
    await this.updateUnrealizedPnL();
    
    return this.generatePnLReport();
  }

  reset() {
    this.positions.clear();
    this.realizedPnL.clear();
    this.tradeHistory.clear();
  }

  async processTransaction(tx) {
    const tokenAddress = tx.tokenAddress.toLowerCase();
    
    if (!this.positions.has(tokenAddress)) {
      this.positions.set(tokenAddress, {
        tokenInfo: tx.tokenInfo,
        totalBought: new Big(0),
        totalSold: new Big(0),
        averageBuyPrice: new Big(0),
        averageSellPrice: new Big(0),
        currentHolding: new Big(0),
        totalPLSSpent: new Big(0),
        totalPLSReceived: new Big(0),
        buyTransactions: [],
        sellTransactions: [],
        firstTradeTime: tx.timestamp,
        lastTradeTime: tx.timestamp,
        tradeCount: 0
      });
    }
    
    if (!this.tradeHistory.has(tokenAddress)) {
      this.tradeHistory.set(tokenAddress, []);
    }
    
    const position = this.positions.get(tokenAddress);
    const history = this.tradeHistory.get(tokenAddress);
    
    // Update trade count and timing
    position.tradeCount++;
    position.lastTradeTime = tx.timestamp;
    
    const tokenAmount = new Big(tx.tokenAmount);
    const plsAmount = new Big(tx.plsAmount);
    
    if (tx.isBuy) {
      await this.processBuyTransaction(position, tokenAmount, plsAmount, tx);
    } else {
      await this.processSellTransaction(position, tokenAmount, plsAmount, tx);
    }
    
    // Add to trade history
    history.push({
      timestamp: tx.timestamp,
      type: tx.isBuy ? 'BUY' : 'SELL',
      tokenAmount: tokenAmount.toString(),
      plsAmount: plsAmount.toString(),
      price: new Big(tx.price).toString(),
      txHash: tx.hash
    });
  }

  async processBuyTransaction(position, tokenAmount, plsAmount, tx) {
    // Update totals
    position.totalBought = position.totalBought.add(tokenAmount);
    position.totalPLSSpent = position.totalPLSSpent.add(plsAmount);
    position.currentHolding = position.currentHolding.add(tokenAmount);
    
    // Calculate new average buy price
    if (position.totalBought.gt(0)) {
      position.averageBuyPrice = position.totalPLSSpent.div(position.totalBought);
    }
    
    // Add to buy transactions
    position.buyTransactions.push({
      timestamp: tx.timestamp,
      tokenAmount: tokenAmount.toString(),
      plsAmount: plsAmount.toString(),
      price: plsAmount.div(tokenAmount).toString(),
      txHash: tx.hash
    });
  }

  async processSellTransaction(position, tokenAmount, plsAmount, tx) {
    // Update totals
    position.totalSold = position.totalSold.add(tokenAmount);
    position.totalPLSReceived = position.totalPLSReceived.add(plsAmount);
    position.currentHolding = position.currentHolding.sub(tokenAmount);
    
    // Calculate average sell price
    if (position.totalSold.gt(0)) {
      position.averageSellPrice = position.totalPLSReceived.div(position.totalSold);
    }
    
    // Calculate realized PnL for this sale
    const costBasis = position.averageBuyPrice.mul(tokenAmount);
    const saleProceeds = plsAmount;
    const realizedPnL = saleProceeds.sub(costBasis);
    
    // Update realized PnL
    const tokenAddress = tx.tokenAddress.toLowerCase();
    if (!this.realizedPnL.has(tokenAddress)) {
      this.realizedPnL.set(tokenAddress, new Big(0));
    }
    this.realizedPnL.set(tokenAddress, this.realizedPnL.get(tokenAddress).add(realizedPnL));
    
    // Add to sell transactions
    position.sellTransactions.push({
      timestamp: tx.timestamp,
      tokenAmount: tokenAmount.toString(),
      plsAmount: plsAmount.toString(),
      price: plsAmount.div(tokenAmount).toString(),
      realizedPnL: realizedPnL.toString(),
      txHash: tx.hash
    });
  }

  async updateUnrealizedPnL() {
    for (const [tokenAddress, position] of this.positions) {
      if (position.currentHolding.gt(0)) {
        try {
          // Get current token price in PLS
          const currentPrice = await this.getCurrentTokenPrice(tokenAddress, position.tokenInfo);
          
          if (currentPrice > 0) {
            const currentValue = position.currentHolding.mul(new Big(currentPrice));
            const costBasis = position.averageBuyPrice.mul(position.currentHolding);
            position.unrealizedPnL = currentValue.sub(costBasis);
            position.currentPrice = currentPrice;
          } else {
            position.unrealizedPnL = new Big(0);
            position.currentPrice = 0;
          }
        } catch (error) {
          console.warn(`Error getting current price for ${tokenAddress}:`, error.message);
          position.unrealizedPnL = new Big(0);
          position.currentPrice = 0;
        }
      } else {
        position.unrealizedPnL = new Big(0);
        position.currentPrice = 0;
      }
    }
  }

  async getCurrentTokenPrice(tokenAddress, tokenInfo) {
    try {
      // This would need to query DEX pairs to get current price
      // For now, return 0 as placeholder
      // In a real implementation, you'd query PulseX pairs or other DEXs
      return 0;
    } catch (error) {
      console.warn('Error getting current token price:', error.message);
      return 0;
    }
  }

  generatePnLReport() {
    const report = {
      summary: {
        totalRealizedPnL: new Big(0),
        totalUnrealizedPnL: new Big(0),
        totalPnL: new Big(0),
        totalTrades: 0,
        activePositions: 0,
        closedPositions: 0
      },
      positions: [],
      dailyPnL: this.calculateDailyPnL(),
      weeklyPnL: this.calculateWeeklyPnL()
    };

    for (const [tokenAddress, position] of this.positions) {
      const realizedPnL = this.realizedPnL.get(tokenAddress) || new Big(0);
      const unrealizedPnL = position.unrealizedPnL || new Big(0);
      const totalPnL = realizedPnL.add(unrealizedPnL);
      
      // Calculate percentages
      const realizedPnLPercent = position.totalPLSSpent.gt(0) 
        ? realizedPnL.div(position.totalPLSSpent).mul(100) 
        : new Big(0);
      
      const unrealizedPnLPercent = position.averageBuyPrice.gt(0) && position.currentHolding.gt(0)
        ? unrealizedPnL.div(position.averageBuyPrice.mul(position.currentHolding)).mul(100)
        : new Big(0);
      
      const totalPnLPercent = position.totalPLSSpent.gt(0)
        ? totalPnL.div(position.totalPLSSpent).mul(100)
        : new Big(0);

      // Calculate hold time
      const holdTime = position.lastTradeTime - position.firstTradeTime;
      const holdDays = Math.floor(holdTime / (1000 * 60 * 60 * 24));
      const holdHours = Math.floor((holdTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      const positionReport = {
        tokenAddress,
        tokenInfo: position.tokenInfo,
        totalBought: position.totalBought.toString(),
        totalSold: position.totalSold.toString(),
        currentHolding: position.currentHolding.toString(),
        averageBuyPrice: position.averageBuyPrice.toString(),
        averageSellPrice: position.averageSellPrice.toString(),
        currentPrice: position.currentPrice,
        totalPLSSpent: position.totalPLSSpent.toString(),
        totalPLSReceived: position.totalPLSReceived.toString(),
        realizedPnL: realizedPnL.toString(),
        unrealizedPnL: unrealizedPnL.toString(),
        totalPnL: totalPnL.toString(),
        realizedPnLPercent: realizedPnLPercent.toString(),
        unrealizedPnLPercent: unrealizedPnLPercent.toString(),
        totalPnLPercent: totalPnLPercent.toString(),
        tradeCount: position.tradeCount,
        holdTime: {
          days: holdDays,
          hours: holdHours,
          total: holdTime
        },
        isActive: position.currentHolding.gt(0),
        buyTransactions: position.buyTransactions,
        sellTransactions: position.sellTransactions
      };

      report.positions.push(positionReport);
      
      // Update summary
      report.summary.totalRealizedPnL = report.summary.totalRealizedPnL.add(realizedPnL);
      report.summary.totalUnrealizedPnL = report.summary.totalUnrealizedPnL.add(unrealizedPnL);
      report.summary.totalTrades += position.tradeCount;
      
      if (position.currentHolding.gt(0)) {
        report.summary.activePositions++;
      } else {
        report.summary.closedPositions++;
      }
    }

    report.summary.totalPnL = report.summary.totalRealizedPnL.add(report.summary.totalUnrealizedPnL);

    // Convert summary to strings
    report.summary.totalRealizedPnL = report.summary.totalRealizedPnL.toString();
    report.summary.totalUnrealizedPnL = report.summary.totalUnrealizedPnL.toString();
    report.summary.totalPnL = report.summary.totalPnL.toString();

    return report;
  }

  calculateDailyPnL() {
    const dailyPnL = new Map();
    const today = new Date();
    
    // Calculate for the last 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      
      let dayPnL = new Big(0);
      
      // Sum up all realized PnL from trades on this day
      for (const [tokenAddress, history] of this.tradeHistory) {
        const dayTrades = history.filter(trade => {
          const tradeDate = new Date(trade.timestamp).toISOString().split('T')[0];
          return tradeDate === dateKey && trade.type === 'SELL';
        });
        
        for (const trade of dayTrades) {
          // Find corresponding sell transaction to get realized PnL
          const position = this.positions.get(tokenAddress);
          const sellTx = position.sellTransactions.find(tx => tx.txHash === trade.txHash);
          if (sellTx) {
            dayPnL = dayPnL.add(new Big(sellTx.realizedPnL));
          }
        }
      }
      
      dailyPnL.set(dateKey, dayPnL.toString());
    }
    
    return Object.fromEntries(dailyPnL);
  }

  calculateWeeklyPnL() {
    const weeklyPnL = new Map();
    const today = new Date();
    
    // Calculate for the last 12 weeks
    for (let i = 0; i < 12; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + i * 7));
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      const weekKey = `${weekStart.toISOString().split('T')[0]}_to_${weekEnd.toISOString().split('T')[0]}`;
      
      let weekPnL = new Big(0);
      
      // Sum up all realized PnL from trades in this week
      for (const [tokenAddress, history] of this.tradeHistory) {
        const weekTrades = history.filter(trade => 
          trade.timestamp >= weekStart.getTime() && 
          trade.timestamp <= weekEnd.getTime() && 
          trade.type === 'SELL'
        );
        
        for (const trade of weekTrades) {
          const position = this.positions.get(tokenAddress);
          const sellTx = position.sellTransactions.find(tx => tx.txHash === trade.txHash);
          if (sellTx) {
            weekPnL = weekPnL.add(new Big(sellTx.realizedPnL));
          }
        }
      }
      
      weeklyPnL.set(weekKey, weekPnL.toString());
    }
    
    return Object.fromEntries(weeklyPnL);
  }

  formatPnLForDisplay(pnlAmount, includeUSD = true) {
    const plsAmount = parseFloat(pnlAmount);
    const formattedPLS = priceService.formatPLSAmount(plsAmount);
    
    if (includeUSD) {
      const usdAmount = priceService.convertPLSToUSD(plsAmount);
      const formattedUSD = priceService.formatUSDAmount(usdAmount);
      return `${plsAmount >= 0 ? '+' : ''}${formattedPLS} PLS (~${formattedUSD})`;
    }
    
    return `${plsAmount >= 0 ? '+' : ''}${formattedPLS} PLS`;
  }
}

export default new PnLCalculator();