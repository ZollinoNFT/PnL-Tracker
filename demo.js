#!/usr/bin/env node

import chalk from 'chalk';

// Demo script to show what the PNL tracker output looks like
class PNLTrackerDemo {
    constructor() {
        this.sampleData = this.generateSampleData();
    }

    generateSampleData() {
        return {
            plsPrice: 0.0000424,
            totalPNL: 15789234,
            realizedPNL: 11234567,
            unrealizedPNL: 4554667,
            tokens: [
                {
                    name: 'PepeCoin',
                    symbol: 'PEPE',
                    address: '0x1234...5678',
                    buyCount: 8,
                    sellCount: 5,
                    totalBought: 5000000,
                    totalSold: 3000000,
                    currentBalance: 2000000,
                    avgBuyPrice: 0.000012,
                    avgSellPrice: 0.000018,
                    realizedPNL: 6500000,
                    unrealizedPNL: 2100000,
                    totalPNL: 8600000,
                    avgHoldingDays: 23
                },
                {
                    name: 'Shiba Pulse',
                    symbol: 'SPULSE',
                    address: '0xabcd...ef12',
                    buyCount: 12,
                    sellCount: 7,
                    totalBought: 10000000,
                    totalSold: 7500000,
                    currentBalance: 2500000,
                    avgBuyPrice: 0.0000008,
                    avgSellPrice: 0.0000012,
                    realizedPNL: 3200000,
                    unrealizedPNL: 1800000,
                    totalPNL: 5000000,
                    avgHoldingDays: 15
                },
                {
                    name: 'MoonShot',
                    symbol: 'MOON',
                    address: '0x9876...5432',
                    buyCount: 5,
                    sellCount: 3,
                    totalBought: 2000000,
                    totalSold: 1200000,
                    currentBalance: 800000,
                    avgBuyPrice: 0.000025,
                    avgSellPrice: 0.000022,
                    realizedPNL: -360000,
                    unrealizedPNL: -120000,
                    totalPNL: -480000,
                    avgHoldingDays: 7
                }
            ],
            recentTransactions: [
                { time: '2025-01-18 14:32', type: 'BUY', amount: 500000, symbol: 'PEPE', hash: '0xabc123...' },
                { time: '2025-01-18 12:15', type: 'SELL', amount: 300000, symbol: 'SPULSE', hash: '0xdef456...' },
                { time: '2025-01-18 09:45', type: 'BUY', amount: 1000000, symbol: 'MOON', hash: '0xghi789...' },
                { time: '2025-01-17 22:30', type: 'SELL', amount: 750000, symbol: 'PEPE', hash: '0xjkl012...' },
                { time: '2025-01-17 18:20', type: 'BUY', amount: 2000000, symbol: 'SPULSE', hash: '0xmno345...' }
            ]
        };
    }

    formatNumber(num, decimals = 0) {
        return parseFloat(num).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    displayOutput() {
        const data = this.sampleData;
        
        // Clear console and display header
        console.clear();
        console.log(chalk.cyan('═'.repeat(80)));
        console.log(chalk.cyan.bold('  PULSECHAIN MEMECOIN PNL TRACKER'));
        console.log(chalk.cyan('═'.repeat(80)));
        console.log();

        // Display Total PNL Summary
        console.log(chalk.yellow.bold('📊 TOTAL PNL SUMMARY'));
        console.log(chalk.gray('─'.repeat(80)));
        
        const totalPNLColor = data.totalPNL >= 0 ? chalk.green : chalk.red;
        console.log(`Total PNL: ${totalPNLColor.bold(`+${this.formatNumber(data.totalPNL)} PLS`)} (~$${this.formatNumber(data.totalPNL * data.plsPrice, 2)} USD)`);
        console.log(`Current PLS Price: $${data.plsPrice.toFixed(7)}`);
        console.log();
        console.log(`Realized PNL: +${this.formatNumber(data.realizedPNL)} PLS (~$${this.formatNumber(data.realizedPNL * data.plsPrice, 2)})`);
        console.log(`Unrealized PNL: +${this.formatNumber(data.unrealizedPNL)} PLS (~$${this.formatNumber(data.unrealizedPNL * data.plsPrice, 2)})`);
        console.log(`Tokens Tracked: ${data.tokens.length}`);
        console.log();

        // Display Time-based PNL
        console.log(chalk.yellow.bold('📈 TIME-BASED PNL'));
        console.log(chalk.gray('─'.repeat(80)));
        console.log(`Daily: +892,340 PLS (~$37.84) | Transactions: 8`);
        console.log(`Weekly: +4,234,567 PLS (~$179.55) | Transactions: 42`);
        console.log(`Monthly: +${this.formatNumber(data.totalPNL)} PLS (~$${this.formatNumber(data.totalPNL * data.plsPrice, 2)}) | Transactions: 156`);
        console.log();

        // Display Summary Statistics
        console.log(chalk.yellow.bold('📊 SUMMARY STATISTICS'));
        console.log(chalk.gray('─'.repeat(80)));
        console.log(`Total Tokens Traded: ${data.tokens.length}`);
        console.log(`Profitable Tokens: 2 (66.67%)`);
        console.log(`Loss Tokens: 1`);
        console.log(`Total Transactions: 45 (28 buys, 17 sells)`);
        console.log(`Average Holding Time: 15 days`);
        console.log();
        console.log(chalk.green.bold('Best Performer:'));
        console.log(`  PepeCoin (PEPE)`);
        console.log(`  PNL: +8,600,000 PLS (~$364.64)`);
        console.log();
        console.log(chalk.red.bold('Worst Performer:'));
        console.log(`  MoonShot (MOON)`);
        console.log(`  PNL: -480,000 PLS (~-$20.35)`);
        console.log();

        // Display Per-Token Analytics
        console.log(chalk.yellow.bold('💰 PER-TOKEN ANALYTICS'));
        console.log(chalk.gray('─'.repeat(80)));
        
        for (const token of data.tokens) {
            const pnlColor = token.totalPNL >= 0 ? chalk.green : chalk.red;
            
            console.log();
            console.log(chalk.white.bold(`${token.name} (${token.symbol})`));
            console.log(chalk.gray(`Address: ${token.address}`));
            console.log();
            
            console.log(`Transactions: ${token.buyCount} buys, ${token.sellCount} sells`);
            console.log(`Total Bought: ${this.formatNumber(token.totalBought)} ${token.symbol}`);
            console.log(`Total Sold: ${this.formatNumber(token.totalSold)} ${token.symbol}`);
            console.log(`Current Balance: ${this.formatNumber(token.currentBalance)} ${token.symbol}`);
            console.log();
            
            console.log(`Avg Buy Price: ${token.avgBuyPrice.toFixed(9)} PLS`);
            console.log(`Avg Sell Price: ${token.avgSellPrice.toFixed(9)} PLS`);
            console.log();
            
            const realizedSign = token.realizedPNL >= 0 ? '+' : '';
            const unrealizedSign = token.unrealizedPNL >= 0 ? '+' : '';
            const totalSign = token.totalPNL >= 0 ? '+' : '';
            
            console.log(`Realized PNL: ${pnlColor(`${realizedSign}${this.formatNumber(token.realizedPNL)} PLS`)} (~$${this.formatNumber(Math.abs(token.realizedPNL * data.plsPrice), 2)})`);
            console.log(`Unrealized PNL: ${pnlColor(`${unrealizedSign}${this.formatNumber(token.unrealizedPNL)} PLS`)} (~$${this.formatNumber(Math.abs(token.unrealizedPNL * data.plsPrice), 2)})`);
            console.log(`Total PNL: ${pnlColor.bold(`${totalSign}${this.formatNumber(token.totalPNL)} PLS`)} (~$${this.formatNumber(Math.abs(token.totalPNL * data.plsPrice), 2)})`);
            console.log();
            console.log(`Avg Holding Time: ${token.avgHoldingDays} days`);
            console.log(chalk.gray('─'.repeat(40)));
        }
        console.log();

        // Display Recent Transactions
        console.log(chalk.yellow.bold('📜 RECENT TRANSACTIONS'));
        console.log(chalk.gray('─'.repeat(80)));
        
        for (const tx of data.recentTransactions) {
            const typeColor = tx.type === 'BUY' ? chalk.green('BUY ') : chalk.red('SELL');
            console.log(`${tx.time} | ${typeColor} | ${this.formatNumber(tx.amount)} ${tx.symbol}`);
            console.log(chalk.gray(`  Hash: ${tx.hash}`));
        }
        console.log();

        // Display footer
        console.log(chalk.gray('─'.repeat(80)));
        console.log(chalk.gray(`Last Updated: ${new Date().toLocaleString()}`));
        console.log(chalk.gray(`Next Update: ${new Date(Date.now() + 180000).toLocaleString()} (in 3 minutes)`));
        console.log(chalk.gray('─'.repeat(80)));
        console.log();
        console.log(chalk.cyan('Press Ctrl+C to stop the tracker'));
    }
}

// Run the demo
const demo = new PNLTrackerDemo();
demo.displayOutput();