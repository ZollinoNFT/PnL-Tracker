import config from '../config/config.js';
import logger from '../utils/logger.js';

class PNLCalculator {
    constructor() {
        this.transactions = new Map(); // token -> array of transactions
        this.tokenStats = new Map(); // token -> statistics
        this.blacklistedTokens = new Set(config.tracking.blacklistedTokens);
    }

    // Process a transaction and categorize it
    processTransaction(tx, tokenMetadata) {
        const tokenAddress = tx.token_address?.toLowerCase();
        
        // Skip blacklisted tokens
        if (this.blacklistedTokens.has(tokenAddress)) {
            return;
        }
        
        if (!this.transactions.has(tokenAddress)) {
            this.transactions.set(tokenAddress, []);
            this.tokenStats.set(tokenAddress, {
                tokenAddress,
                name: tokenMetadata?.name || tx.token_name || 'Unknown',
                symbol: tokenMetadata?.symbol || tx.token_symbol || 'UNKNOWN',
                decimals: tokenMetadata?.decimals || tx.token_decimals || 18,
                totalBought: 0,
                totalSold: 0,
                buyCount: 0,
                sellCount: 0,
                avgBuyPrice: 0,
                avgSellPrice: 0,
                realizedPNL: 0,
                unrealizedPNL: 0,
                currentBalance: 0,
                firstTransactionDate: null,
                lastTransactionDate: null,
                transactions: []
            });
        }
        
        const stats = this.tokenStats.get(tokenAddress);
        const amount = parseFloat(tx.value) / Math.pow(10, stats.decimals);
        const timestamp = new Date(tx.block_timestamp);
        
        // Determine if it's a buy or sell based on to/from addresses
        const isBuy = tx.to_address?.toLowerCase() === config.wallet.address;
        
        const transaction = {
            hash: tx.transaction_hash,
            type: isBuy ? 'buy' : 'sell',
            amount,
            price: tx.price || 0, // Will be updated with price data
            value: tx.value_usd || 0,
            timestamp,
            blockNumber: tx.block_number,
            gasUsed: tx.gas || 0,
            gasPrice: tx.gas_price || 0
        };
        
        this.transactions.get(tokenAddress).push(transaction);
        stats.transactions.push(transaction);
        
        // Update statistics
        if (isBuy) {
            stats.totalBought += amount;
            stats.buyCount++;
            stats.currentBalance += amount;
        } else {
            stats.totalSold += amount;
            stats.sellCount++;
            stats.currentBalance -= amount;
        }
        
        // Update dates
        if (!stats.firstTransactionDate || timestamp < stats.firstTransactionDate) {
            stats.firstTransactionDate = timestamp;
        }
        if (!stats.lastTransactionDate || timestamp > stats.lastTransactionDate) {
            stats.lastTransactionDate = timestamp;
        }
    }

    // Calculate PNL for a specific token
    calculateTokenPNL(tokenAddress, currentPrice) {
        const stats = this.tokenStats.get(tokenAddress);
        if (!stats) return null;
        
        const transactions = this.transactions.get(tokenAddress) || [];
        
        // Calculate using FIFO (First In, First Out) method
        const buyQueue = [];
        let totalBuyCost = 0;
        let totalSellRevenue = 0;
        let totalBuyAmount = 0;
        let totalSellAmount = 0;
        
        // Sort transactions by timestamp
        const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
        
        for (const tx of sortedTxs) {
            if (tx.type === 'buy') {
                buyQueue.push({
                    amount: tx.amount,
                    price: tx.price || currentPrice,
                    remaining: tx.amount
                });
                totalBuyCost += tx.amount * (tx.price || currentPrice);
                totalBuyAmount += tx.amount;
            } else if (tx.type === 'sell') {
                let sellAmount = tx.amount;
                const sellPrice = tx.price || currentPrice;
                totalSellAmount += sellAmount;
                
                // Match sells with buys (FIFO)
                while (sellAmount > 0 && buyQueue.length > 0) {
                    const buy = buyQueue[0];
                    
                    if (buy.remaining <= sellAmount) {
                        // Fully consume this buy
                        totalSellRevenue += buy.remaining * sellPrice;
                        sellAmount -= buy.remaining;
                        buyQueue.shift();
                    } else {
                        // Partially consume this buy
                        totalSellRevenue += sellAmount * sellPrice;
                        buy.remaining -= sellAmount;
                        sellAmount = 0;
                    }
                }
                
                // If we still have sell amount left, it means we sold more than we bought
                // This shouldn't happen in normal circumstances
                if (sellAmount > 0) {
                    totalSellRevenue += sellAmount * sellPrice;
                }
            }
        }
        
        // Calculate average prices
        stats.avgBuyPrice = totalBuyAmount > 0 ? totalBuyCost / totalBuyAmount : 0;
        stats.avgSellPrice = totalSellAmount > 0 ? totalSellRevenue / totalSellAmount : 0;
        
        // Calculate realized PNL (from sold tokens)
        const realizedCost = (totalBuyAmount - stats.currentBalance) * stats.avgBuyPrice;
        stats.realizedPNL = totalSellRevenue - realizedCost;
        
        // Calculate unrealized PNL (from held tokens)
        const remainingCost = buyQueue.reduce((sum, buy) => sum + (buy.remaining * buy.price), 0);
        const currentValue = stats.currentBalance * currentPrice;
        stats.unrealizedPNL = currentValue - remainingCost;
        
        // Total PNL
        stats.totalPNL = stats.realizedPNL + stats.unrealizedPNL;
        
        // Calculate holding time
        if (stats.firstTransactionDate && stats.lastTransactionDate) {
            const holdingTime = stats.lastTransactionDate - stats.firstTransactionDate;
            stats.avgHoldingDays = holdingTime / (1000 * 60 * 60 * 24);
        } else {
            stats.avgHoldingDays = 0;
        }
        
        return stats;
    }

    // Calculate total PNL across all tokens
    calculateTotalPNL(tokenPrices) {
        let totalRealizedPNL = 0;
        let totalUnrealizedPNL = 0;
        const tokenPNLs = [];
        
        for (const [tokenAddress, stats] of this.tokenStats) {
            const currentPrice = tokenPrices[tokenAddress] || 0;
            const tokenPNL = this.calculateTokenPNL(tokenAddress, currentPrice);
            
            if (tokenPNL) {
                totalRealizedPNL += tokenPNL.realizedPNL;
                totalUnrealizedPNL += tokenPNL.unrealizedPNL;
                tokenPNLs.push(tokenPNL);
            }
        }
        
        return {
            totalRealizedPNL,
            totalUnrealizedPNL,
            totalPNL: totalRealizedPNL + totalUnrealizedPNL,
            tokenPNLs,
            tokenCount: tokenPNLs.length
        };
    }

    // Get PNL summary for different time periods
    getPNLSummary(tokenPrices) {
        const now = new Date();
        const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
        
        const summaries = {
            daily: { realized: 0, unrealized: 0, total: 0, transactions: 0 },
            weekly: { realized: 0, unrealized: 0, total: 0, transactions: 0 },
            monthly: { realized: 0, unrealized: 0, total: 0, transactions: 0 },
            allTime: { realized: 0, unrealized: 0, total: 0, transactions: 0 }
        };
        
        for (const [tokenAddress, transactions] of this.transactions) {
            const currentPrice = tokenPrices[tokenAddress] || 0;
            
            for (const tx of transactions) {
                const txValue = tx.amount * (tx.price || currentPrice);
                const pnl = tx.type === 'sell' ? txValue : -txValue;
                
                summaries.allTime.total += pnl;
                summaries.allTime.transactions++;
                
                if (tx.timestamp >= dayAgo) {
                    summaries.daily.total += pnl;
                    summaries.daily.transactions++;
                }
                if (tx.timestamp >= weekAgo) {
                    summaries.weekly.total += pnl;
                    summaries.weekly.transactions++;
                }
                if (tx.timestamp >= monthAgo) {
                    summaries.monthly.total += pnl;
                    summaries.monthly.transactions++;
                }
            }
        }
        
        return summaries;
    }

    // Add token to blacklist
    addToBlacklist(tokenAddress) {
        this.blacklistedTokens.add(tokenAddress.toLowerCase());
        // Remove from existing data
        this.transactions.delete(tokenAddress.toLowerCase());
        this.tokenStats.delete(tokenAddress.toLowerCase());
    }

    // Remove token from blacklist
    removeFromBlacklist(tokenAddress) {
        this.blacklistedTokens.delete(tokenAddress.toLowerCase());
    }

    // Clear all data
    clearData() {
        this.transactions.clear();
        this.tokenStats.clear();
    }
}

export default PNLCalculator;