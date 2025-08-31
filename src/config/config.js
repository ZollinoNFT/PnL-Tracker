import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

// Validate required environment variables
const requiredEnvVars = ['MORALIS_API_KEY', 'COINGECKO_API_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please copy .env.example to .env and fill in your API keys');
    process.exit(1);
}

// Configuration object
const config = {
    // API Keys
    moralis: {
        apiKey: process.env.MORALIS_API_KEY,
        baseUrl: 'https://deep-index.moralis.io/api/v2.2'
    },
    
    coingecko: {
        apiKey: process.env.COINGECKO_API_KEY,
        baseUrl: 'https://api.coingecko.com/api/v3',
        proBaseUrl: 'https://pro-api.coingecko.com/api/v3'
    },
    
    // PulseChain Configuration
    pulsechain: {
        rpcUrl: process.env.PULSECHAIN_RPC || 'https://rpc-pulsechain.g4mm4.io',
        chainId: 369,
        nativeToken: {
            symbol: 'PLS',
            decimals: 18,
            coingeckoId: 'pulsechain'
        },
        explorerUrl: 'https://scan.pulsechain.com'
    },
    
    // Wallet Configuration
    wallet: {
        address: process.env.WALLET_ADDRESS?.toLowerCase(),
        trackingStartDate: new Date(process.env.TRACKING_START_DATE || '2025-08-01')
    },
    
    // Tracking Configuration
    tracking: {
        updateInterval: parseInt(process.env.UPDATE_INTERVAL || '3') * 60 * 1000, // Convert to milliseconds
        blacklistedTokens: process.env.BLACKLISTED_TOKENS 
            ? process.env.BLACKLISTED_TOKENS.split(',').map(addr => addr.trim().toLowerCase())
            : [],
        displayCurrency: process.env.DISPLAY_CURRENCY || 'USD'
    },
    
    // Logging Configuration
    logging: {
        debugMode: process.env.DEBUG_MODE === 'true',
        logFilePath: process.env.LOG_FILE_PATH || './logs/pnl-tracker.log'
    },
    
    // Display Configuration
    display: {
        decimalPlaces: {
            pls: 0,
            usd: 2,
            percentage: 2
        }
    }
};

// Validate wallet address if provided
if (config.wallet.address && !config.wallet.address.match(/^0x[a-f0-9]{40}$/i)) {
    console.error('Invalid wallet address format. Please provide a valid Ethereum/PulseChain address.');
    process.exit(1);
}

export default config;