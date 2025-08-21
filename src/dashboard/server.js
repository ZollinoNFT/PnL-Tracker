import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import transactionService from '../services/transactionService.js';
import priceService from '../services/priceService.js';
import pnlCalculator from '../services/pnlCalculator.js';
import reportingService from '../services/reportingService.js';
import scheduler from '../scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DashboardServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    this.port = process.env.PORT || 3000;
    this.clients = new Set();
    this.latestData = null;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
  }

  setupRoutes() {
    // Main dashboard route
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // API Routes
    this.app.get('/api/status', async (req, res) => {
      try {
        const data = await this.getCurrentData();
        res.json({
          success: true,
          data: data
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/pnl', async (req, res) => {
      try {
        const transactions = transactionService.transactions;
        const pnlReport = await pnlCalculator.calculatePnL(transactions);
        
        res.json({
          success: true,
          data: pnlReport
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/positions', async (req, res) => {
      try {
        const transactions = transactionService.transactions;
        const pnlReport = await pnlCalculator.calculatePnL(transactions);
        
        res.json({
          success: true,
          data: pnlReport.positions
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/transactions', async (req, res) => {
      try {
        const { limit = 50, token } = req.query;
        let transactions = transactionService.getLatestTransactions(parseInt(limit));
        
        if (token) {
          transactions = transactionService.getTransactionsByToken(token);
        }
        
        res.json({
          success: true,
          data: transactions
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/reports/daily', async (req, res) => {
      try {
        const report = await reportingService.getLatestDailyReport();
        res.json({
          success: true,
          data: report
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/reports/weekly', async (req, res) => {
      try {
        const report = await reportingService.getLatestWeeklyReport();
        res.json({
          success: true,
          data: report
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.post('/api/force-update', async (req, res) => {
      try {
        await scheduler.forceUpdate();
        res.json({
          success: true,
          message: 'Update triggered successfully'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.post('/api/force-report', async (req, res) => {
      try {
        const { type } = req.body;
        
        if (type === 'daily') {
          await scheduler.forceDailyReport();
        } else if (type === 'weekly') {
          await scheduler.forceWeeklyReport();
        } else {
          throw new Error('Invalid report type. Use "daily" or "weekly"');
        }
        
        res.json({
          success: true,
          message: `${type} report generated successfully`
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/scheduler/status', (req, res) => {
      try {
        const status = scheduler.getStatus();
        res.json({
          success: true,
          data: status
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('Client connected to WebSocket');
      this.clients.add(ws);

      // Send current data to new client
      if (this.latestData) {
        ws.send(JSON.stringify({
          type: 'data-update',
          data: this.latestData
        }));
      }

      ws.on('close', () => {
        console.log('Client disconnected from WebSocket');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });

    // Broadcast updates every 30 seconds
    setInterval(async () => {
      await this.broadcastUpdate();
    }, 30000);
  }

  async getCurrentData() {
    try {
      const transactions = transactionService.transactions;
      const pnlReport = await pnlCalculator.calculatePnL(transactions);
      const plsPrice = priceService.getCurrentPLSPrice();
      const schedulerStatus = scheduler.getStatus();
      
      return {
        timestamp: Date.now(),
        plsPrice: plsPrice,
        plsPriceFormatted: priceService.formatUSDAmount(plsPrice),
        summary: pnlReport.summary,
        positions: pnlReport.positions,
        recentTransactions: transactionService.getLatestTransactions(10),
        scheduler: schedulerStatus,
        stats: {
          totalTransactions: transactionService.getTransactionCount(),
          totalTokens: transactionService.getAllTokens().length,
          lastUpdate: schedulerStatus.lastUpdateFormatted
        }
      };
    } catch (error) {
      console.error('Error getting current data:', error);
      return null;
    }
  }

  async broadcastUpdate() {
    if (this.clients.size === 0) return;

    try {
      const data = await this.getCurrentData();
      if (data) {
        this.latestData = data;
        
        const message = JSON.stringify({
          type: 'data-update',
          data: data
        });

        this.clients.forEach(client => {
          if (client.readyState === client.OPEN) {
            client.send(message);
          }
        });
      }
    } catch (error) {
      console.error('Error broadcasting update:', error);
    }
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`\n🚀 PnL Dashboard Server started`);
      console.log(`📊 Dashboard: http://localhost:${this.port}`);
      console.log(`🔌 WebSocket: ws://localhost:${this.port}`);
      console.log(`📡 API: http://localhost:${this.port}/api/status`);
    });

    // Initial data load
    setTimeout(async () => {
      await this.broadcastUpdate();
    }, 2000);
  }

  stop() {
    this.server.close();
    this.wss.close();
  }
}

export default DashboardServer;