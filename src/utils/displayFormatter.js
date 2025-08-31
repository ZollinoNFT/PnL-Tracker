import chalk from 'chalk';
import config from '../config/config.js';

class DisplayFormatter {
    constructor() {
        this.currency = config.tracking.displayCurrency;
        this.decimalPlaces = config.display.decimalPlaces;
    }

    // Format number with commas
    formatNumber(num, decimals = 0) {
        if (num === null || num === undefined) return '0';
        return parseFloat(num).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    // Format PLS amount
    formatPLS(amount) {
        const formatted = this.formatNumber(amount, this.decimalPlaces.pls);
        return `${amount >= 0 ? '+' : ''}${formatted} PLS`;
    }

    // Format USD amount
    formatUSD(amount) {
        const formatted = this.formatNumber(Math.abs(amount), this.decimalPlaces.usd);
        const prefix = amount >= 0 ? '+' : '-';
        return `${prefix}$${formatted}`;
    }

    // Format percentage
    formatPercentage(value) {
        const formatted = this.formatNumber(value, this.decimalPlaces.percentage);
        return `${value >= 0 ? '+' : ''}${formatted}%`;
    }

    // Format date
    formatDate(date) {
        if (!date) return 'N/A';
        return new Date(date).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Format duration
    formatDuration(days) {
        if (days < 1) return `${Math.round(days * 24)} hours`;
        if (days < 30) return `${Math.round(days)} days`;
        if (days < 365) return `${Math.round(days / 30)} months`;
        return `${(days / 365).toFixed(1)} years`;
    }

    // Display header
    displayHeader() {
        console.clear();
        console.log(chalk.cyan('═'.repeat(80)));
        console.log(chalk.cyan.bold('  PULSECHAIN MEMECOIN PNL TRACKER'));
        console.log(chalk.cyan('═'.repeat(80)));
        console.log();
    }

    // Display PNL summary
    displayPNLSummary(totalPNL, plsPrice) {
        console.log(chalk.yellow.bold('📊 TOTAL PNL SUMMARY'));
        console.log(chalk.gray('─'.repeat(80)));
        
        const plsFormatted = this.formatPLS(totalPNL.totalPNL);
        const usdValue = totalPNL.totalPNL * plsPrice;
        const usdFormatted = this.formatUSD(usdValue);
        
        // Color based on profit/loss
        const color = totalPNL.totalPNL >= 0 ? chalk.green : chalk.red;
        
        console.log(`Total PNL: ${color.bold(plsFormatted)} (~${usdFormatted} USD)`);
        console.log(`Current PLS Price: $${this.formatNumber(plsPrice, 6)}`);
        console.log();
        
        console.log(`Realized PNL: ${this.formatPLS(totalPNL.totalRealizedPNL)} (~${this.formatUSD(totalPNL.totalRealizedPNL * plsPrice)})`);
        console.log(`Unrealized PNL: ${this.formatPLS(totalPNL.totalUnrealizedPNL)} (~${this.formatUSD(totalPNL.totalUnrealizedPNL * plsPrice)})`);
        console.log(`Tokens Tracked: ${totalPNL.tokenCount}`);
        console.log();
    }

    // Display time-based PNL summary
    displayTimePNLSummary(summaries, plsPrice) {
        console.log(chalk.yellow.bold('📈 TIME-BASED PNL'));
        console.log(chalk.gray('─'.repeat(80)));
        
        const periods = [
            { name: 'Daily', data: summaries.daily },
            { name: 'Weekly', data: summaries.weekly },
            { name: 'Monthly', data: summaries.monthly }
        ];
        
        for (const period of periods) {
            const plsAmount = this.formatPLS(period.data.total);
            const usdAmount = this.formatUSD(period.data.total * plsPrice);
            const txCount = period.data.transactions;
            
            console.log(`${period.name}: ${plsAmount} (~${usdAmount}) | Transactions: ${txCount}`);
        }
        console.log();
    }

    // Display token analytics
    displayTokenAnalytics(tokenPNLs, plsPrice) {
        console.log(chalk.yellow.bold('💰 PER-TOKEN ANALYTICS'));
        console.log(chalk.gray('─'.repeat(80)));
        
        for (const token of tokenPNLs) {
            const color = token.totalPNL >= 0 ? chalk.green : chalk.red;
            
            console.log(chalk.white.bold(`\n${token.name} (${token.symbol})`));
            console.log(chalk.gray(`Address: ${token.tokenAddress}`));
            console.log();
            
            // Transaction summary
            console.log(`Transactions: ${token.buyCount} buys, ${token.sellCount} sells`);
            console.log(`Total Bought: ${this.formatNumber(token.totalBought, 2)} ${token.symbol}`);
            console.log(`Total Sold: ${this.formatNumber(token.totalSold, 2)} ${token.symbol}`);
            console.log(`Current Balance: ${this.formatNumber(token.currentBalance, 2)} ${token.symbol}`);
            console.log();
            
            // Price information
            console.log(`Avg Buy Price: ${this.formatNumber(token.avgBuyPrice, 6)} PLS`);
            console.log(`Avg Sell Price: ${this.formatNumber(token.avgSellPrice, 6)} PLS`);
            console.log();
            
            // PNL information
            console.log(`Realized PNL: ${color(this.formatPLS(token.realizedPNL))} (~${this.formatUSD(token.realizedPNL * plsPrice)})`);
            console.log(`Unrealized PNL: ${color(this.formatPLS(token.unrealizedPNL))} (~${this.formatUSD(token.unrealizedPNL * plsPrice)})`);
            console.log(`Total PNL: ${color.bold(this.formatPLS(token.totalPNL))} (~${this.formatUSD(token.totalPNL * plsPrice)})`);
            console.log();
            
            // Holding time
            console.log(`Avg Holding Time: ${this.formatDuration(token.avgHoldingDays)}`);
            console.log(chalk.gray('─'.repeat(40)));
        }
        console.log();
    }

    // Display transaction history
    displayTransactionHistory(transactions, limit = 10) {
        console.log(chalk.yellow.bold('📜 RECENT TRANSACTIONS'));
        console.log(chalk.gray('─'.repeat(80)));
        
        const recentTxs = transactions.slice(0, limit);
        
        for (const tx of recentTxs) {
            const direction = tx.direction === 'IN' ? chalk.green('BUY ') : chalk.red('SELL');
            const amount = parseFloat(tx.value) / Math.pow(10, tx.tokenDecimals || 18);
            
            console.log(`${this.formatDate(tx.block_timestamp)} | ${direction} | ${this.formatNumber(amount, 2)} ${tx.tokenSymbol}`);
            console.log(chalk.gray(`  Hash: ${tx.transaction_hash.substring(0, 10)}...`));
        }
        console.log();
    }

    // Display summary statistics
    displaySummaryStats(stats) {
        console.log(chalk.yellow.bold('📊 SUMMARY STATISTICS'));
        console.log(chalk.gray('─'.repeat(80)));
        
        console.log(`Total Tokens Traded: ${stats.totalTokensTraded}`);
        console.log(`Profitable Tokens: ${stats.profitableTokens} (${this.formatPercentage(stats.winRate)})`);
        console.log(`Loss Tokens: ${stats.lossTokens}`);
        console.log(`Total Transactions: ${stats.totalTransactions} (${stats.totalBuyTransactions} buys, ${stats.totalSellTransactions} sells)`);
        console.log(`Average Holding Time: ${this.formatDuration(stats.avgHoldingTime)}`);
        console.log();
        
        if (stats.bestPerformer) {
            console.log(chalk.green.bold('Best Performer:'));
            console.log(`  ${stats.bestPerformer.name} (${stats.bestPerformer.symbol})`);
            console.log(`  PNL: ${this.formatPLS(stats.bestPerformer.pnl)} (~${this.formatUSD(stats.bestPerformer.pnlUSD)})`);
        }
        
        if (stats.worstPerformer && stats.worstPerformer.pnl < 0) {
            console.log(chalk.red.bold('\nWorst Performer:'));
            console.log(`  ${stats.worstPerformer.name} (${stats.worstPerformer.symbol})`);
            console.log(`  PNL: ${this.formatPLS(stats.worstPerformer.pnl)} (~${this.formatUSD(stats.worstPerformer.pnlUSD)})`);
        }
        console.log();
    }

    // Display update timestamp
    displayUpdateTime() {
        console.log(chalk.gray('─'.repeat(80)));
        console.log(chalk.gray(`Last Updated: ${this.formatDate(new Date())}`));
        console.log(chalk.gray(`Next Update: ${this.formatDate(new Date(Date.now() + config.tracking.updateInterval))}`));
        console.log(chalk.gray('─'.repeat(80)));
    }

    // Display error message
    displayError(message) {
        console.log(chalk.red.bold('❌ ERROR:'), chalk.red(message));
    }

    // Display warning message
    displayWarning(message) {
        console.log(chalk.yellow.bold('⚠️  WARNING:'), chalk.yellow(message));
    }

    // Display info message
    displayInfo(message) {
        console.log(chalk.blue.bold('ℹ️  INFO:'), chalk.blue(message));
    }

    // Display loading message
    displayLoading(message) {
        console.log(chalk.cyan('⏳'), chalk.cyan(message));
    }
}

export default new DisplayFormatter();