import axios from 'axios';
import web3Provider from '../utils/web3Provider.js';
import fs from 'fs-extra';
import path from 'path';

class TokenMetadataService {
  constructor() {
    this.metadataCache = new Map();
    this.cacheFile = './data/token_metadata_cache.json';
    this.loadCache();
  }

  async loadCache() {
    try {
      if (await fs.pathExists(this.cacheFile)) {
        const cacheData = await fs.readJson(this.cacheFile);
        this.metadataCache = new Map(Object.entries(cacheData));
        console.log(`Loaded ${this.metadataCache.size} cached token metadata entries`);
      }
    } catch (error) {
      console.warn('Error loading metadata cache:', error.message);
    }
  }

  async saveCache() {
    try {
      await fs.ensureDir(path.dirname(this.cacheFile));
      const cacheData = Object.fromEntries(this.metadataCache);
      await fs.writeJson(this.cacheFile, cacheData, { spaces: 2 });
    } catch (error) {
      console.error('Error saving metadata cache:', error.message);
    }
  }

  async getTokenMetadata(tokenAddress) {
    const address = tokenAddress.toLowerCase();
    
    // Check cache first
    if (this.metadataCache.has(address)) {
      const cached = this.metadataCache.get(address);
      // Return cached data if it's less than 24 hours old
      if (Date.now() - cached.lastUpdated < 24 * 60 * 60 * 1000) {
        return cached;
      }
    }

    try {
      // Fetch fresh metadata
      const metadata = await this.fetchTokenMetadata(address);
      
      // Cache the result
      metadata.lastUpdated = Date.now();
      this.metadataCache.set(address, metadata);
      
      // Save cache periodically
      if (this.metadataCache.size % 10 === 0) {
        await this.saveCache();
      }
      
      return metadata;
    } catch (error) {
      console.error(`Error fetching metadata for ${address}:`, error.message);
      
      // Return cached data if available, even if stale
      if (this.metadataCache.has(address)) {
        return this.metadataCache.get(address);
      }
      
      // Return basic info if no cache available
      return await this.getBasicTokenInfo(address);
    }
  }

  async fetchTokenMetadata(tokenAddress) {
    const basicInfo = await web3Provider.getTokenInfo(tokenAddress);
    
    if (!basicInfo) {
      throw new Error('Failed to fetch basic token info');
    }

    // Try to get additional metadata from multiple sources
    const metadata = {
      ...basicInfo,
      launchDate: null,
      description: null,
      website: null,
      telegram: null,
      twitter: null,
      logo: null,
      marketCap: null,
      holders: null,
      verified: false,
      tags: [],
      riskScore: 'unknown'
    };

    // Try DEXScreener for additional info
    try {
      const dexScreenerData = await this.fetchFromDEXScreener(tokenAddress);
      if (dexScreenerData) {
        Object.assign(metadata, dexScreenerData);
      }
    } catch (error) {
      console.warn('DEXScreener fetch failed:', error.message);
    }

    // Try PulseX API for additional info
    try {
      const pulseXData = await this.fetchFromPulseX(tokenAddress);
      if (pulseXData) {
        Object.assign(metadata, pulseXData);
      }
    } catch (error) {
      console.warn('PulseX fetch failed:', error.message);
    }

    // Try to get creation/launch date from blockchain
    try {
      const launchDate = await this.getTokenLaunchDate(tokenAddress);
      if (launchDate) {
        metadata.launchDate = launchDate;
      }
    } catch (error) {
      console.warn('Launch date fetch failed:', error.message);
    }

    return metadata;
  }

  async fetchFromDEXScreener(tokenAddress) {
    try {
      const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`, {
        timeout: 5000
      });

      const pairs = response.data?.pairs || [];
      const pulsePair = pairs.find(pair => pair.chainId === 'pulsechain');

      if (pulsePair) {
        return {
          description: pulsePair.info?.description || null,
          website: pulsePair.info?.websites?.[0]?.url || null,
          telegram: pulsePair.info?.socials?.find(s => s.type === 'telegram')?.url || null,
          twitter: pulsePair.info?.socials?.find(s => s.type === 'twitter')?.url || null,
          logo: pulsePair.info?.imageUrl || null,
          marketCap: pulsePair.marketCap || null,
          verified: pulsePair.info?.verified || false,
          riskScore: this.calculateRiskScore(pulsePair)
        };
      }
    } catch (error) {
      throw new Error(`DEXScreener API error: ${error.message}`);
    }

    return null;
  }

  async fetchFromPulseX(tokenAddress) {
    try {
      // This would need to be implemented based on PulseX API availability
      // For now, return null
      return null;
    } catch (error) {
      throw new Error(`PulseX API error: ${error.message}`);
    }
  }

  async getTokenLaunchDate(tokenAddress) {
    try {
      // Get the token creation transaction by finding the first Transfer event with from=0x0
      const currentBlock = await web3Provider.getCurrentBlock();
      const searchStartBlock = Math.max(1, currentBlock - 1000000); // Search last ~1M blocks
      
      // This is a simplified approach - in reality, you'd want to use event logs
      // to find the token creation more efficiently
      
      for (let block = searchStartBlock; block <= currentBlock; block += 1000) {
        try {
          const endBlock = Math.min(block + 999, currentBlock);
          const blockData = await web3Provider.getBlockByNumber(block);
          
          if (blockData && blockData.transactions) {
            for (const tx of blockData.transactions) {
              if (tx.to && tx.to.toLowerCase() === tokenAddress.toLowerCase()) {
                // This might be the token creation transaction
                return Number(blockData.timestamp) * 1000;
              }
            }
          }
        } catch (error) {
          // Skip blocks that cause errors
          continue;
        }
      }
    } catch (error) {
      console.warn('Error getting token launch date:', error.message);
    }

    return null;
  }

  calculateRiskScore(pairData) {
    let score = 0;
    let maxScore = 0;

    // Verified status
    maxScore += 20;
    if (pairData.info?.verified) score += 20;

    // Has website
    maxScore += 15;
    if (pairData.info?.websites?.length > 0) score += 15;

    // Has social media
    maxScore += 15;
    if (pairData.info?.socials?.length > 0) score += 15;

    // Market cap
    maxScore += 20;
    const marketCap = pairData.marketCap || 0;
    if (marketCap > 1000000) score += 20;
    else if (marketCap > 100000) score += 15;
    else if (marketCap > 10000) score += 10;
    else if (marketCap > 1000) score += 5;

    // Liquidity
    maxScore += 20;
    const liquidity = pairData.liquidity?.usd || 0;
    if (liquidity > 100000) score += 20;
    else if (liquidity > 50000) score += 15;
    else if (liquidity > 10000) score += 10;
    else if (liquidity > 1000) score += 5;

    // Age (if available)
    maxScore += 10;
    const pairAge = pairData.pairAge || 0;
    if (pairAge > 30) score += 10;
    else if (pairAge > 7) score += 7;
    else if (pairAge > 1) score += 3;

    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

    if (percentage >= 80) return 'low';
    if (percentage >= 60) return 'medium';
    if (percentage >= 40) return 'high';
    return 'very-high';
  }

  async getBasicTokenInfo(tokenAddress) {
    const basicInfo = await web3Provider.getTokenInfo(tokenAddress);
    
    return {
      ...basicInfo,
      launchDate: null,
      description: null,
      website: null,
      telegram: null,
      twitter: null,
      logo: null,
      marketCap: null,
      holders: null,
      verified: false,
      tags: [],
      riskScore: 'unknown',
      lastUpdated: Date.now()
    };
  }

  async enrichTokensWithMetadata(tokens) {
    const enrichedTokens = [];
    
    for (const token of tokens) {
      try {
        const metadata = await this.getTokenMetadata(token.address);
        enrichedTokens.push({
          ...token,
          ...metadata
        });
      } catch (error) {
        console.warn(`Error enriching token ${token.address}:`, error.message);
        enrichedTokens.push(token);
      }
    }
    
    return enrichedTokens;
  }

  async updateAllCachedMetadata() {
    console.log('Updating all cached token metadata...');
    
    const addresses = Array.from(this.metadataCache.keys());
    let updated = 0;
    
    for (const address of addresses) {
      try {
        await this.getTokenMetadata(address); // This will refresh if stale
        updated++;
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`Error updating metadata for ${address}:`, error.message);
      }
    }
    
    await this.saveCache();
    console.log(`Updated metadata for ${updated}/${addresses.length} tokens`);
  }

  getCacheSize() {
    return this.metadataCache.size;
  }

  clearCache() {
    this.metadataCache.clear();
    this.saveCache();
  }
}

export default new TokenMetadataService();