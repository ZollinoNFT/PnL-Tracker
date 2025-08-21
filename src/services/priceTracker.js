const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../../config/constants');

class PriceTracker {
  constructor(database) {
    this.db = database;
    this.priceCache = new Map();
    this.lastUpdate = null;
    this.rateLimitDelay = 1000; // 1 second between API calls
  }

  async updateAllPrices() {
    try {
      logger.info('Starting price update cycle');
      
      // Get PLS price first (most important)
      const plsPrice = await this.getPlsPrice();
      await this.storePriceData('0x0000000000000000000000000000000000000000', plsPrice.usd, null, 'coingecko');

      // Get all unique token addresses from holdings and recent trades
      const tokenAddresses = await this.getActiveTokenAddresses();
      
      logger.info(`Updating prices for ${tokenAddresses.length} tokens`);

      // Update prices for all active tokens
      for (const tokenAddress of tokenAddresses) {
        try {
          await this.delay(this.rateLimitDelay); // Rate limiting
          const tokenPrice = await this.getTokenPrice(tokenAddress);
          
          if (tokenPrice) {
            await this.storePriceData(
              tokenAddress, 
              tokenPrice.usd, 
              tokenPrice.pls, 
              tokenPrice.source
            );
          }
        } catch (error) {
          logger.error(`Error updating price for token ${tokenAddress}:`, error.message);
        }
      }

      this.lastUpdate = Date.now();
      logger.info('Price update cycle completed');
    } catch (error) {
      logger.error('Error in price update cycle:', error.message);
      throw error;
    }
  }

  async getPlsPrice() {
    try {
      // Try CoinGecko first
      const response = await axios.get(`${config.PRICE_APIS.COINGECKO}/simple/price`, {
        params: {
          ids: 'pulsechain',
          vs_currencies: 'usd',
          include_24hr_change: true
        },
        timeout: 10000
      });

      if (response.data.pulsechain) {
        const price = {
          usd: response.data.pulsechain.usd,
          change24h: response.data.pulsechain.usd_24h_change || 0,
          source: 'coingecko',
          timestamp: Math.floor(Date.now() / 1000)
        };

        this.priceCache.set('PLS', price);
        logger.info(`PLS price updated: $${price.usd}`);
        return price;
      }
    } catch (error) {
      logger.error('Error fetching PLS price from CoinGecko:', error.message);
    }

    // Fallback to DexScreener
    try {
      const response = await axios.get(`${config.PRICE_APIS.DEXSCREENER}/dex/tokens/0x0000000000000000000000000000000000000000`, {
        timeout: 10000
      });

      if (response.data.pairs && response.data.pairs.length > 0) {
        const pair = response.data.pairs[0];
        const price = {
          usd: parseFloat(pair.priceUsd || 0),
          change24h: parseFloat(pair.priceChange?.h24 || 0),
          source: 'dexscreener',
          timestamp: Math.floor(Date.now() / 1000)
        };

        this.priceCache.set('PLS', price);
        return price;
      }
    } catch (error) {
      logger.error('Error fetching PLS price from DexScreener:', error.message);
    }

    throw new Error('Unable to fetch PLS price from any source');
  }

  async getTokenPrice(tokenAddress) {
    try {
      // Try DexScreener first for memecoin prices
      const dexResponse = await axios.get(
        `${config.PRICE_APIS.DEXSCREENER}/dex/tokens/${tokenAddress}`,
        { timeout: 10000 }
      );

      if (dexResponse.data.pairs && dexResponse.data.pairs.length > 0) {
        // Find the pair with highest liquidity on PulseChain
        const pulsechainPairs = dexResponse.data.pairs.filter(pair => 
          pair.chainId === 'pulsechain' || pair.chainId === '369'
        );

        if (pulsechainPairs.length > 0) {
          const bestPair = pulsechainPairs.reduce((best, current) => 
            parseFloat(current.liquidity?.usd || 0) > parseFloat(best.liquidity?.usd || 0) ? current : best
          );

          const plsPrice = this.priceCache.get('PLS')?.usd || await this.getPlsPrice().then(p => p.usd);
          const tokenPriceUsd = parseFloat(bestPair.priceUsd || 0);
          const tokenPricePls = tokenPriceUsd / plsPrice;

          return {
            usd: tokenPriceUsd,
            pls: tokenPricePls,
            source: 'dexscreener',
            liquidity: parseFloat(bestPair.liquidity?.usd || 0),
            volume24h: parseFloat(bestPair.volume?.h24 || 0)
          };
        }
      }
    } catch (error) {
      logger.error(`DexScreener API error for ${tokenAddress}:`, error.message);
    }

    // Fallback to Moralis if available
    if (process.env.MORALIS_API_KEY) {
      try {
        const response = await axios.get(
          `${config.PRICE_APIS.MORALIS}/erc20/${tokenAddress}/price`,
          {
            headers: {
              'X-API-Key': process.env.MORALIS_API_KEY
            },
            params: {
              chain: 'pulsechain'
            },
            timeout: 10000
          }
        );

        if (response.data.usdPrice) {
          const plsPrice = this.priceCache.get('PLS')?.usd || await this.getPlsPrice().then(p => p.usd);
          const tokenPriceUsd = parseFloat(response.data.usdPrice);
          const tokenPricePls = tokenPriceUsd / plsPrice;

          return {
            usd: tokenPriceUsd,
            pls: tokenPricePls,
            source: 'moralis'
          };
        }
      } catch (error) {
        logger.error(`Moralis API error for ${tokenAddress}:`, error.message);
      }
    }

    logger.warn(`Could not fetch price for token ${tokenAddress}`);
    return null;
  }

  async getActiveTokenAddresses() {
    try {
      // Get tokens from current holdings
      const holdings = await this.db.getHoldings();
      const holdingAddresses = holdings.map(h => h.token_address);

      // Get tokens from recent trades (last 7 days)
      const recentTimestamp = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
      const recentTrades = await this.db.getTradesSince(recentTimestamp);
      const recentAddresses = [...new Set(recentTrades.map(t => t.token_address))];

      // Combine and deduplicate
      const allAddresses = [...new Set([...holdingAddresses, ...recentAddresses])];
      
      return allAddresses.filter(addr => addr !== config.PULSECHAIN.NATIVE_TOKEN.address);
    } catch (error) {
      logger.error('Error getting active token addresses:', error.message);
      return [];
    }
  }

  async storePriceData(tokenAddress, priceUsd, pricePls, source) {
    try {
      const priceData = {
        tokenAddress,
        priceUsd: priceUsd.toString(),
        pricePls: pricePls ? pricePls.toString() : null,
        timestamp: Math.floor(Date.now() / 1000),
        source
      };

      await this.db.insertPriceHistory(priceData);
      
      // Update cache
      this.priceCache.set(tokenAddress, {
        usd: priceUsd,
        pls: pricePls,
        timestamp: priceData.timestamp
      });
    } catch (error) {
      logger.error('Error storing price data:', error.message);
    }
  }

  getCachedPrice(tokenAddress) {
    return this.priceCache.get(tokenAddress);
  }

  async getHistoricalPrice(tokenAddress, timestamp) {
    return new Promise((resolve, reject) => {
      // Get the closest price to the requested timestamp
      this.db.db.get(
        `SELECT * FROM price_history 
         WHERE token_address = ? AND timestamp <= ? 
         ORDER BY timestamp DESC LIMIT 1`,
        [tokenAddress, timestamp],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  formatPrice(price, decimals = 6) {
    if (typeof price === 'string') {
      price = parseFloat(price);
    }
    return price.toFixed(decimals);
  }

  formatPriceDisplay(plsAmount, usdAmount) {
    const pls = parseFloat(plsAmount);
    const usd = parseFloat(usdAmount);
    
    // Format large numbers with appropriate suffixes
    const formatLargeNumber = (num) => {
      if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
      if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
      if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
      return num.toFixed(2);
    };

    const plsFormatted = formatLargeNumber(pls);
    const usdFormatted = formatLargeNumber(usd);
    
    return `${plsFormatted} PLS ~$${usdFormatted}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PriceTracker;