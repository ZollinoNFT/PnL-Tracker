const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class Database {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.initDatabase();
  }

  initDatabase() {
    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        logger.error('Error opening database:', err.message);
        throw err;
      }
      logger.info('Connected to SQLite database');
      this.createTables();
    });
  }

  createTables() {
    const tables = [
      // Transactions table
      `CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT UNIQUE NOT NULL,
        block_number INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        value TEXT NOT NULL,
        gas_price TEXT,
        gas_used INTEGER,
        token_address TEXT,
        token_amount TEXT,
        token_symbol TEXT,
        transaction_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Tokens table
      `CREATE TABLE IF NOT EXISTS tokens (
        address TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        decimals INTEGER NOT NULL,
        launch_date TEXT,
        total_supply TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Trades table (processed transactions)
      `CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_hash TEXT NOT NULL,
        token_address TEXT NOT NULL,
        trade_type TEXT NOT NULL, -- 'BUY' or 'SELL'
        pls_amount TEXT NOT NULL,
        token_amount TEXT NOT NULL,
        price_per_token_pls TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        block_number INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (token_address) REFERENCES tokens (address)
      )`,

      // Holdings table (current positions)
      `CREATE TABLE IF NOT EXISTS holdings (
        token_address TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        total_bought_pls TEXT NOT NULL DEFAULT '0',
        total_sold_pls TEXT NOT NULL DEFAULT '0',
        current_balance TEXT NOT NULL DEFAULT '0',
        average_buy_price_pls TEXT NOT NULL DEFAULT '0',
        first_buy_timestamp INTEGER,
        last_trade_timestamp INTEGER,
        trade_count INTEGER DEFAULT 0,
        realized_pnl_pls TEXT NOT NULL DEFAULT '0',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (token_address) REFERENCES tokens (address)
      )`,

      // Price history table
      `CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_address TEXT NOT NULL,
        price_usd TEXT NOT NULL,
        price_pls TEXT,
        timestamp INTEGER NOT NULL,
        source TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Daily reports table
      `CREATE TABLE IF NOT EXISTS daily_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_date TEXT NOT NULL UNIQUE,
        total_pnl_pls TEXT NOT NULL,
        total_pnl_usd TEXT NOT NULL,
        daily_trades INTEGER NOT NULL,
        active_positions INTEGER NOT NULL,
        realized_pnl_pls TEXT NOT NULL,
        unrealized_pnl_pls TEXT NOT NULL,
        pls_price_usd TEXT NOT NULL,
        report_data TEXT, -- JSON string with detailed data
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    tables.forEach((tableSQL, index) => {
      this.db.run(tableSQL, (err) => {
        if (err) {
          logger.error(`Error creating table ${index + 1}:`, err.message);
        } else {
          logger.info(`Table ${index + 1} created or verified successfully`);
        }
      });
    });

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_token ON transactions(token_address)',
      'CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_trades_token ON trades(token_address)',
      'CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_price_history_token ON price_history(token_address)'
    ];

    indexes.forEach(indexSQL => {
      this.db.run(indexSQL, (err) => {
        if (err) {
          logger.error('Error creating index:', err.message);
        }
      });
    });
  }

  // Transaction methods
  async insertTransaction(transaction) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO transactions 
        (hash, block_number, timestamp, from_address, to_address, value, 
         gas_price, gas_used, token_address, token_amount, token_symbol, transaction_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        transaction.hash,
        transaction.blockNumber,
        transaction.timestamp,
        transaction.from,
        transaction.to,
        transaction.value,
        transaction.gasPrice,
        transaction.gasUsed,
        transaction.tokenAddress,
        transaction.tokenAmount,
        transaction.tokenSymbol,
        transaction.type
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      
      stmt.finalize();
    });
  }

  // Token methods
  async insertOrUpdateToken(token) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO tokens 
        (address, symbol, name, decimals, launch_date, total_supply, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run([
        token.address,
        token.symbol,
        token.name,
        token.decimals,
        token.launchDate,
        token.totalSupply
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      
      stmt.finalize();
    });
  }

  // Trade methods
  async insertTrade(trade) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO trades 
        (transaction_hash, token_address, trade_type, pls_amount, token_amount, 
         price_per_token_pls, timestamp, block_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        trade.transactionHash,
        trade.tokenAddress,
        trade.tradeType,
        trade.plsAmount,
        trade.tokenAmount,
        trade.pricePerTokenPls,
        trade.timestamp,
        trade.blockNumber
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      
      stmt.finalize();
    });
  }

  // Holdings methods
  async updateHolding(holding) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO holdings 
        (token_address, symbol, total_bought_pls, total_sold_pls, current_balance,
         average_buy_price_pls, first_buy_timestamp, last_trade_timestamp, 
         trade_count, realized_pnl_pls, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run([
        holding.tokenAddress,
        holding.symbol,
        holding.totalBoughtPls,
        holding.totalSoldPls,
        holding.currentBalance,
        holding.averageBuyPricePls,
        holding.firstBuyTimestamp,
        holding.lastTradeTimestamp,
        holding.tradeCount,
        holding.realizedPnlPls
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
      
      stmt.finalize();
    });
  }

  // Price history methods
  async insertPriceHistory(priceData) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO price_history (token_address, price_usd, price_pls, timestamp, source)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        priceData.tokenAddress,
        priceData.priceUsd,
        priceData.pricePls,
        priceData.timestamp,
        priceData.source
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      
      stmt.finalize();
    });
  }

  // Query methods
  async getTransactionsSince(timestamp) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM transactions WHERE timestamp >= ? ORDER BY timestamp DESC',
        [timestamp],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  async getHoldings() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT h.*, t.name, t.decimals 
         FROM holdings h 
         JOIN tokens t ON h.token_address = t.address 
         WHERE h.current_balance != '0'
         ORDER BY h.last_trade_timestamp DESC`,
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  async getTradesSince(timestamp) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT t.*, tk.symbol, tk.name 
         FROM trades t 
         JOIN tokens tk ON t.token_address = tk.address 
         WHERE t.timestamp >= ? 
         ORDER BY t.timestamp DESC`,
        [timestamp],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  async getLatestPrices() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT DISTINCT token_address, price_usd, price_pls, timestamp
         FROM price_history p1
         WHERE timestamp = (
           SELECT MAX(timestamp) 
           FROM price_history p2 
           WHERE p2.token_address = p1.token_address
         )`,
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  async insertDailyReport(report) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO daily_reports 
        (report_date, total_pnl_pls, total_pnl_usd, daily_trades, active_positions,
         realized_pnl_pls, unrealized_pnl_pls, pls_price_usd, report_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        report.date,
        report.totalPnlPls,
        report.totalPnlUsd,
        report.dailyTrades,
        report.activePositions,
        report.realizedPnlPls,
        report.unrealizedPnlPls,
        report.plsPriceUsd,
        JSON.stringify(report.detailedData)
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      
      stmt.finalize();
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          logger.error('Error closing database:', err.message);
        } else {
          logger.info('Database connection closed');
        }
      });
    }
  }
}

module.exports = Database;