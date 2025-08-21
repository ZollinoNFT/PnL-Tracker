import axios from 'axios';
import { CONSTANTS } from '../config/constants.js';

class PriceService {
  constructor() {
    this.plsPrice = 0;
    this.priceHistory = new Map();
    this.lastUpdate = 0;
    this.updateInterval = 60000; // 1 minute
  }

  async init() {
    await this.updatePLSPrice();
    // Set up periodic price updates
    setInterval(() => {
      this.updatePLSPrice();
    }, this.updateInterval);
  }

  async updatePLSPrice() {
    try {
      // Try multiple sources for PLS price
      const price = await this.fetchPLSPriceFromMultipleSources();
      
      if (price > 0) {
        this.plsPrice = price;
        this.lastUpdate = Date.now();
        
        // Store price history
        const timestamp = new Date().toISOString().split('T')[0];
        if (!this.priceHistory.has(timestamp)) {
          this.priceHistory.set(timestamp, []);
        }
        this.priceHistory.get(timestamp).push({
          timestamp: Date.now(),
          price: price
        });
        
        console.log(`PLS price updated: $${price.toFixed(6)}`);
      }
    } catch (error) {
      console.error('Error updating PLS price:', error.message);
    }
  }

  async fetchPLSPriceFromMultipleSources() {
    const sources = [
      () => this.fetchFromCoinGecko(),
      () => this.fetchFromPulseX(),
      () => this.fetchFromDEXScreener(),
      () => this.fetchFromCoinMarketCap()
    ];

    for (const source of sources) {
      try {
        const price = await source();
        if (price > 0) {
          return price;
        }
      } catch (error) {
        console.warn('Price source failed:', error.message);
        continue;
      }
    }

    throw new Error('All price sources failed');
  }

  async fetchFromCoinGecko() {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: CONSTANTS.COINGECKO_PLS_ID,
          vs_currencies: 'usd'
        },
        timeout: 5000
      });

      return response.data[CONSTANTS.COINGECKO_PLS_ID]?.usd || 0;
    } catch (error) {
      throw new Error(`CoinGecko API error: ${error.message}`);
    }
  }

  async fetchFromPulseX() {
    try {
      // This would need to be implemented based on PulseX API
      // For now, return 0 to fall back to other sources
      return 0;
    } catch (error) {
      throw new Error(`PulseX API error: ${error.message}`);
    }
  }

  async fetchFromDEXScreener() {
    try {
      const response = await axios.get('https://api.dexscreener.com/latest/dex/tokens/' + CONSTANTS.PLS_CONTRACT_ADDRESS, {
        timeout: 5000
      });

      const pairs = response.data?.pairs || [];
      const plsPair = pairs.find(pair => 
        pair.chainId === 'pulsechain' && 
        pair.baseToken?.address?.toLowerCase() === CONSTANTS.PLS_CONTRACT_ADDRESS.toLowerCase()
      );

      return parseFloat(plsPair?.priceUsd || 0);
    } catch (error) {
      throw new Error(`DEXScreener API error: ${error.message}`);
    }
  }

  async fetchFromCoinMarketCap() {
    try {
      // This would require CMC API key
      // For now, return 0 to fall back to other sources
      return 0;
    } catch (error) {
      throw new Error(`CoinMarketCap API error: ${error.message}`);
    }
  }

  getCurrentPLSPrice() {
    return this.plsPrice;
  }

  convertPLSToUSD(plsAmount) {
    return plsAmount * this.plsPrice;
  }

  convertUSDToPLS(usdAmount) {
    return this.plsPrice > 0 ? usdAmount / this.plsPrice : 0;
  }

  formatPLSAmount(amount) {
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(2) + 'M';
    } else if (amount >= 1000) {
      return (amount / 1000).toFixed(2) + 'K';
    } else {
      return amount.toFixed(2);
    }
  }

  formatUSDAmount(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(amount);
  }

  getPriceHistory(days = 7) {
    const result = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      
      const dayPrices = this.priceHistory.get(dateKey) || [];
      if (dayPrices.length > 0) {
        const avgPrice = dayPrices.reduce((sum, p) => sum + p.price, 0) / dayPrices.length;
        result.push({
          date: dateKey,
          price: avgPrice,
          samples: dayPrices.length
        });
      }
    }
    
    return result;
  }

  getLastUpdateTime() {
    return this.lastUpdate;
  }

  isStale() {
    return Date.now() - this.lastUpdate > this.updateInterval * 2;
  }
}

export default new PriceService();