import moralisClient from '../api/moralisClient.js';
import coingeckoClient from '../api/coingeckoClient.js';
import pulsechainRPC from '../api/pulsechainRPC.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

class TokenAnalytics {
    constructor() {
        this.walletAddress = config.wallet.address;
        this.trackingStartDate = config.tracking.startDate;
        this.tokenCache = new Map();
        this.priceCache = new Map();
        this.lastPriceUpdate = null;
    }

    // Fetch all token transfers for the wallet
    async fetchTokenTransfers() {
        try {
            logger.info('Fetching token transfers from Moralis...');
            const transfers = await moralisClient.getTokenTransfers(
                this.walletAddress,
                config.wallet.trackingStartDate
            );
            
            logger.info(`Fetched ${transfers.length} token transfers`);
            return transfers;
        } catch (error) {
            logger.error(`Failed to fetch token transfers: ${error.message}`);
            return [];
        }
    }

    // Fetch current token balances
    async fetchTokenBalances() {
        try {
            logger.info('Fetching current token balances...');
            const balances = await moralisClient.getWalletTokenBalances(this.walletAddress);
            
            logger.info(`Fetched ${balances.length} token balances`);
            return balances;
        } catch (error) {
            logger.error(`Failed to fetch token balances: ${error.message}`);
            return [];
        }
    }

    // Get token metadata with caching
    async getTokenMetadata(tokenAddress) {
        const cacheKey = tokenAddress.toLowerCase();
        
        if (this.tokenCache.has(cacheKey)) {
            return this.tokenCache.get(cacheKey);
        }
        
        try {
            // Try Moralis first
            let metadata = await moralisClient.getTokenMetadata(tokenAddress);
            
            // If Moralis fails, try RPC
            if (!metadata) {
                metadata = await pulsechainRPC.getTokenMetadata(tokenAddress);
            }
            
            if (metadata) {
                this.tokenCache.set(cacheKey, metadata);
            }
            
            return metadata;
        } catch (error) {
            logger.error(`Failed to get token metadata for ${tokenAddress}: ${error.message}`);
            return null;
        }
    }

    // Get current token prices
    async fetchTokenPrices(tokenAddresses) {
        try {
            logger.info(`Fetching prices for ${tokenAddresses.length} tokens...`);
            
            // Filter out blacklisted tokens
            const filteredAddresses = tokenAddresses.filter(
                addr => !config.tracking.blacklistedTokens.includes(addr.toLowerCase())
            );
            
            // Try CoinGecko first for better price data
            const coingeckoPrices = await coingeckoClient.getMultipleTokenPrices(
                filteredAddresses,
                config.tracking.displayCurrency.toLowerCase()
            );
            
            // For tokens not found on CoinGecko, try Moralis
            const missingTokens = filteredAddresses.filter(
                addr => !coingeckoPrices[addr.toLowerCase()]
            );
            
            let moralisPrices = {};
            if (missingTokens.length > 0) {
                moralisPrices = await moralisClient.getMultipleTokenPrices(missingTokens);
            }
            
            // Combine prices
            const allPrices = { ...coingeckoPrices };
            
            for (const [address, priceData] of Object.entries(moralisPrices)) {
                if (priceData && priceData.usdPrice) {
                    allPrices[address.toLowerCase()] = {
                        [config.tracking.displayCurrency.toLowerCase()]: priceData.usdPrice
                    };
                }
            }
            
            // Update cache
            this.priceCache = new Map(Object.entries(allPrices));
            this.lastPriceUpdate = new Date();
            
            logger.info(`Successfully fetched prices for ${Object.keys(allPrices).length} tokens`);
            return allPrices;
        } catch (error) {
            logger.error(`Failed to fetch token prices: ${error.message}`);
            return {};
        }
    }

    // Get PLS price
    async getPLSPrice() {
        try {
            const plsPrice = await coingeckoClient.getPLSPrice([config.tracking.displayCurrency.toLowerCase()]);
            return plsPrice?.[config.tracking.displayCurrency.toLowerCase()] || 0;
        } catch (error) {
            logger.error(`Failed to get PLS price: ${error.message}`);
            return 0;
        }
    }

    // Analyze token performance
    analyzeTokenPerformance(tokenStats) {
        const performanceMetrics = [];
        
        for (const stats of tokenStats) {
            const winRate = stats.sellCount > 0 
                ? (stats.realizedPNL > 0 ? 100 : 0) 
                : 0;
            
            const roi = stats.totalBought > 0 
                ? ((stats.totalSold - stats.totalBought) / stats.totalBought) * 100 
                : 0;
            
            performanceMetrics.push({
                ...stats,
                winRate,
                roi,
                totalTransactions: stats.buyCount + stats.sellCount,
                netPosition: stats.currentBalance,
                profitability: stats.totalPNL > 0 ? 'Profitable' : 'Loss'
            });
        }
        
        // Sort by total PNL
        performanceMetrics.sort((a, b) => b.totalPNL - a.totalPNL);
        
        return performanceMetrics;
    }

    // Get transaction history with details
    async getDetailedTransactionHistory() {
        try {
            const transfers = await this.fetchTokenTransfers();
            const detailedTransfers = [];
            
            for (const transfer of transfers) {
                const metadata = await this.getTokenMetadata(transfer.token_address);
                
                detailedTransfers.push({
                    ...transfer,
                    tokenName: metadata?.name || transfer.token_name,
                    tokenSymbol: metadata?.symbol || transfer.token_symbol,
                    tokenDecimals: metadata?.decimals || transfer.token_decimals,
                    direction: transfer.to_address?.toLowerCase() === this.walletAddress ? 'IN' : 'OUT',
                    type: transfer.to_address?.toLowerCase() === this.walletAddress ? 'BUY' : 'SELL'
                });
            }
            
            return detailedTransfers;
        } catch (error) {
            logger.error(`Failed to get detailed transaction history: ${error.message}`);
            return [];
        }
    }

    // Calculate gas fees spent
    async calculateGasFees(transactions) {
        let totalGasInPLS = 0;
        
        for (const tx of transactions) {
            if (tx.gas && tx.gas_price) {
                const gasUsed = parseFloat(tx.gas);
                const gasPrice = parseFloat(tx.gas_price);
                totalGasInPLS += (gasUsed * gasPrice) / 1e18; // Convert from wei to PLS
            }
        }
        
        return totalGasInPLS;
    }

    // Get summary statistics
    async getSummaryStatistics(tokenPNLs, plsPrice) {
        const totalTokens = tokenPNLs.length;
        const profitableTokens = tokenPNLs.filter(t => t.totalPNL > 0).length;
        const lossTokens = tokenPNLs.filter(t => t.totalPNL < 0).length;
        
        const bestPerformer = tokenPNLs[0]; // Already sorted by PNL
        const worstPerformer = tokenPNLs[tokenPNLs.length - 1];
        
        const totalBuyTransactions = tokenPNLs.reduce((sum, t) => sum + t.buyCount, 0);
        const totalSellTransactions = tokenPNLs.reduce((sum, t) => sum + t.sellCount, 0);
        
        const avgHoldingTime = tokenPNLs.reduce((sum, t) => sum + (t.avgHoldingDays || 0), 0) / totalTokens;
        
        return {
            totalTokensTraded: totalTokens,
            profitableTokens,
            lossTokens,
            winRate: (profitableTokens / totalTokens) * 100,
            bestPerformer: bestPerformer ? {
                name: bestPerformer.name,
                symbol: bestPerformer.symbol,
                pnl: bestPerformer.totalPNL,
                pnlUSD: bestPerformer.totalPNL * plsPrice
            } : null,
            worstPerformer: worstPerformer ? {
                name: worstPerformer.name,
                symbol: worstPerformer.symbol,
                pnl: worstPerformer.totalPNL,
                pnlUSD: worstPerformer.totalPNL * plsPrice
            } : null,
            totalBuyTransactions,
            totalSellTransactions,
            totalTransactions: totalBuyTransactions + totalSellTransactions,
            avgHoldingTime
        };
    }
}

export default new TokenAnalytics();