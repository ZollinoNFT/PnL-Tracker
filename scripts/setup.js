#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  console.log('='.repeat(60));
  console.log('PULSECHAIN PNL TRACKER - SETUP');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Check if .env already exists
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const overwrite = await question('.env file already exists. Overwrite? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Setup cancelled. Please edit .env manually if needed.');
        rl.close();
        return;
      }
    }

    console.log('Please provide the following information:');
    console.log('');

    // Get wallet address
    const walletAddress = await question('Enter your PulseChain wallet address: ');
    
    if (!walletAddress || !walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      console.log('Error: Invalid wallet address format. Please provide a valid Ethereum-style address.');
      rl.close();
      return;
    }

    // Optional API keys
    console.log('\\nOptional API keys (press Enter to skip):');
    const moralisKey = await question('Moralis API key (for enhanced data): ');
    const coingeckoKey = await question('CoinGecko API key (for better rate limits): ');

    // Configuration options
    console.log('\\nConfiguration options:');
    const updateInterval = await question('Update interval in minutes (default 1.5): ') || '1.5';
    const trackingDays = await question('Tracking period in days (default 21): ') || '21';

    // Create .env file
    const envContent = `# PulseChain Configuration
WALLET_ADDRESS=${walletAddress}
PULSECHAIN_RPC_URL=https://pulsechain-rpc.publicnode.com
BACKUP_RPC_URL=https://rpc.pulsechain.com

# API Keys (Optional but recommended for better rate limits)
${moralisKey ? `MORALIS_API_KEY=${moralisKey}` : '# MORALIS_API_KEY=your_moralis_api_key_here'}
${coingeckoKey ? `COINGECKO_API_KEY=${coingeckoKey}` : '# COINGECKO_API_KEY=your_coingecko_api_key_here'}

# Database Configuration
DB_PATH=./data/trading_data.db

# Reporting Configuration
REPORTS_DIR=./reports
LOG_LEVEL=info

# Update Intervals (in minutes)
UPDATE_INTERVAL=${updateInterval}
DAILY_REPORT_TIME=00:00

# Trading Configuration
TRACKING_START_DATE=${new Date(Date.now() - parseInt(trackingDays) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
MIN_TRADE_VALUE_PLS=1000`;

    fs.writeFileSync(envPath, envContent);

    // Create necessary directories
    const directories = ['data', 'reports', 'logs'];
    for (const dir of directories) {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    }

    console.log('');
    console.log('✅ Setup completed successfully!');
    console.log('');
    console.log('Configuration saved to .env');
    console.log('');
    console.log('Next steps:');
    console.log('1. Install dependencies: npm install');
    console.log('2. Start the tracker: npm start');
    console.log('');
    console.log('The tracker will:');
    console.log(`- Monitor wallet: ${walletAddress}`);
    console.log(`- Update every ${updateInterval} minutes`);
    console.log(`- Track trades from the last ${trackingDays} days`);
    console.log('- Generate daily reports at midnight');
    console.log('- Generate weekly reports every Sunday');
    console.log('');
    console.log('Available commands while running:');
    console.log('- status: Show current PnL status');
    console.log('- report: Generate daily report');
    console.log('- weekly: Generate weekly report');
    console.log('- sync: Perform manual sync');
    console.log('- exit: Stop the tracker');
    console.log('');

  } catch (error) {
    console.error('Error during setup:', error.message);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  setup();
}

module.exports = setup;