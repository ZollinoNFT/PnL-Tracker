import { Web3 } from 'web3';
import { CONSTANTS } from '../config/constants.js';

class Web3Provider {
  constructor() {
    this.web3 = null;
    this.isConnected = false;
    this.init();
  }

  async init() {
    try {
      const rpcUrl = process.env.PULSECHAIN_RPC_URL || 'https://rpc.pulsechain.com';
      this.web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
      
      // Test connection
      const chainId = await this.web3.eth.getChainId();
      if (Number(chainId) !== CONSTANTS.PULSECHAIN_CHAIN_ID) {
        throw new Error(`Invalid chain ID: ${chainId}. Expected: ${CONSTANTS.PULSECHAIN_CHAIN_ID}`);
      }
      
      this.isConnected = true;
      console.log(`Connected to PulseChain (Chain ID: ${chainId})`);
    } catch (error) {
      console.error('Failed to initialize Web3 provider:', error.message);
      this.isConnected = false;
    }
  }

  getWeb3() {
    if (!this.isConnected) {
      throw new Error('Web3 provider not connected');
    }
    return this.web3;
  }

  async getCurrentBlock() {
    const web3 = this.getWeb3();
    return await web3.eth.getBlockNumber();
  }

  async getBlockByNumber(blockNumber) {
    const web3 = this.getWeb3();
    return await web3.eth.getBlock(blockNumber, true);
  }

  async getTransaction(txHash) {
    const web3 = this.getWeb3();
    return await web3.eth.getTransaction(txHash);
  }

  async getTransactionReceipt(txHash) {
    const web3 = this.getWeb3();
    return await web3.eth.getTransactionReceipt(txHash);
  }

  async getTransactionsByAddress(address, startBlock, endBlock) {
    const web3 = this.getWeb3();
    const transactions = [];
    
    try {
      // Get all transactions for the address in the block range
      for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
        const block = await this.getBlockByNumber(blockNumber);
        
        if (block && block.transactions) {
          for (const tx of block.transactions) {
            if (tx.from?.toLowerCase() === address.toLowerCase() || 
                tx.to?.toLowerCase() === address.toLowerCase()) {
              const receipt = await this.getTransactionReceipt(tx.hash);
              transactions.push({
                ...tx,
                receipt,
                timestamp: Number(block.timestamp) * 1000
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching transactions:', error.message);
    }
    
    return transactions;
  }

  async getContract(address, abi) {
    const web3 = this.getWeb3();
    return new web3.eth.Contract(abi, address);
  }

  async getTokenInfo(tokenAddress) {
    try {
      const contract = await this.getContract(tokenAddress, CONSTANTS.ABI.ERC20);
      
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        contract.methods.name().call(),
        contract.methods.symbol().call(),
        contract.methods.decimals().call(),
        contract.methods.totalSupply().call()
      ]);

      return {
        address: tokenAddress,
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: totalSupply.toString()
      };
    } catch (error) {
      console.error(`Error getting token info for ${tokenAddress}:`, error.message);
      return null;
    }
  }

  async getTokenBalance(tokenAddress, walletAddress) {
    try {
      const contract = await this.getContract(tokenAddress, CONSTANTS.ABI.ERC20);
      const balance = await contract.methods.balanceOf(walletAddress).call();
      return balance.toString();
    } catch (error) {
      console.error(`Error getting token balance:`, error.message);
      return '0';
    }
  }

  formatUnits(value, decimals) {
    const divisor = BigInt(10 ** decimals);
    const quotient = BigInt(value) / divisor;
    const remainder = BigInt(value) % divisor;
    
    if (remainder === 0n) {
      return quotient.toString();
    }
    
    const remainderStr = remainder.toString().padStart(decimals, '0');
    const trimmedRemainder = remainderStr.replace(/0+$/, '');
    
    return trimmedRemainder ? `${quotient}.${trimmedRemainder}` : quotient.toString();
  }

  parseUnits(value, decimals) {
    const [integer = '0', fraction = '0'] = value.toString().split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    return BigInt(integer + paddedFraction);
  }
}

export default new Web3Provider();