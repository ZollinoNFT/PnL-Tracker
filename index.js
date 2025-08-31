#!/usr/bin/env node

import config from './src/config/config.js';
import logger from './src/utils/logger.js';
import displayFormatter from './src/utils/displayFormatter.js';
import tokenAnalytics from './src/services/tokenAnalytics.js';
import PNLCalculator from './src/services/pnlCalculator.js';
import coingeckoClient from './src/api/coingeckoClient.js';

class PulseChainPNLTracker {
    constructor() {
        this.pnlCalculator = new PNLCalculator();
        this.isRunning = false;
        this.updateInterval = config.tracking.updateInterval;
    }

    // Validate configuration
    validateConfig() {
        if (!config.wallet.address) {
            displayFormatter.displayError('Wallet address is not configured. Please add your wallet address to the .env file.');
            return false;
        }

        if (!config.moralis.apiKey || !config.coingecko.apiKey) {
            displayFormatter.displayError('API keys are missing. Please check your .env file.');
            return false;
        }

        return true;
    }

    // Main update cycle
    async performUpdate() {
        try {
            displayFormatter.displayHeader();
            displayFormatter.displayLoading('Fetching data from blockchain...');

            // Step 1: Fetch token transfers
            displayFormatter.displayLoading('Fetching token transfers...');
            const transfers = await tokenAnalytics.fetchTokenTransfers();
            
            if (transfers.length === 0) {
                displayFormatter.displayWarning('No token transfers found for the specified wallet and date range.');
                return;
            }

            // Step 2: Process transfers and build token list
            displayFormatter.displayLoading('Processing transactions...');
            const tokenAddresses = new Set();
            
            for (const transfer of transfers) {
                const tokenAddress = transfer.token_address?.toLowerCase();
                
                // Skip blacklisted tokens
                if (config.tracking.blacklistedTokens.includes(tokenAddress)) {
                    continue;
                }
                
                tokenAddresses.add(tokenAddress);
                
                // Get token metadata
                const metadata = await tokenAnalytics.getTokenMetadata(tokenAddress);
                
                // Process transaction in PNL calculator
                this.pnlCalculator.processTransaction(transfer, metadata);
            }

            // Step 3: Fetch current prices
            displayFormatter.displayLoading('Fetching current token prices...');
            const tokenPrices = await tokenAnalytics.fetchTokenPrices(Array.from(tokenAddresses));
            
            // Step 4: Get PLS price
            displayFormatter.displayLoading('Fetching PLS price...');
            const plsPrice = await tokenAnalytics.getPLSPrice();
            
            if (!plsPrice) {
                displayFormatter.displayWarning('Could not fetch PLS price. Using default value of 0.');
            }

            // Step 5: Calculate PNL
            displayFormatter.displayLoading('Calculating PNL...');
            const totalPNL = this.pnlCalculator.calculateTotalPNL(tokenPrices);
            
            // Step 6: Get time-based summaries
            const timeSummaries = this.pnlCalculator.getPNLSummary(tokenPrices);
            
            // Step 7: Analyze token performance
            const tokenPerformance = tokenAnalytics.analyzeTokenPerformance(totalPNL.tokenPNLs);
            
            // Step 8: Get summary statistics
            const summaryStats = await tokenAnalytics.getSummaryStatistics(tokenPerformance, plsPrice);
            
            // Step 9: Display results
            displayFormatter.displayHeader();
            displayFormatter.displayPNLSummary(totalPNL, plsPrice);
            displayFormatter.displayTimePNLSummary(timeSummaries, plsPrice);
            displayFormatter.displaySummaryStats(summaryStats);
            displayFormatter.displayTokenAnalytics(tokenPerformance.slice(0, 10), plsPrice); // Show top 10 tokens
            
            // Step 10: Display recent transactions
            const recentTransfers = transfers
                .sort((a, b) => new Date(b.block_timestamp) - new Date(a.block_timestamp))
                .slice(0, 10);
            displayFormatter.displayTransactionHistory(recentTransfers);
            
            displayFormatter.displayUpdateTime();
            
            // Log successful update
            logger.info('Update completed successfully', {
                totalPNL: totalPNL.totalPNL,
                plsPrice,
                tokensTracked: totalPNL.tokenCount
            });

        } catch (error) {
            displayFormatter.displayError(`Failed to update PNL data: ${error.message}`);
            logger.error('Update failed', error);
        }
    }

    // Start the tracker
    async start() {
        if (!this.validateConfig()) {
            process.exit(1);
        }

        displayFormatter.displayInfo(`Starting PulseChain Memecoin PNL Tracker...`);
        displayFormatter.displayInfo(`Wallet: ${config.wallet.address}`);
        displayFormatter.displayInfo(`Tracking from: ${config.wallet.trackingStartDate.toDateString()}`);
        displayFormatter.displayInfo(`Update interval: ${config.tracking.updateInterval / 60000} minutes`);
        
        if (config.tracking.blacklistedTokens.length > 0) {
            displayFormatter.displayInfo(`Blacklisted tokens: ${config.tracking.blacklistedTokens.length}`);
        }

        this.isRunning = true;

        // Perform initial update
        await this.performUpdate();

        // Set up periodic updates
        this.updateTimer = setInterval(async () => {
            if (this.isRunning) {
                await this.performUpdate();
            }
        }, this.updateInterval);

        // Handle graceful shutdown
        process.on('SIGINT', () => this.stop());
        process.on('SIGTERM', () => this.stop());
    }

    // Stop the tracker
    stop() {
        displayFormatter.displayInfo('Stopping PNL Tracker...');
        this.isRunning = false;
        
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        logger.info('PNL Tracker stopped');
        process.exit(0);
    }
}

// Main execution
async function main() {
    const tracker = new PulseChainPNLTracker();
    
    try {
        await tracker.start();
    } catch (error) {
        displayFormatter.displayError(`Failed to start tracker: ${error.message}`);
        logger.error('Startup failed', error);
        process.exit(1);
    }
}

// Run the application
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});