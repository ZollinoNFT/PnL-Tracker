const { Web3 } = require('web3');
const axios = require('axios');
const config = require('../../config/constants');
const logger = require('../utils/logger');

class PulseChainClient {
  constructor() {
    this.web3 = null;
    this.currentRpcIndex = 0;
    this.initWeb3();
  }

  initWeb3() {
    const rpcUrl = process.env.PULSECHAIN_RPC_URL || config.PULSECHAIN.RPC_URLS[this.currentRpcIndex];
    this.web3 = new Web3(rpcUrl);
    logger.info(`Connected to PulseChain RPC: ${rpcUrl}`);
  }

  async switchRpc() {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % config.PULSECHAIN.RPC_URLS.length;
    this.initWeb3();
    logger.warn(`Switched to backup RPC: ${config.PULSECHAIN.RPC_URLS[this.currentRpcIndex]}`);
  }

  async executeWithFallback(operation) {
    for (let attempt = 0; attempt < config.PULSECHAIN.RPC_URLS.length; attempt++) {
      try {
        return await operation();
      } catch (error) {
        logger.error(`RPC operation failed (attempt ${attempt + 1}):`, error.message);
        if (attempt < config.PULSECHAIN.RPC_URLS.length - 1) {
          await this.switchRpc();
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        } else {
          throw error;
        }
      }
    }
  }

  async getTransactionHistory(walletAddress, startBlock = 'earliest') {
    return this.executeWithFallback(async () => {
      try {
        // Use BlockScout API for transaction history
        const response = await axios.get(config.PULSECHAIN.EXPLORER_API, {
          params: {
            module: 'account',
            action: 'txlist',
            address: walletAddress,
            startblock: startBlock,
            endblock: 'latest',
            sort: 'desc'
          },
          timeout: 30000
        });

        if (response.data.status !== '1') {
          throw new Error(`API Error: ${response.data.message}`);
        }

        return response.data.result;
      } catch (error) {
        logger.error('Error fetching transaction history:', error.message);
        throw error;
      }
    });
  }

  async getTokenTransfers(walletAddress, startBlock = 'earliest') {
    return this.executeWithFallback(async () => {
      try {
        // Get ERC20 token transfers
        const response = await axios.get(config.PULSECHAIN.EXPLORER_API, {
          params: {
            module: 'account',
            action: 'tokentx',
            address: walletAddress,
            startblock: startBlock,
            endblock: 'latest',
            sort: 'desc'
          },
          timeout: 30000
        });

        if (response.data.status !== '1') {
          throw new Error(`API Error: ${response.data.message}`);
        }

        return response.data.result;
      } catch (error) {
        logger.error('Error fetching token transfers:', error.message);
        throw error;
      }
    });
  }

  async getTokenInfo(tokenAddress) {
    return this.executeWithFallback(async () => {
      try {
        const contract = new this.web3.eth.Contract(config.ERC20_ABI, tokenAddress);
        
        const [name, symbol, decimals] = await Promise.all([
          contract.methods.name().call(),
          contract.methods.symbol().call(),
          contract.methods.decimals().call()
        ]);

        return {
          address: tokenAddress,
          name,
          symbol,
          decimals: parseInt(decimals)
        };
      } catch (error) {
        logger.error(`Error fetching token info for ${tokenAddress}:`, error.message);
        // Fallback to API if contract call fails
        try {
          const response = await axios.get(config.PULSECHAIN.EXPLORER_API, {
            params: {
              module: 'token',
              action: 'getToken',
              contractaddress: tokenAddress
            }
          });
          
          if (response.data.status === '1') {
            return {
              address: tokenAddress,
              name: response.data.result.name || 'Unknown',
              symbol: response.data.result.symbol || 'UNKNOWN',
              decimals: parseInt(response.data.result.decimals) || 18
            };
          }
        } catch (apiError) {
          logger.error('API fallback failed:', apiError.message);
        }
        
        // Return default if all methods fail
        return {
          address: tokenAddress,
          name: 'Unknown Token',
          symbol: 'UNKNOWN',
          decimals: 18
        };
      }
    });
  }

  async getCurrentBlock() {
    return this.executeWithFallback(async () => {
      return await this.web3.eth.getBlockNumber();
    });
  }

  async getBlock(blockNumber) {
    return this.executeWithFallback(async () => {
      return await this.web3.eth.getBlock(blockNumber);
    });
  }

  async getTokenBalance(tokenAddress, walletAddress) {
    return this.executeWithFallback(async () => {
      if (tokenAddress === config.PULSECHAIN.NATIVE_TOKEN.address) {
        // Get PLS balance
        return await this.web3.eth.getBalance(walletAddress);
      } else {
        // Get ERC20 token balance
        const contract = new this.web3.eth.Contract(config.ERC20_ABI, tokenAddress);
        return await contract.methods.balanceOf(walletAddress).call();
      }
    });
  }

  formatAmount(amount, decimals = 18) {
    return this.web3.utils.fromWei(amount.toString(), 'ether');
  }

  parseAmount(amount, decimals = 18) {
    return this.web3.utils.toWei(amount.toString(), 'ether');
  }
}

module.exports = PulseChainClient;