const config = {
  // PulseChain Network Configuration
  PULSECHAIN: {
    CHAIN_ID: 369,
    RPC_URLS: [
      'https://pulsechain-rpc.publicnode.com',
      'https://rpc.pulsechain.com',
      'https://rpc-pulsechain.g4mm4.io'
    ],
    EXPLORER_API: 'https://api.scan.pulsechain.com/api',
    NATIVE_TOKEN: {
      symbol: 'PLS',
      decimals: 18,
      address: '0x0000000000000000000000000000000000000000'
    }
  },

  // DEX Configuration
  DEXES: {
    PULSEX: {
      FACTORY: '0x1715a3E4A142d8b698131108995174F37aEBA10D',
      ROUTER: '0x165C3410fC91EF562C50559f7d2289fEbed552d9',
      API_BASE: 'https://api.pulsex.com'
    }
  },

  // Price Feed APIs
  PRICE_APIS: {
    COINGECKO: 'https://api.coingecko.com/api/v3',
    MORALIS: 'https://deep-index.moralis.io/api/v2.2',
    DEXSCREENER: 'https://api.dexscreener.com/latest'
  },

  // Trading Configuration
  TRADING: {
    MIN_TRADE_VALUE_PLS: 1000,
    TRACKING_PERIOD_DAYS: 21, // 3 weeks
    UPDATE_INTERVAL_MINUTES: 1.5,
    DAILY_REPORT_HOUR: 0 // 12:00 AM
  },

  // File Paths
  PATHS: {
    DATABASE: './data/trading_data.db',
    REPORTS: './reports',
    LOGS: './logs'
  },

  // ERC20 ABI for token interactions
  ERC20_ABI: [
    {
      "constant": true,
      "inputs": [],
      "name": "name",
      "outputs": [{"name": "", "type": "string"}],
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "symbol",
      "outputs": [{"name": "", "type": "string"}],
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "decimals",
      "outputs": [{"name": "", "type": "uint8"}],
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [{"name": "_owner", "type": "address"}],
      "name": "balanceOf",
      "outputs": [{"name": "balance", "type": "uint256"}],
      "type": "function"
    }
  ]
};

module.exports = config;