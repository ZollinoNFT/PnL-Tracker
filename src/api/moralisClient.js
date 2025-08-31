import axios from 'axios';
import config from '../config/config.js';
import logger from '../utils/logger.js';

class MoralisClient {
    constructor() {
        this.apiKey = config.moralis.apiKey;
        this.baseUrl = config.moralis.baseUrl;
        this.chainId = config.pulsechain.chainId;
    }

    async makeRequest(endpoint, params = {}) {
        try {
            const response = await axios.get(`${this.baseUrl}${endpoint}`, {
                params: {
                    chain: `0x${this.chainId.toString(16)}`, // PulseChain chain ID in hex
                    ...params
                },
                headers: {
                    'X-API-Key': this.apiKey,
                    'Accept': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            logger.error(`Moralis API error: ${error.message}`, { endpoint, params });
            throw error;
        }
    }

    // Get wallet token balances
    async getWalletTokenBalances(walletAddress) {
        try {
            const data = await this.makeRequest(`/${walletAddress}/erc20`, {
                exclude_spam: true,
                exclude_unverified_contracts: false
            });
            return data;
        } catch (error) {
            logger.error(`Failed to get wallet balances: ${error.message}`);
            return [];
        }
    }

    // Get wallet transactions
    async getWalletTransactions(walletAddress, fromDate) {
        try {
            const transactions = [];
            let cursor = null;
            
            do {
                const params = {
                    from_date: fromDate.toISOString(),
                    limit: 100
                };
                
                if (cursor) {
                    params.cursor = cursor;
                }
                
                const data = await this.makeRequest(`/${walletAddress}`, params);
                transactions.push(...(data.result || []));
                cursor = data.cursor;
                
                // Avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
            } while (cursor);
            
            return transactions;
        } catch (error) {
            logger.error(`Failed to get wallet transactions: ${error.message}`);
            return [];
        }
    }

    // Get ERC20 token transfers
    async getTokenTransfers(walletAddress, fromDate) {
        try {
            const transfers = [];
            let cursor = null;
            
            do {
                const params = {
                    from_date: fromDate.toISOString(),
                    limit: 100
                };
                
                if (cursor) {
                    params.cursor = cursor;
                }
                
                const data = await this.makeRequest(`/${walletAddress}/erc20/transfers`, params);
                transfers.push(...(data.result || []));
                cursor = data.cursor;
                
                // Avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
            } while (cursor);
            
            return transfers;
        } catch (error) {
            logger.error(`Failed to get token transfers: ${error.message}`);
            return [];
        }
    }

    // Get token metadata
    async getTokenMetadata(tokenAddress) {
        try {
            const data = await this.makeRequest(`/erc20/metadata`, {
                addresses: [tokenAddress]
            });
            return data[0] || null;
        } catch (error) {
            logger.error(`Failed to get token metadata: ${error.message}`);
            return null;
        }
    }

    // Get token price
    async getTokenPrice(tokenAddress) {
        try {
            const data = await this.makeRequest(`/erc20/${tokenAddress}/price`);
            return data;
        } catch (error) {
            logger.error(`Failed to get token price: ${error.message}`);
            return null;
        }
    }

    // Get multiple token prices
    async getMultipleTokenPrices(tokenAddresses) {
        try {
            const prices = {};
            // Batch requests to avoid rate limiting
            const batchSize = 25;
            
            for (let i = 0; i < tokenAddresses.length; i += batchSize) {
                const batch = tokenAddresses.slice(i, i + batchSize);
                const requests = batch.map(addr => this.getTokenPrice(addr));
                const results = await Promise.allSettled(requests);
                
                results.forEach((result, index) => {
                    if (result.status === 'fulfilled' && result.value) {
                        prices[batch[index]] = result.value;
                    }
                });
                
                // Avoid rate limiting
                if (i + batchSize < tokenAddresses.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            return prices;
        } catch (error) {
            logger.error(`Failed to get multiple token prices: ${error.message}`);
            return {};
        }
    }
}

export default new MoralisClient();