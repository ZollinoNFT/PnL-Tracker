import { ethers } from 'ethers';
import config from '../config/config.js';
import logger from '../utils/logger.js';

class PulseChainRPC {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(config.pulsechain.rpcUrl);
        this.chainId = config.pulsechain.chainId;
    }

    // Get current block number
    async getBlockNumber() {
        try {
            return await this.provider.getBlockNumber();
        } catch (error) {
            logger.error(`Failed to get block number: ${error.message}`);
            return null;
        }
    }

    // Get PLS balance for an address
    async getPLSBalance(address) {
        try {
            const balance = await this.provider.getBalance(address);
            return ethers.formatEther(balance);
        } catch (error) {
            logger.error(`Failed to get PLS balance: ${error.message}`);
            return '0';
        }
    }

    // Get token balance
    async getTokenBalance(tokenAddress, walletAddress) {
        try {
            const erc20Abi = [
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)',
                'function symbol() view returns (string)',
                'function name() view returns (string)'
            ];
            
            const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
            
            const [balance, decimals] = await Promise.all([
                contract.balanceOf(walletAddress),
                contract.decimals()
            ]);
            
            return ethers.formatUnits(balance, decimals);
        } catch (error) {
            logger.error(`Failed to get token balance: ${error.message}`);
            return '0';
        }
    }

    // Get token metadata
    async getTokenMetadata(tokenAddress) {
        try {
            const erc20Abi = [
                'function decimals() view returns (uint8)',
                'function symbol() view returns (string)',
                'function name() view returns (string)',
                'function totalSupply() view returns (uint256)'
            ];
            
            const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
            
            const [name, symbol, decimals, totalSupply] = await Promise.all([
                contract.name().catch(() => 'Unknown'),
                contract.symbol().catch(() => 'UNKNOWN'),
                contract.decimals().catch(() => 18),
                contract.totalSupply().catch(() => 0n)
            ]);
            
            return {
                address: tokenAddress,
                name,
                symbol,
                decimals,
                totalSupply: ethers.formatUnits(totalSupply, decimals)
            };
        } catch (error) {
            logger.error(`Failed to get token metadata: ${error.message}`);
            return null;
        }
    }

    // Get transaction receipt
    async getTransactionReceipt(txHash) {
        try {
            return await this.provider.getTransactionReceipt(txHash);
        } catch (error) {
            logger.error(`Failed to get transaction receipt: ${error.message}`);
            return null;
        }
    }

    // Get transaction details
    async getTransaction(txHash) {
        try {
            return await this.provider.getTransaction(txHash);
        } catch (error) {
            logger.error(`Failed to get transaction: ${error.message}`);
            return null;
        }
    }

    // Get block by number
    async getBlock(blockNumber) {
        try {
            return await this.provider.getBlock(blockNumber);
        } catch (error) {
            logger.error(`Failed to get block: ${error.message}`);
            return null;
        }
    }

    // Estimate gas price
    async getGasPrice() {
        try {
            const gasPrice = await this.provider.getFeeData();
            return {
                gasPrice: ethers.formatUnits(gasPrice.gasPrice, 'gwei'),
                maxFeePerGas: gasPrice.maxFeePerGas ? ethers.formatUnits(gasPrice.maxFeePerGas, 'gwei') : null,
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas ? ethers.formatUnits(gasPrice.maxPriorityFeePerGas, 'gwei') : null
            };
        } catch (error) {
            logger.error(`Failed to get gas price: ${error.message}`);
            return null;
        }
    }

    // Get logs for token transfers
    async getTokenTransferLogs(tokenAddress, fromBlock, toBlock, address = null) {
        try {
            const transferEventSignature = ethers.id('Transfer(address,address,uint256)');
            
            const filter = {
                address: tokenAddress,
                topics: [transferEventSignature],
                fromBlock,
                toBlock
            };
            
            if (address) {
                // Add address to topics (as sender or receiver)
                filter.topics.push(null); // Can be any sender
                filter.topics.push(ethers.zeroPadValue(address, 32)); // Specific receiver
            }
            
            const logs = await this.provider.getLogs(filter);
            return logs;
        } catch (error) {
            logger.error(`Failed to get token transfer logs: ${error.message}`);
            return [];
        }
    }
}

export default new PulseChainRPC();