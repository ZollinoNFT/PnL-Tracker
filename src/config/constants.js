export const CONSTANTS = {
  // PulseChain Configuration
  PULSECHAIN_CHAIN_ID: 369,
  PLS_CONTRACT_ADDRESS: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27',
  WPLS_CONTRACT_ADDRESS: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27',
  
  // DEX Addresses
  PULSEX_V1_ROUTER: '0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02',
  PULSEX_V2_ROUTER: '0x165C3410fC91EF562C50559f7d2289fEbed552d9',
  
  // Time Constants
  THREE_WEEKS_MS: 21 * 24 * 60 * 60 * 1000,
  ONE_DAY_MS: 24 * 60 * 60 * 1000,
  UPDATE_INTERVAL_MS: 90 * 1000, // 1.5 minutes
  
  // Precision
  PLS_DECIMALS: 18,
  USD_DECIMALS: 2,
  PERCENTAGE_DECIMALS: 2,
  
  // API Endpoints
  COINGECKO_PLS_ID: 'pulsechain',
  
  // File Extensions
  REPORT_EXTENSION: '.json',
  LOG_EXTENSION: '.log'
};

export const ABI = {
  ERC20: [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)'
  ],
  
  PULSEX_PAIR: [
    'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function totalSupply() view returns (uint256)',
    'function kLast() view returns (uint256)',
    'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
    'event Sync(uint112 reserve0, uint112 reserve1)'
  ],
  
  PULSEX_ROUTER: [
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
    'function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)'
  ]
};