import axios from 'axios';
import config from '../config/config.js';
import logger from '../utils/logger.js';

class CoinGeckoClient {
    constructor() {
        this.apiKey = config.coingecko.apiKey;
        this.baseUrl = config.coingecko.proBaseUrl; // Use pro API for better rate limits
    }

    async makeRequest(endpoint, params = {}) {
        try {
            const response = await axios.get(`${this.baseUrl}${endpoint}`, {
                params: {
                    x_cg_pro_api_key: this.apiKey,
                    ...params
                },
                headers: {
                    'Accept': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            logger.error(`CoinGecko API error: ${error.message}`, { endpoint, params });
            
            // Fallback to public API if pro API fails
            if (error.response?.status === 401) {
                try {
                    const publicResponse = await axios.get(`${config.coingecko.baseUrl}${endpoint}`, {
                        params,
                        headers: {
                            'Accept': 'application/json'
                        }
                    });
                    return publicResponse.data;
                } catch (publicError) {
                    throw publicError;
                }
            }
            throw error;
        }
    }

    // Get PLS price in USD and other currencies
    async getPLSPrice(vsCurrencies = ['usd']) {
        try {
            const data = await this.makeRequest('/simple/price', {
                ids: 'pulsechain',
                vs_currencies: vsCurrencies.join(','),
                include_24hr_change: true,
                include_24hr_vol: true
            });
            return data.pulsechain || null;
        } catch (error) {
            logger.error(`Failed to get PLS price: ${error.message}`);
            return null;
        }
    }

    // Get token price by contract address
    async getTokenPriceByContract(contractAddress, vsCurrency = 'usd') {
        try {
            // PulseChain platform ID for CoinGecko
            const platformId = 'pulsechain';
            
            const data = await this.makeRequest(`/simple/token_price/${platformId}`, {
                contract_addresses: contractAddress,
                vs_currencies: vsCurrency,
                include_24hr_change: true,
                include_24hr_vol: true
            });
            
            return data[contractAddress.toLowerCase()] || null;
        } catch (error) {
            logger.error(`Failed to get token price by contract: ${error.message}`);
            return null;
        }
    }

    // Get multiple token prices
    async getMultipleTokenPrices(contractAddresses, vsCurrency = 'usd') {
        try {
            if (contractAddresses.length === 0) return {};
            
            const platformId = 'pulsechain';
            const prices = {};
            
            // CoinGecko has a limit on contract addresses per request
            const batchSize = 100;
            
            for (let i = 0; i < contractAddresses.length; i += batchSize) {
                const batch = contractAddresses.slice(i, i + batchSize);
                
                const data = await this.makeRequest(`/simple/token_price/${platformId}`, {
                    contract_addresses: batch.join(','),
                    vs_currencies: vsCurrency,
                    include_24hr_change: true
                });
                
                Object.assign(prices, data);
                
                // Avoid rate limiting
                if (i + batchSize < contractAddresses.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            return prices;
        } catch (error) {
            logger.error(`Failed to get multiple token prices: ${error.message}`);
            return {};
        }
    }

    // Get historical price data
    async getHistoricalPrice(tokenId, date, vsCurrency = 'usd') {
        try {
            const formattedDate = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
            
            const data = await this.makeRequest(`/coins/${tokenId}/history`, {
                date: formattedDate,
                localization: false
            });
            
            return data.market_data?.current_price?.[vsCurrency] || null;
        } catch (error) {
            logger.error(`Failed to get historical price: ${error.message}`);
            return null;
        }
    }

    // Search for token by name or symbol
    async searchToken(query) {
        try {
            const data = await this.makeRequest('/search', {
                query: query
            });
            
            // Filter for PulseChain tokens
            const pulsechainTokens = data.coins?.filter(coin => 
                coin.platforms && coin.platforms.pulsechain
            ) || [];
            
            return pulsechainTokens;
        } catch (error) {
            logger.error(`Failed to search token: ${error.message}`);
            return [];
        }
    }
}

export default new CoinGeckoClient();