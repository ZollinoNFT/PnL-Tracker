import web3Provider from '../utils/web3Provider.js';
import { CONSTANTS, ABI } from '../config/constants.js';
import Big from 'big.js';

class TransactionService {
  constructor() {
    this.walletAddress = null;
    this.transactions = [];
    this.lastProcessedBlock = null;
    this.startBlock = null;
  }

  async init(walletAddress) {
    this.walletAddress = walletAddress.toLowerCase();
    
    // Calculate start block (3 weeks ago)
    const currentBlock = await web3Provider.getCurrentBlock();
    const threeWeeksAgo = Date.now() - CONSTANTS.THREE_WEEKS_MS;
    this.startBlock = await this.getBlockByTimestamp(threeWeeksAgo);
    this.lastProcessedBlock = this.startBlock;
    
    console.log(`Initialized transaction service for wallet: ${this.walletAddress}`);
    console.log(`Start block: ${this.startBlock}, Current block: ${currentBlock}`);
    
    // Load initial transactions
    await this.loadTransactions();
  }

  async getBlockByTimestamp(timestamp) {
    try {
      const currentBlock = await web3Provider.getCurrentBlock();
      const currentBlockData = await web3Provider.getBlockByNumber(currentBlock);
      const currentTimestamp = Number(currentBlockData.timestamp) * 1000;
      
      // Estimate block number based on average block time (10 seconds for PulseChain)
      const avgBlockTime = 10000; // 10 seconds in ms
      const timeDiff = currentTimestamp - timestamp;
      const blockDiff = Math.floor(timeDiff / avgBlockTime);
      
      const estimatedBlock = Math.max(1, currentBlock - blockDiff);
      
      // Fine-tune the block number
      return await this.binarySearchBlock(timestamp, Math.max(1, estimatedBlock - 1000), currentBlock);
    } catch (error) {
      console.error('Error getting block by timestamp:', error.message);
      return 1;
    }
  }

  async binarySearchBlock(targetTimestamp, startBlock, endBlock) {
    if (startBlock >= endBlock) {
      return startBlock;
    }

    const midBlock = Math.floor((startBlock + endBlock) / 2);
    
    try {
      const block = await web3Provider.getBlockByNumber(midBlock);
      const blockTimestamp = Number(block.timestamp) * 1000;

      if (blockTimestamp < targetTimestamp) {
        return await this.binarySearchBlock(targetTimestamp, midBlock + 1, endBlock);
      } else {
        return await this.binarySearchBlock(targetTimestamp, startBlock, midBlock);
      }
    } catch (error) {
      console.warn(`Error getting block ${midBlock}:`, error.message);
      return startBlock;
    }
  }

  async loadTransactions() {
    try {
      console.log('Loading transactions...');
      const currentBlock = await web3Provider.getCurrentBlock();
      
      // Process transactions in chunks to avoid overwhelming the RPC
      const chunkSize = 1000;
      
      for (let start = this.lastProcessedBlock; start <= currentBlock; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, currentBlock);
        
        console.log(`Processing blocks ${start} to ${end}`);
        const chunkTransactions = await web3Provider.getTransactionsByAddress(
          this.walletAddress,
          start,
          end
        );
        
        // Filter and process transactions
        const processedTransactions = await this.processTransactions(chunkTransactions);
        this.transactions.push(...processedTransactions);
        
        this.lastProcessedBlock = end + 1;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`Loaded ${this.transactions.length} relevant transactions`);
    } catch (error) {
      console.error('Error loading transactions:', error.message);
    }
  }

  async processTransactions(rawTransactions) {
    const processedTransactions = [];

    for (const tx of rawTransactions) {
      try {
        const processed = await this.processTransaction(tx);
        if (processed) {
          processedTransactions.push(processed);
        }
      } catch (error) {
        console.warn(`Error processing transaction ${tx.hash}:`, error.message);
      }
    }

    return processedTransactions;
  }

  async processTransaction(tx) {
    // Skip failed transactions
    if (!tx.receipt || tx.receipt.status !== '0x1') {
      return null;
    }

    // Analyze transaction logs for token swaps
    const swapData = await this.analyzeSwapTransaction(tx);
    
    if (swapData) {
      return {
        hash: tx.hash,
        blockNumber: Number(tx.blockNumber),
        timestamp: tx.timestamp,
        from: tx.from,
        to: tx.to,
        gasUsed: Number(tx.receipt.gasUsed),
        gasPrice: Number(tx.gasPrice),
        type: 'swap',
        ...swapData
      };
    }

    return null;
  }

  async analyzeSwapTransaction(tx) {
    try {
      const logs = tx.receipt.logs || [];
      const swapLogs = logs.filter(log => 
        log.topics[0] === web3Provider.getWeb3().utils.keccak256('Swap(address,uint256,uint256,uint256,uint256,address)')
      );

      if (swapLogs.length === 0) {
        return null;
      }

      // Get the main swap log
      const swapLog = swapLogs[0];
      const pairAddress = swapLog.address;

      // Get pair contract info
      const pairContract = await web3Provider.getContract(pairAddress, ABI.PULSEX_PAIR);
      const [token0Address, token1Address] = await Promise.all([
        pairContract.methods.token0().call(),
        pairContract.methods.token1().call()
      ]);

      // Decode swap amounts
      const web3 = web3Provider.getWeb3();
      const amount0In = web3.utils.hexToNumberString(swapLog.data.slice(2, 66));
      const amount1In = web3.utils.hexToNumberString('0x' + swapLog.data.slice(66, 130));
      const amount0Out = web3.utils.hexToNumberString('0x' + swapLog.data.slice(130, 194));
      const amount1Out = web3.utils.hexToNumberString('0x' + swapLog.data.slice(194, 258));

      // Determine which token is PLS/WPLS
      const isToken0PLS = token0Address.toLowerCase() === CONSTANTS.WPLS_CONTRACT_ADDRESS.toLowerCase();
      const isToken1PLS = token1Address.toLowerCase() === CONSTANTS.WPLS_CONTRACT_ADDRESS.toLowerCase();

      if (!isToken0PLS && !isToken1PLS) {
        return null; // Not a PLS pair
      }

      const plsTokenAddress = isToken0PLS ? token0Address : token1Address;
      const otherTokenAddress = isToken0PLS ? token1Address : token0Address;

      // Get token info
      const [plsTokenInfo, otherTokenInfo] = await Promise.all([
        web3Provider.getTokenInfo(plsTokenAddress),
        web3Provider.getTokenInfo(otherTokenAddress)
      ]);

      // Determine trade direction and amounts
      let plsAmount, tokenAmount, isBuy;

      if (isToken0PLS) {
        plsAmount = amount0In > 0 ? amount0In : amount0Out;
        tokenAmount = amount1In > 0 ? amount1In : amount1Out;
        isBuy = amount0In > 0; // Spending PLS to buy tokens
      } else {
        plsAmount = amount1In > 0 ? amount1In : amount1Out;
        tokenAmount = amount0In > 0 ? amount0In : amount0Out;
        isBuy = amount1In > 0; // Spending PLS to buy tokens
      }

      // Format amounts
      const formattedPLSAmount = web3Provider.formatUnits(plsAmount, CONSTANTS.PLS_DECIMALS);
      const formattedTokenAmount = web3Provider.formatUnits(tokenAmount, otherTokenInfo.decimals);

      return {
        pairAddress,
        tokenAddress: otherTokenAddress,
        tokenInfo: otherTokenInfo,
        plsAmount: formattedPLSAmount,
        tokenAmount: formattedTokenAmount,
        isBuy,
        price: isBuy 
          ? new Big(formattedPLSAmount).div(formattedTokenAmount).toString()
          : new Big(formattedTokenAmount).div(formattedPLSAmount).toString()
      };
    } catch (error) {
      console.warn('Error analyzing swap transaction:', error.message);
      return null;
    }
  }

  getTransactionsByToken(tokenAddress) {
    return this.transactions.filter(tx => 
      tx.tokenAddress && tx.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
    );
  }

  getTransactionsByDateRange(startDate, endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    
    return this.transactions.filter(tx => 
      tx.timestamp >= start && tx.timestamp <= end
    );
  }

  getAllTokens() {
    const tokens = new Map();
    
    this.transactions.forEach(tx => {
      if (tx.tokenAddress) {
        tokens.set(tx.tokenAddress.toLowerCase(), tx.tokenInfo);
      }
    });
    
    return Array.from(tokens.values());
  }

  async updateTransactions() {
    const currentBlock = await web3Provider.getCurrentBlock();
    
    if (this.lastProcessedBlock <= currentBlock) {
      const newTransactions = await web3Provider.getTransactionsByAddress(
        this.walletAddress,
        this.lastProcessedBlock,
        currentBlock
      );
      
      const processedTransactions = await this.processTransactions(newTransactions);
      this.transactions.push(...processedTransactions);
      
      this.lastProcessedBlock = currentBlock + 1;
      
      console.log(`Updated with ${processedTransactions.length} new transactions`);
    }
  }

  getTransactionCount() {
    return this.transactions.length;
  }

  getLatestTransactions(limit = 10) {
    return this.transactions
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
}

export default new TransactionService();