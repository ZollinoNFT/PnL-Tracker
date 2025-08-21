const moment = require('moment');
const axios = require('axios');
const PulseChainClient = require('../blockchain/pulsechain');
const Database = require('../database/database');
const logger = require('../utils/logger');
const config = require('../../config/constants');

class WalletTracker {
  constructor(walletAddress, database) {
    this.walletAddress = walletAddress.toLowerCase();
    this.pulseChain = new PulseChainClient();
    this.db = database;
    this.trackingStartDate = moment().subtract(config.TRADING.TRACKING_PERIOD_DAYS, 'days');
  }

  async syncTransactions() {
    try {
      logger.info('Starting transaction sync for wallet:', this.walletAddress);
      
      // Calculate start block based on tracking period
      const startTimestamp = this.trackingStartDate.unix();
      const startBlock = await this.estimateBlockFromTimestamp(startTimestamp);
      
      // Fetch regular transactions and token transfers
      const [transactions, tokenTransfers] = await Promise.all([
        this.pulseChain.getTransactionHistory(this.walletAddress, startBlock),
        this.pulseChain.getTokenTransfers(this.walletAddress, startBlock)
      ]);

      logger.info(`Found ${transactions.length} transactions and ${tokenTransfers.length} token transfers`);

      // Process and store transactions
      await this.processTransactions(transactions);
      await this.processTokenTransfers(tokenTransfers);

      logger.info('Transaction sync completed successfully');
    } catch (error) {
      logger.error('Error syncing transactions:', error.message);
      throw error;
    }
  }

  async processTransactions(transactions) {
    for (const tx of transactions) {
      try {
        // Skip if transaction is older than tracking period
        if (parseInt(tx.timeStamp) < this.trackingStartDate.unix()) {
          continue;
        }

        const processedTx = {
          hash: tx.hash,
          blockNumber: parseInt(tx.blockNumber),
          timestamp: parseInt(tx.timeStamp),
          from: tx.from.toLowerCase(),
          to: tx.to.toLowerCase(),
          value: tx.value,
          gasPrice: tx.gasPrice,
          gasUsed: parseInt(tx.gasUsed),
          tokenAddress: config.PULSECHAIN.NATIVE_TOKEN.address, // PLS transaction
          tokenAmount: tx.value,
          tokenSymbol: 'PLS',
          type: this.determineTransactionType(tx)
        };

        await this.db.insertTransaction(processedTx);
      } catch (error) {
        logger.error(`Error processing transaction ${tx.hash}:`, error.message);
      }
    }
  }

  async processTokenTransfers(transfers) {
    for (const transfer of transfers) {
      try {
        // Skip if transfer is older than tracking period
        if (parseInt(transfer.timeStamp) < this.trackingStartDate.unix()) {
          continue;
        }

        // Get or create token info
        await this.ensureTokenInfo(transfer.contractAddress);

        const processedTransfer = {
          hash: transfer.hash,
          blockNumber: parseInt(transfer.blockNumber),
          timestamp: parseInt(transfer.timeStamp),
          from: transfer.from.toLowerCase(),
          to: transfer.to.toLowerCase(),
          value: transfer.value,
          gasPrice: transfer.gasPrice,
          gasUsed: parseInt(transfer.gasUsed),
          tokenAddress: transfer.contractAddress.toLowerCase(),
          tokenAmount: transfer.value,
          tokenSymbol: transfer.tokenSymbol,
          type: this.determineTokenTransferType(transfer)
        };

        await this.db.insertTransaction(processedTransfer);

        // If this looks like a trade, process it as such
        if (this.isTradeTransaction(transfer)) {
          await this.processTrade(transfer);
        }
      } catch (error) {
        logger.error(`Error processing token transfer ${transfer.hash}:`, error.message);
      }
    }
  }

  async ensureTokenInfo(tokenAddress) {
    try {
      const tokenInfo = await this.pulseChain.getTokenInfo(tokenAddress);
      
      // Try to get launch date from contract creation
      const launchDate = await this.getTokenLaunchDate(tokenAddress);
      
      await this.db.insertOrUpdateToken({
        ...tokenInfo,
        launchDate: launchDate || null,
        totalSupply: null // Will be fetched separately if needed
      });
    } catch (error) {
      logger.error(`Error ensuring token info for ${tokenAddress}:`, error.message);
    }
  }

  async getTokenLaunchDate(tokenAddress) {
    try {
      // Get contract creation transaction
      const response = await axios.get(config.PULSECHAIN.EXPLORER_API, {
        params: {
          module: 'contract',
          action: 'getcontractcreation',
          contractaddresses: tokenAddress
        }
      });

      if (response.data.status === '1' && response.data.result.length > 0) {
        const creationTx = response.data.result[0];
        const block = await this.pulseChain.getBlock(parseInt(creationTx.blockNumber));
        return moment.unix(parseInt(block.timestamp)).format('YYYY-MM-DD');
      }
    } catch (error) {
      logger.error(`Error getting launch date for ${tokenAddress}:`, error.message);
    }
    return null;
  }

  determineTransactionType(tx) {
    const isFromWallet = tx.from.toLowerCase() === this.walletAddress;
    const isToWallet = tx.to.toLowerCase() === this.walletAddress;

    if (isFromWallet && !isToWallet) {
      return 'OUTGOING';
    } else if (!isFromWallet && isToWallet) {
      return 'INCOMING';
    } else {
      return 'SELF';
    }
  }

  determineTokenTransferType(transfer) {
    const isFromWallet = transfer.from.toLowerCase() === this.walletAddress;
    const isToWallet = transfer.to.toLowerCase() === this.walletAddress;

    if (isFromWallet && !isToWallet) {
      return 'TOKEN_OUT';
    } else if (!isFromWallet && isToWallet) {
      return 'TOKEN_IN';
    } else {
      return 'TOKEN_SELF';
    }
  }

  isTradeTransaction(transfer) {
    // Check if this transfer is part of a DEX trade
    // Look for common DEX router addresses or swap patterns
    const commonDexRouters = [
      config.DEXES.PULSEX.ROUTER.toLowerCase(),
      '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2 Router
      '0xe592427a0aece92de3edee1f18e0157c05861564'  // Uniswap V3 Router
    ];

    return commonDexRouters.includes(transfer.to.toLowerCase()) ||
           commonDexRouters.includes(transfer.from.toLowerCase());
  }

  async processTrade(transfer) {
    try {
      // Determine if this is a buy or sell based on token flow direction
      const isTokenIn = transfer.to.toLowerCase() === this.walletAddress;
      const tradeType = isTokenIn ? 'BUY' : 'SELL';

      // For accurate PLS amount, we need to find the corresponding PLS transaction
      const plsAmount = await this.findCorrespondingPlsAmount(transfer.hash, tradeType);

      if (!plsAmount) {
        logger.warn(`Could not find corresponding PLS amount for trade ${transfer.hash}`);
        return;
      }

      const pricePerToken = this.calculatePricePerToken(plsAmount, transfer.value, transfer.tokenDecimals || 18);

      const trade = {
        transactionHash: transfer.hash,
        tokenAddress: transfer.contractAddress.toLowerCase(),
        tradeType,
        plsAmount: plsAmount.toString(),
        tokenAmount: transfer.value,
        pricePerTokenPls: pricePerToken.toString(),
        timestamp: parseInt(transfer.timeStamp),
        blockNumber: parseInt(transfer.blockNumber)
      };

      await this.db.insertTrade(trade);
      await this.updateHoldings(trade);

      logger.info(`Processed ${tradeType} trade: ${transfer.tokenSymbol} for ${this.formatPls(plsAmount)} PLS`);
    } catch (error) {
      logger.error(`Error processing trade ${transfer.hash}:`, error.message);
    }
  }

  async findCorrespondingPlsAmount(txHash, tradeType) {
    try {
      // Get the full transaction receipt to find PLS transfers
      const receipt = await this.pulseChain.web3.eth.getTransactionReceipt(txHash);
      const transaction = await this.pulseChain.web3.eth.getTransaction(txHash);

      // For DEX trades, the PLS amount is usually in the transaction value
      // or in internal transactions (for complex swaps)
      let plsAmount = BigInt(transaction.value || '0');

      // If no direct value, check logs for PLS transfers
      if (plsAmount === 0n && receipt.logs) {
        // Look for WETH/WPLS unwrap events or other PLS-related events
        plsAmount = await this.extractPlsFromLogs(receipt.logs, tradeType);
      }

      return plsAmount;
    } catch (error) {
      logger.error(`Error finding PLS amount for ${txHash}:`, error.message);
      return null;
    }
  }

  async extractPlsFromLogs(logs, tradeType) {
    // This is a simplified implementation
    // In a real scenario, you'd need to decode specific DEX logs
    // to extract the exact PLS amounts involved in swaps
    
    for (const log of logs) {
      // Look for Transfer events and Swap events
      if (log.topics && log.topics.length > 0) {
        // Transfer event signature: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
        if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
          // Decode transfer amount if it involves our wallet
          try {
            const amount = this.pulseChain.web3.utils.hexToNumberString(log.data);
            if (amount && BigInt(amount) > 0n) {
              return BigInt(amount);
            }
          } catch (decodeError) {
            // Continue to next log
          }
        }
      }
    }
    
    return 0n;
  }

  calculatePricePerToken(plsAmount, tokenAmount, tokenDecimals) {
    const plsAmountFormatted = BigInt(plsAmount);
    const tokenAmountFormatted = BigInt(tokenAmount);
    
    if (tokenAmountFormatted === 0n) {
      return 0n;
    }

    // Calculate price per token in PLS
    // Price = PLS Amount / Token Amount (adjusted for decimals)
    const pricePerToken = (plsAmountFormatted * BigInt(10 ** 18)) / tokenAmountFormatted;
    
    return pricePerToken;
  }

  async updateHoldings(trade) {
    try {
      // Get current holding data
      const currentHolding = await this.db.db.get(
        'SELECT * FROM holdings WHERE token_address = ?',
        [trade.tokenAddress]
      );

      let holding = currentHolding || {
        tokenAddress: trade.tokenAddress,
        symbol: '',
        totalBoughtPls: '0',
        totalSoldPls: '0',
        currentBalance: '0',
        averageBuyPricePls: '0',
        firstBuyTimestamp: null,
        lastTradeTimestamp: trade.timestamp,
        tradeCount: 0,
        realizedPnlPls: '0'
      };

      // Update trade statistics
      holding.tradeCount += 1;
      holding.lastTradeTimestamp = trade.timestamp;

      if (trade.tradeType === 'BUY') {
        const newTotalBought = BigInt(holding.totalBoughtPls) + BigInt(trade.plsAmount);
        const newTokenBalance = BigInt(holding.currentBalance) + BigInt(trade.tokenAmount);
        
        holding.totalBoughtPls = newTotalBought.toString();
        holding.currentBalance = newTokenBalance.toString();
        
        if (!holding.firstBuyTimestamp) {
          holding.firstBuyTimestamp = trade.timestamp;
        }

        // Recalculate average buy price
        holding.averageBuyPricePls = this.calculateAverageBuyPrice(
          holding.totalBoughtPls,
          holding.currentBalance
        ).toString();
      } else if (trade.tradeType === 'SELL') {
        const newTotalSold = BigInt(holding.totalSoldPls) + BigInt(trade.plsAmount);
        const newTokenBalance = BigInt(holding.currentBalance) - BigInt(trade.tokenAmount);
        
        holding.totalSoldPls = newTotalSold.toString();
        holding.currentBalance = newTokenBalance.toString();

        // Calculate realized PnL for this sell
        const avgBuyPrice = BigInt(holding.averageBuyPricePls);
        const sellPrice = BigInt(trade.pricePerTokenPls);
        const soldAmount = BigInt(trade.tokenAmount);
        
        const realizedPnl = (sellPrice - avgBuyPrice) * soldAmount / BigInt(10 ** 18);
        holding.realizedPnlPls = (BigInt(holding.realizedPnlPls) + realizedPnl).toString();
      }

      await this.db.updateHolding(holding);
    } catch (error) {
      logger.error('Error updating holdings:', error.message);
      throw error;
    }
  }

  calculateAverageBuyPrice(totalBoughtPls, currentBalance) {
    const totalBought = BigInt(totalBoughtPls);
    const balance = BigInt(currentBalance);
    
    if (balance === 0n) {
      return 0n;
    }
    
    return (totalBought * BigInt(10 ** 18)) / balance;
  }

  async estimateBlockFromTimestamp(timestamp) {
    try {
      // PulseChain has ~3 second block time
      const currentBlock = await this.pulseChain.getCurrentBlock();
      const currentBlockData = await this.pulseChain.getBlock(currentBlock);
      const currentTimestamp = parseInt(currentBlockData.timestamp);
      
      const timeDiff = currentTimestamp - timestamp;
      const estimatedBlocksDiff = Math.floor(timeDiff / 3); // 3 second block time
      
      const estimatedStartBlock = Math.max(0, Number(currentBlock) - estimatedBlocksDiff);
      
      logger.info(`Estimated start block: ${estimatedStartBlock} for timestamp: ${timestamp}`);
      return estimatedStartBlock;
    } catch (error) {
      logger.error('Error estimating start block:', error.message);
      return 'earliest';
    }
  }

  async getCurrentHoldings() {
    try {
      const holdings = await this.db.getHoldings();
      
      // Update current balances from blockchain
      for (const holding of holdings) {
        try {
          const currentBalance = await this.pulseChain.getTokenBalance(
            holding.token_address,
            this.walletAddress
          );
          
          // Update if balance has changed
          if (currentBalance !== holding.current_balance) {
            await this.db.updateHolding({
              ...holding,
              currentBalance: currentBalance.toString()
            });
          }
        } catch (error) {
          logger.error(`Error updating balance for ${holding.symbol}:`, error.message);
        }
      }

      return await this.db.getHoldings();
    } catch (error) {
      logger.error('Error getting current holdings:', error.message);
      throw error;
    }
  }

  async getTradesSince(timestamp) {
    return await this.db.getTradesSince(timestamp);
  }

  formatPls(amount) {
    return this.pulseChain.formatAmount(amount, 18);
  }

  formatToken(amount, decimals = 18) {
    return this.pulseChain.formatAmount(amount, decimals);
  }
}

module.exports = WalletTracker;