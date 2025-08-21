const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  RPC_URL: 'https://rpc.pulsechain.com',
  PUMP_CONTRACT: '0x6538A83a81d855B965983161AF6a83e616D16fD5',
  PULSEX_FACTORY: '0x1715a3E4A142d8b698131108995174F37aEBA10D',
  WPLS_ADDRESS: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27', // WPLS on PulseChain
  PUSHOVER_TOKEN: 'axjmkeybk32cwbgirsm9fzwucx2iqx',
  PUSHOVER_USER: 'uuk9taq36ue6ckm88frwf3m6vmne6h',
  LOG_FILE: 'pulsex_pairs_log.json',
  POLLING_INTERVAL: 2000, // 2 seconds for faster detection
  STATS_UPDATE_INTERVAL: 15000, // 15 seconds
  FULL_LOG_INTERVAL: 180000, // 3 minutes
  ENABLE_NOTIFICATIONS: true,
  REQUIRE_MIGRATOR: true,
  MIGRATORS: [
    '0x6538A83a81d855B965983161AF6a83e616D16fD5',
    '0xF426c941aEaE3D02c37682dD7654EAc4a338E952'
  ],
  SCAN_CHUNK_SIZE: 2000,
  WSS_URL: '',
  RECENT_LIST_LIMIT: 20,
  EXPLORER_BASE: 'https://scan.pulsechain.com',
  SCANNER_CONFIRMATIONS: 2,
  SCANNER_STEP_BLOCKS: 400,
  SCANNER_INTERVAL_MS: 4000
};

// ABI snippets for the contracts we need
const FACTORY_ABI = [
  'event PairCreated(address indexed token0, address indexed token1, address pair, uint)',
  'function getPair(address tokenA, address tokenB) view returns (address pair)',
  'function allPairs(uint) view returns (address)',
  'function allPairsLength() view returns (uint)'
];

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

// Initialize provider with faster polling
let provider;
if (CONFIG.WSS_URL && CONFIG.WSS_URL.trim() !== '') {
  try {
    provider = new ethers.providers.WebSocketProvider(CONFIG.WSS_URL);
  } catch (err) {
    provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
    provider.pollingInterval = CONFIG.POLLING_INTERVAL;
  }
} else {
  provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
  provider.pollingInterval = CONFIG.POLLING_INTERVAL;
}

// Contract instances
const factory = new ethers.Contract(CONFIG.PULSEX_FACTORY, FACTORY_ABI, provider);

// Stats tracking
let stats = {
  startTime: Date.now(),
  blocksProcessed: 0,
  lastBlockNumber: 0,
  lastBlockTime: null,
  connectionStatus: 'Connecting...',
  eventsChecked: 0,
  lastCheck: null
};

// Track processed transactions to avoid duplicates
const processedTxs = new Set();

const blockTimestampCache = new Map();

function isAddressEqual(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
}

function txMatchesMigratorFilter(tx) {
  if (!CONFIG.REQUIRE_MIGRATOR) return true;
  const toMigrator = !!(tx && CONFIG.MIGRATORS.some(addr => isAddressEqual(tx.to, addr)));
  return toMigrator;
}

async function getBlockTimestamp(blockNumber) {
  if (blockTimestampCache.has(blockNumber)) {
    return blockTimestampCache.get(blockNumber);
  }
  const block = await provider.getBlock(blockNumber);
  const ts = block.timestamp;
  blockTimestampCache.set(blockNumber, ts);
  return ts;
}

// Load or create log file
let pairsLog = [];
const logFilePath = path.join(__dirname, CONFIG.LOG_FILE);

function loadLog() {
  try {
    if (fs.existsSync(logFilePath)) {
      const data = fs.readFileSync(logFilePath, 'utf8');
      pairsLog = JSON.parse(data);
      // Add to processed set
      pairsLog.forEach(entry => processedTxs.add(entry.txHash));
      console.log(`📁 Loaded ${pairsLog.length} existing pairs from log`);
    }
  } catch (error) {
    console.log('📁 No existing log file found, starting fresh');
    pairsLog = [];
  }
}

function saveLog() {
  try {
    fs.writeFileSync(logFilePath, JSON.stringify(pairsLog, null, 2));
  } catch (error) {
    console.error('Error saving log:', error);
  }
}

// Get token info with retry
async function getTokenInfo(tokenAddress, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const [name, symbol] = await Promise.all([
        token.name(),
        token.symbol()
      ]);
      return { name, symbol };
    } catch (error) {
      if (i === retries - 1) {
        console.error(`Error getting token info for ${tokenAddress}:`, error.message);
        return { name: 'Unknown', symbol: 'UNKNOWN' };
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Send Pushover notification
async function sendNotification(ticker, otherTokenAddress, txHash, isTest = false) {
  try {
    if (isTest && !CONFIG.ENABLE_NOTIFICATIONS) {
      console.log('🔕 Notifications disabled (test skipped)');
      return true;
    }
    if (!CONFIG.ENABLE_NOTIFICATIONS && !isTest) {
      return true;
    }

    let message, title;
    
    if (isTest) {
      message = 'PulseX Monitor is now active and watching for new migrations';
      title = '✅ Monitor Started Successfully';
    } else {
      message = `${ticker}/WPLS has just migrated to PulseX`;
      title = '🚀 PulseX Migration Alert';
    }
    
    const payload = {
      token: CONFIG.PUSHOVER_TOKEN,
      user: CONFIG.PUSHOVER_USER,
      message: message,
      title: title,
      priority: isTest ? 0 : 1,
      sound: 'pushover'
    };
    
    if (!isTest) {
      payload.url = `${CONFIG.EXPLORER_BASE}/tx/${txHash}`;
      payload.url_title = 'View Transaction';
      payload.html = 1;
      payload.message = `<b>${ticker}/WPLS</b> has just migrated to PulseX\n\nToken: ${otherTokenAddress}`;
    }
    
    await axios.post('https://api.pushover.net/1/messages.json', payload);
    
    console.log(`✅ Notification sent: ${isTest ? 'Test notification' : message}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending notification:', error.message);
    return false;
  }
}

// Process pair creation event
async function processPairCreation(token0, token1, pair, txHash, blockNumber, timestamp) {
  // Skip if already processed
  if (processedTxs.has(txHash)) {
    return;
  }
  
  // Determine which token is WPLS and which is the other token
  let otherToken;
  let isToken0WPLS = token0.toLowerCase() === CONFIG.WPLS_ADDRESS.toLowerCase();
  let isToken1WPLS = token1.toLowerCase() === CONFIG.WPLS_ADDRESS.toLowerCase();
  
  if (isToken0WPLS) {
    otherToken = token1;
  } else if (isToken1WPLS) {
    otherToken = token0;
  } else {
    // Neither token is WPLS, skip
    return;
  }
  
  // Enforce migrator filter at processing time as a last guard
  try {
    const tx = await provider.getTransaction(txHash);
    if (!txMatchesMigratorFilter(tx)) {
      return;
    }
  } catch (_) {}
  
  // Mark as processed
  processedTxs.add(txHash);
  
  // Get token info
  const tokenInfo = await getTokenInfo(otherToken);
  
  // Optionally fetch tx meta for logging
  let caller = null;
  let callee = null;
  let selector = null;
  let eoa = null;
  let migrator = null;
  try {
    const tx = await provider.getTransaction(txHash);
    caller = tx.from;
    callee = tx.to;
    selector = (tx.data || '').slice(0, 10);
    eoa = tx.from;
    migrator = tx.to;
  } catch (_) {}
  
  // Create log entry
  const logEntry = {
    date: new Date(timestamp * 1000).toISOString(),
    blockNumber,
    ticker: tokenInfo.symbol,
    name: tokenInfo.name,
    otherTokenAddress: otherToken,
    pairAddress: pair,
    txHash,
    caller,
    callee,
    selector,
    eoa,
    migrator
  };
  
  // Add to log and save
  pairsLog.push(logEntry);
  saveLog();
  
  // Nicely formatted console block
  console.log(`\n${'='.repeat(96)}`);
  console.log(`🎯 NEW MIGRATION DETECTED (Filtered)`);
  console.log(`${'='.repeat(96)}`);
  console.log(`⏰ Time    : ${new Date(timestamp * 1000).toLocaleString()}`);
  console.log(`📦 Block   : ${blockNumber}`);
  console.log(`🔍 Tx      : ${txHash}`);
  console.log(`🪙 Token   : ${tokenInfo.symbol} (${tokenInfo.name})`);
  console.log(`📍 Token   : ${otherToken}`);
  console.log(`🔗 Pair    : ${pair}`);
  console.log(`👤 EOA     : ${eoa || 'unknown'}`);
  console.log(`🏗️  Migrator: ${migrator || 'unknown'}`);
  console.log(`🏭 Factory : ${CONFIG.PULSEX_FACTORY}`);
  if (selector) {
    console.log(`🧩 Func    : ${selector}`);
  }
  console.log(`${'='.repeat(96)}\n`);
  
  // Send notification (not for historical events older than 5 minutes)
  const eventAge = Date.now() - (timestamp * 1000);
  if (eventAge < 300000) { // 5 minutes
    await sendNotification(tokenInfo.symbol, otherToken, txHash);
  }
}

// Improved historical fetching - check all createPair transactions
async function fetchHistoricalEvents() {
  console.log('\n📜 Scanning for migrations in the past 24 hours...');
  
  try {
    const currentBlock = await provider.getBlockNumber();
    const blocksPerDay = Math.floor(86400 / 10); // ~8640 blocks per day
    const fromBlock = Math.max(0, currentBlock - blocksPerDay); // 24 hours ago
    
    console.log(`🔍 Scanning blocks ${fromBlock} to ${currentBlock} (last 24 hours)`);

    // We only care about WPLS pairs. Query two filters (token0 = WPLS) OR (token1 = WPLS) and merge.
    const filter0 = factory.filters.PairCreated(CONFIG.WPLS_ADDRESS, null);
    const filter1 = factory.filters.PairCreated(null, CONFIG.WPLS_ADDRESS);

    let allEvents = [];
    for (let start = fromBlock; start <= currentBlock; start += CONFIG.SCAN_CHUNK_SIZE) {
      const end = Math.min(currentBlock, start + CONFIG.SCAN_CHUNK_SIZE - 1);
      const [ev0, ev1] = await Promise.all([
        factory.queryFilter(filter0, start, end),
        factory.queryFilter(filter1, start, end)
      ]);
      const chunkTotal = ev0.length + ev1.length;
      if (chunkTotal > 0) {
        console.log(`   Chunk ${start}-${end}: +${chunkTotal} WPLS PairCreated events`);
      }
      allEvents.push(...ev0, ...ev1);
    }

    // De-duplicate by txHash + pair address and sort by blockNumber asc
    const seen = new Set();
    const deduped = [];
    for (const e of allEvents) {
      const key = `${e.transactionHash}-${e.args.pair}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(e);
      }
    }
    deduped.sort((a, b) => a.blockNumber - b.blockNumber);

    stats.eventsChecked = deduped.length;
    let relevantCount = 0;
    let checkedCount = 0;

    for (const event of deduped) {
      checkedCount++;
      if (checkedCount % 20 === 0) {
        console.log(`   Checking event ${checkedCount}/${deduped.length}...`);
      }

      if (processedTxs.has(event.transactionHash)) {
        continue;
      }

      let allowed = true;
      try {
        const tx = await provider.getTransaction(event.transactionHash);
        allowed = txMatchesMigratorFilter(tx);
      } catch (_) {
        allowed = false;
      }
      if (!allowed) {
        continue;
      }

      const timestamp = await getBlockTimestamp(event.blockNumber);
      await processPairCreation(
        event.args.token0,
        event.args.token1,
        event.args.pair,
        event.transactionHash,
        event.blockNumber,
        timestamp
      );
      relevantCount++;
    }
    
    console.log(`\n✅ Historical scan complete: Found ${relevantCount} filtered WPLS pairs`);
    
    // Double-check recent blocks directly for createPair calls from migrator function
    console.log('\n🔍 Double-checking recent blocks for any missed transactions...');
    await scanRecentBlocks(currentBlock - 100, currentBlock);
    
  } catch (error) {
    console.error('Error fetching historical events:', error.message);
  }
}

// Scan recent blocks for createPair transactions
async function scanRecentBlocks(fromBlock, toBlock) {
  let foundCount = 0;
  
  for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
    try {
      const block = await provider.getBlockWithTransactions(blockNum);
      
      for (const tx of block.transactions) {
        // Check if transaction is from allowed migrator and matches function selector
        if (CONFIG.REQUIRE_MIGRATOR && txMatchesMigratorFilter(tx)) {
          if (!processedTxs.has(tx.hash)) {
            // Get receipt and look for PairCreated from factory
            const receipt = await provider.getTransactionReceipt(tx.hash);
            const pairCreatedTopic = factory.interface.getEventTopic('PairCreated');
            const pairCreatedLog = receipt.logs.find(log => 
              log.topics[0] === pairCreatedTopic &&
              log.address.toLowerCase() === CONFIG.PULSEX_FACTORY.toLowerCase()
            );
            if (pairCreatedLog) {
              const decoded = factory.interface.parseLog(pairCreatedLog);
              console.log(`   Found PairCreated via migrator in block ${blockNum}`);
              await processPairCreation(
                decoded.args.token0,
                decoded.args.token1,
                decoded.args.pair,
                tx.hash,
                blockNum,
                block.timestamp
              );
              foundCount++;
            }
          }
        }
      }
    } catch (error) {
      // Skip blocks that error
    }
  }
  
  if (foundCount > 0) {
    console.log(`   Found ${foundCount} additional transactions`);
  }
}

// Display blockchain info
async function displayBlockchainInfo() {
  try {
    const [blockNumber, block, network] = await Promise.all([
      provider.getBlockNumber(),
      provider.getBlock('latest'),
      provider.getNetwork()
    ]);
    
    let gasPriceGwei = 'n/a';
    try {
      const gasPrice = await provider.getGasPrice();
      gasPriceGwei = ethers.utils.formatUnits(gasPrice, 'gwei');
    } catch (e1) {
      try {
        const fee = await provider.getFeeData();
        if (fee && fee.gasPrice) {
          gasPriceGwei = ethers.utils.formatUnits(fee.gasPrice, 'gwei');
        }
      } catch (e2) {}
    }
    
    stats.lastBlockNumber = blockNumber;
    stats.lastBlockTime = new Date(block.timestamp * 1000);
    stats.connectionStatus = '🟢 Connected';
    stats.lastCheck = new Date();
    
    console.log('\n' + '='.repeat(80));
    console.log('⛓️  BLOCKCHAIN STATUS');
    console.log('='.repeat(80));
    console.log(`📡 Network: PulseChain (Chain ID: ${network.chainId})`);
    console.log(`📦 Current Block: ${blockNumber.toLocaleString()}`);
    console.log(`⏰ Block Time: ${stats.lastBlockTime.toLocaleString()}`);
    console.log(`⛽ Gas Price: ${gasPriceGwei} gwei`);
    console.log(`🔌 Connection: ${stats.connectionStatus}`);
    console.log(`📊 Blocks Processed: ${stats.blocksProcessed}`);
    console.log(`🔍 Last Check: ${stats.lastCheck.toLocaleTimeString()}`);
    
    // Calculate uptime
    const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    console.log(`⏱️  Uptime: ${hours}h ${minutes}m ${seconds}s`);
    
  } catch (error) {
    stats.connectionStatus = '🔴 Disconnected';
    console.error('Error getting blockchain info:', error.message);
  }
}

// Display 24h stats
function display24HourStats() {
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  const last24h = pairsLog.filter(entry => {
    const entryTime = new Date(entry.date).getTime();
    return entryTime >= oneDayAgo;
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('📈 24 HOUR STATISTICS');
  console.log('='.repeat(80));
  console.log(`🚀 Migrations in last 24h: ${last24h.length}`);
  console.log(`📊 Total Pairs Tracked: ${pairsLog.length}`);
  console.log(`🔍 Events Checked: ${stats.eventsChecked}`);
  
  if (last24h.length > 0) {
    const limit = Math.min(CONFIG.RECENT_LIST_LIMIT || 10, last24h.length);
    console.log(`\n📋 Recent Migrations (Last 24h) — showing last ${limit} of ${last24h.length}:`);
    last24h.slice(-limit).reverse().forEach((entry, index) => {
      const timeAgo = getTimeAgo(new Date(entry.date));
      console.log(`   ${index + 1}. ${entry.ticker} - ${timeAgo}`);
      console.log(`      Token   : ${entry.otherTokenAddress}`);
      console.log(`      Pair    : ${entry.pairAddress}`);
      console.log(`      Tx      : ${entry.txHash}`);
      if (entry.eoa || entry.migrator) {
        if (entry.eoa) console.log(`      EOA     : ${entry.eoa}`);
        if (entry.migrator) console.log(`      Migrator: ${entry.migrator}`);
      }
    });
  } else {
    console.log('   No migrations detected yet - monitoring continues...');
  }
}

// Helper function for time ago
function getTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Monitor for new events - more aggressive checking
async function startMonitoring() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 REAL-TIME MONITORING ACTIVE');
  console.log('='.repeat(80));
  console.log(`👀 Watching: ${CONFIG.PUMP_CONTRACT}`);
  console.log(`🏭 Factory: ${CONFIG.PULSEX_FACTORY}`);
  console.log(`⚡ Poll Rate: ${CONFIG.POLLING_INTERVAL}ms (High Frequency)`);
  console.log(`📱 Pushover: ${CONFIG.ENABLE_NOTIFICATIONS ? 'ENABLED' : 'DISABLED'}`);
  if (CONFIG.REQUIRE_MIGRATOR) {
    console.log(`🎛️ Filter : Only tx TO [${CONFIG.MIGRATORS.join(', ')}], which internally call factory ${CONFIG.PULSEX_FACTORY}`);
  }
  
  // Send test notification
  if (CONFIG.ENABLE_NOTIFICATIONS) {
    console.log('\n📱 Sending test notification...');
    const testSuccess = await sendNotification(null, null, null, true);
    if (testSuccess) {
      console.log('✅ Test notification sent! Check your phone.');
    } else {
      console.log('❌ Failed to send test notification. Check API keys.');
    }
  } else {
    console.log('\n🔕 Notifications disabled');
  }
  
  let lastLoggedBlock = 0;
  
  // Lightweight block ticker (no heavy per-block scanning)
  provider.on('block', async (blockNumber) => {
    try {
      stats.blocksProcessed++;
      if (blockNumber % 5 === 0 && blockNumber !== lastLoggedBlock) {
        lastLoggedBlock = blockNumber;
        const timestamp = new Date().toLocaleTimeString();
        process.stdout.write(`\r⚡ [${timestamp}] Block #${blockNumber.toLocaleString()} | Processed: ${stats.blocksProcessed} | Watching...`);
      }
    } catch (error) {
      console.error(`\nError processing block ${blockNumber}:`, error.message);
    }
  });
  
  // Listen to PairCreated events directly (backup method) but filter strictly via tx data and caller
  const filterRt0 = factory.filters.PairCreated(CONFIG.WPLS_ADDRESS, null);
  const filterRt1 = factory.filters.PairCreated(null, CONFIG.WPLS_ADDRESS);

  const onPair = async (token0, token1, pair, event) => {
    try {
      const txHash = event.transactionHash || (event.log && event.log.transactionHash);
      if (processedTxs.has(txHash)) return;

      const tx = await provider.getTransaction(txHash);
      if (!txMatchesMigratorFilter(tx)) return;

      const ts = await getBlockTimestamp(event.blockNumber);
      await processPairCreation(
        token0,
        token1,
        pair,
        txHash,
        event.blockNumber,
        ts
      );
    } catch (error) {
      console.error('Error in event listener:', error.message);
    }
  };

  factory.on(filterRt0, onPair);
  factory.on(filterRt1, onPair);
  
  // Sequential scanner loop to avoid skipping blocks and reduce load
  startScannerLoop().catch((e) => console.error('Scanner loop error:', e.message));
}

let nextBlockToScan = 0;
let scannerBusy = false;

async function scanRangeByLogs(fromBlock, toBlock) {
  const pairCreatedTopic = factory.interface.getEventTopic('PairCreated');
  const wplsTopic = ethers.utils.hexZeroPad(CONFIG.WPLS_ADDRESS, 32);
  const filter0 = {
    address: CONFIG.PULSEX_FACTORY,
    fromBlock,
    toBlock,
    topics: [pairCreatedTopic, wplsTopic]
  };
  const filter1 = {
    address: CONFIG.PULSEX_FACTORY,
    fromBlock,
    toBlock,
    topics: [pairCreatedTopic, null, wplsTopic]
  };
  const [logs0, logs1] = await Promise.all([
    provider.getLogs(filter0),
    provider.getLogs(filter1)
  ]);
  const logs = [...logs0, ...logs1];
  stats.eventsChecked += logs.length;

  for (const log of logs) {
    try {
      const parsed = factory.interface.parseLog(log);
      const txHash = log.transactionHash;
      if (processedTxs.has(txHash)) continue;
      const tx = await provider.getTransaction(txHash);
      if (!txMatchesMigratorFilter(tx)) continue;
      const ts = await getBlockTimestamp(log.blockNumber);
      await processPairCreation(
        parsed.args.token0,
        parsed.args.token1,
        parsed.args.pair,
        txHash,
        log.blockNumber,
        ts
      );
    } catch (_) {}
  }
}

async function startScannerLoop() {
  setInterval(async () => {
    if (scannerBusy) return;
    try {
      scannerBusy = true;
      const current = await provider.getBlockNumber();
      const safeTip = Math.max(0, current - (CONFIG.SCANNER_CONFIRMATIONS || 0));
      if (nextBlockToScan === 0) {
        nextBlockToScan = safeTip; // start at tip to avoid re-sending historical
      }
      if (nextBlockToScan <= safeTip) {
        const end = Math.min(safeTip, nextBlockToScan + (CONFIG.SCANNER_STEP_BLOCKS || 400));
        await scanRangeByLogs(nextBlockToScan, end);
        nextBlockToScan = end + 1;
      }
    } catch (e) {
      // swallow
    } finally {
      scannerBusy = false;
    }
  }, CONFIG.SCANNER_INTERVAL_MS || 4000);
}

// Display full log
function displayFullLog() {
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 MIGRATION LOG');
  console.log('='.repeat(80));
  
  if (pairsLog.length === 0) {
    console.log('No migrations tracked yet');
    return;
  }
  
  // Show last 5 pairs
  const recentPairs = pairsLog.slice(-5).reverse();
  console.log(`Showing last ${Math.min(5, pairsLog.length)} of ${pairsLog.length} total:\n`);
  
  recentPairs.forEach((entry, index) => {
    const timeAgo = getTimeAgo(new Date(entry.date));
    console.log(`${index + 1}. ${entry.ticker} - ${entry.name}`);
    console.log(`   ⏰ ${timeAgo} (${new Date(entry.date).toLocaleString()})`);
    console.log(`   📍 Token: ${entry.otherTokenAddress}`);
    console.log(`   🔗 Pair: ${entry.pairAddress}`);
    console.log('');
  });
}

// Main function
async function main() {
  console.clear();
  console.log('🔍 PULSEX MIGRATION MONITOR v2.0 - HIGH RELIABILITY');
  console.log('='.repeat(80));
  console.log('Initializing...\n');
  
  // Load existing log
  loadLog();
  
  // Display initial blockchain info
  await displayBlockchainInfo();
  
  // Fetch and display historical events
  await fetchHistoricalEvents();
  
  // Display 24h stats after historical fetch
  display24HourStats();
  
  // Start real-time monitoring
  await startMonitoring();
  
  console.log('\n\n' + '='.repeat(80));
  console.log('✅ MONITOR ACTIVE - Watching for migrations...');
  console.log('='.repeat(80) + '\n');
  
  // Update stats more frequently (every 15 seconds)
  setInterval(async () => {
    await displayBlockchainInfo();
    display24HourStats();
  }, CONFIG.STATS_UPDATE_INTERVAL);
  
  // Display full log every 3 minutes
  setInterval(() => {
    displayFullLog();
  }, CONFIG.FULL_LOG_INTERVAL);
}

// Handle errors and cleanup
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error.message);
});

process.on('SIGINT', () => {
  console.log('\n\n' + '='.repeat(80));
  console.log('👋 Shutting down...');
  console.log(`📊 Blocks processed: ${stats.blocksProcessed}`);
  console.log(`💾 Migrations tracked: ${pairsLog.length}`);
  saveLog();
  console.log('✅ Saved and shutdown complete');
  console.log('='.repeat(80));
  process.exit(0);
});

// Start the monitor
main().catch(console.error);