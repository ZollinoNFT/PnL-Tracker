class PnLDashboard {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.currentData = null;
        this.currentTab = 'positions';
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupWebSocket();
        await this.loadInitialData();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Force update button
        document.getElementById('force-update-btn').addEventListener('click', () => {
            this.forceUpdate();
        });

        // Report generation buttons
        document.getElementById('generate-daily-btn').addEventListener('click', () => {
            this.generateReport('daily');
        });

        document.getElementById('generate-weekly-btn').addEventListener('click', () => {
            this.generateReport('weekly');
        });

        // Filter controls
        document.getElementById('position-filter').addEventListener('change', (e) => {
            this.filterPositions(e.target.value);
        });

        document.getElementById('transaction-limit').addEventListener('change', (e) => {
            this.loadTransactions(parseInt(e.target.value));
        });
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('connected');
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.updateConnectionStatus('disconnected');
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('disconnected');
            };

        } catch (error) {
            console.error('Error setting up WebSocket:', error);
            this.updateConnectionStatus('disconnected');
        }
    }

    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'data-update':
                this.currentData = message.data;
                this.updateDashboard(message.data);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.updateConnectionStatus('connecting');
            
            setTimeout(() => {
                console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                this.setupWebSocket();
            }, this.reconnectDelay);
        } else {
            console.log('Max reconnection attempts reached');
            this.updateConnectionStatus('disconnected');
        }
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connection-status');
        const statusText = statusElement.querySelector('span');
        
        statusElement.className = `connection-status ${status}`;
        
        switch (status) {
            case 'connected':
                statusText.textContent = 'Connected';
                break;
            case 'connecting':
                statusText.textContent = 'Connecting...';
                break;
            case 'disconnected':
                statusText.textContent = 'Disconnected';
                break;
        }
    }

    async loadInitialData() {
        try {
            const response = await fetch('/api/status');
            const result = await response.json();
            
            if (result.success) {
                this.currentData = result.data;
                this.updateDashboard(result.data);
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Failed to load initial data', 'error');
        }
    }

    updateDashboard(data) {
        this.updateSummaryCards(data);
        this.updatePositionsTable(data.positions);
        this.updateSettings(data);
        
        // Update header stats
        document.getElementById('pls-price').textContent = data.plsPriceFormatted;
        document.getElementById('last-update').textContent = data.stats.lastUpdate || 'Never';
    }

    updateSummaryCards(data) {
        const { summary } = data;
        
        // Total PnL
        const totalPnL = parseFloat(summary.totalPnL);
        const totalPnLCard = document.getElementById('total-pnl-card');
        totalPnLCard.className = `card summary-card ${totalPnL >= 0 ? 'positive' : 'negative'}`;
        
        document.getElementById('total-pnl').textContent = this.formatPnL(summary.totalPnL, data.plsPrice);
        
        // Realized PnL
        const realizedPnL = parseFloat(summary.totalRealizedPnL);
        const realizedPnLCard = document.getElementById('realized-pnl-card');
        realizedPnLCard.className = `card summary-card ${realizedPnL >= 0 ? 'positive' : 'negative'}`;
        
        document.getElementById('realized-pnl').textContent = this.formatPnL(summary.totalRealizedPnL, data.plsPrice);
        
        // Unrealized PnL
        const unrealizedPnL = parseFloat(summary.totalUnrealizedPnL);
        const unrealizedPnLCard = document.getElementById('unrealized-pnl-card');
        unrealizedPnLCard.className = `card summary-card ${unrealizedPnL >= 0 ? 'positive' : 'negative'}`;
        
        document.getElementById('unrealized-pnl').textContent = this.formatPnL(summary.totalUnrealizedPnL, data.plsPrice);
        
        // Trading stats
        document.getElementById('active-positions').textContent = summary.activePositions;
        document.getElementById('total-trades').textContent = summary.totalTrades;
        document.getElementById('total-tokens').textContent = data.stats.totalTokens;
    }

    updatePositionsTable(positions) {
        const tbody = document.getElementById('positions-tbody');
        
        if (!positions || positions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="loading">No positions found</td></tr>';
            return;
        }

        tbody.innerHTML = positions.map(position => {
            const pnl = parseFloat(position.pnl.totalPnL);
            const pnlPercent = parseFloat(position.pnl.totalPnLPercent);
            
            return `
                <tr>
                    <td>
                        <div class="token-symbol">${position.token.symbol}</div>
                        <div class="token-name">${position.token.name}</div>
                    </td>
                    <td>${this.formatNumber(position.trading.currentHolding)}</td>
                    <td>${this.formatNumber(position.pricing.averageBuyPrice)} PLS</td>
                    <td>${this.formatNumber(position.pricing.currentPrice)} PLS</td>
                    <td class="${pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}">
                        ${this.formatPnL(position.pnl.totalPnL, this.currentData?.plsPrice)}
                    </td>
                    <td class="${pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}">
                        ${pnlPercent.toFixed(2)}%
                    </td>
                    <td>${this.formatUSD(position.pnl.totalPnLUSD)}</td>
                    <td>${position.trading.tradeCount}</td>
                    <td>${position.timing.holdDays}d ${position.timing.holdHours}h</td>
                    <td class="${position.trading.isActive ? 'status-active' : 'status-closed'}">
                        ${position.trading.isActive ? 'Active' : 'Closed'}
                    </td>
                </tr>
            `;
        }).join('');
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        this.currentTab = tabName;

        // Load tab-specific data
        if (tabName === 'transactions') {
            this.loadTransactions();
        } else if (tabName === 'reports') {
            this.loadReports();
        }
    }

    async loadTransactions(limit = 50) {
        try {
            const response = await fetch(`/api/transactions?limit=${limit}`);
            const result = await response.json();
            
            if (result.success) {
                this.updateTransactionsTable(result.data);
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    }

    updateTransactionsTable(transactions) {
        const tbody = document.getElementById('transactions-tbody');
        
        if (!transactions || transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="loading">No transactions found</td></tr>';
            return;
        }

        tbody.innerHTML = transactions.map(tx => {
            return `
                <tr>
                    <td>${new Date(tx.timestamp).toLocaleString()}</td>
                    <td class="${tx.isBuy ? 'trade-buy' : 'trade-sell'}">
                        ${tx.isBuy ? 'BUY' : 'SELL'}
                    </td>
                    <td>
                        <div class="token-symbol">${tx.tokenInfo.symbol}</div>
                        <div class="token-name">${tx.tokenInfo.name}</div>
                    </td>
                    <td>${this.formatNumber(tx.tokenAmount)}</td>
                    <td>${this.formatNumber(tx.plsAmount)} PLS</td>
                    <td>${this.formatNumber(tx.price)} PLS</td>
                    <td>${this.formatUSD(parseFloat(tx.plsAmount) * (this.currentData?.plsPrice || 0))}</td>
                    <td>
                        <a href="https://scan.pulsechain.com/tx/${tx.hash}" target="_blank" class="tx-hash">
                            ${tx.hash.slice(0, 10)}...
                        </a>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async loadReports() {
        try {
            const [dailyResponse, weeklyResponse] = await Promise.all([
                fetch('/api/reports/daily'),
                fetch('/api/reports/weekly')
            ]);

            const dailyResult = await dailyResponse.json();
            const weeklyResult = await weeklyResponse.json();

            if (dailyResult.success && dailyResult.data) {
                this.updateDailyReport(dailyResult.data);
            }

            if (weeklyResult.success && weeklyResult.data) {
                this.updateWeeklyReport(weeklyResult.data);
            }
        } catch (error) {
            console.error('Error loading reports:', error);
        }
    }

    updateDailyReport(report) {
        const content = document.getElementById('daily-report-content');
        content.innerHTML = `
            <div class="report-summary">
                <h4>Daily Report - ${report.metadata.date}</h4>
                <div class="report-stats">
                    <div class="stat-row">
                        <span>Day PnL:</span>
                        <span class="${parseFloat(report.dailyMetrics.dayPnL) >= 0 ? 'pnl-positive' : 'pnl-negative'}">
                            ${this.formatPnL(report.dailyMetrics.dayPnL, report.metadata.plsPrice)}
                        </span>
                    </div>
                    <div class="stat-row">
                        <span>Trades Executed:</span>
                        <span>${report.dailyMetrics.tradesExecuted}</span>
                    </div>
                    <div class="stat-row">
                        <span>New Positions:</span>
                        <span>${report.dailyMetrics.newPositionsOpened}</span>
                    </div>
                    <div class="stat-row">
                        <span>Closed Positions:</span>
                        <span>${report.dailyMetrics.positionsClosed}</span>
                    </div>
                </div>
            </div>
        `;
    }

    updateWeeklyReport(report) {
        const content = document.getElementById('weekly-report-content');
        content.innerHTML = `
            <div class="report-summary">
                <h4>Weekly Report - ${report.metadata.weekStart} to ${report.metadata.weekEnd}</h4>
                <div class="report-stats">
                    <div class="stat-row">
                        <span>Week PnL:</span>
                        <span class="${parseFloat(report.weeklyMetrics.weekPnL) >= 0 ? 'pnl-positive' : 'pnl-negative'}">
                            ${this.formatPnL(report.weeklyMetrics.weekPnL, report.metadata.plsPrice)}
                        </span>
                    </div>
                    <div class="stat-row">
                        <span>Total Trades:</span>
                        <span>${report.weeklyMetrics.totalTrades}</span>
                    </div>
                    <div class="stat-row">
                        <span>Trading Days:</span>
                        <span>${report.weeklyMetrics.tradingDays}/7</span>
                    </div>
                    <div class="stat-row">
                        <span>Average Daily PnL:</span>
                        <span>${this.formatPnL(report.weeklyMetrics.averageDailyPnL, report.metadata.plsPrice)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    updateSettings(data) {
        document.getElementById('wallet-address').value = process.env.WALLET_ADDRESS || 'Not set';
        document.getElementById('update-interval').textContent = `${data.scheduler.updateInterval / 1000} seconds`;
        
        const schedulerStatus = document.getElementById('scheduler-status');
        schedulerStatus.textContent = data.scheduler.isRunning ? 'Running' : 'Stopped';
        schedulerStatus.className = `status-indicator ${data.scheduler.isRunning ? 'status-running' : 'status-stopped'}`;
        
        document.getElementById('next-update').textContent = data.scheduler.nextUpdateFormatted || 'Unknown';
        document.getElementById('total-transactions').textContent = data.stats.totalTransactions;
    }

    filterPositions(filter) {
        const rows = document.querySelectorAll('#positions-tbody tr');
        
        rows.forEach(row => {
            const statusCell = row.querySelector('td:last-child');
            const pnlCell = row.querySelector('td:nth-child(5)');
            
            if (!statusCell || !pnlCell) return;
            
            const isActive = statusCell.textContent.trim() === 'Active';
            const pnlValue = parseFloat(pnlCell.textContent.replace(/[^\d.-]/g, ''));
            
            let show = true;
            
            switch (filter) {
                case 'active':
                    show = isActive;
                    break;
                case 'closed':
                    show = !isActive;
                    break;
                case 'profitable':
                    show = pnlValue > 0;
                    break;
                case 'losing':
                    show = pnlValue < 0;
                    break;
                case 'all':
                default:
                    show = true;
            }
            
            row.style.display = show ? '' : 'none';
        });
    }

    async forceUpdate() {
        try {
            const button = document.getElementById('force-update-btn');
            const originalText = button.innerHTML;
            
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            button.disabled = true;
            
            const response = await fetch('/api/force-update', {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Update triggered successfully', 'success');
            } else {
                this.showNotification(result.error || 'Update failed', 'error');
            }
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.disabled = false;
            }, 2000);
            
        } catch (error) {
            console.error('Error forcing update:', error);
            this.showNotification('Failed to trigger update', 'error');
        }
    }

    async generateReport(type) {
        try {
            const button = document.getElementById(`generate-${type}-btn`);
            const originalText = button.innerHTML;
            
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            button.disabled = true;
            
            const response = await fetch('/api/force-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(`${type} report generated successfully`, 'success');
                setTimeout(() => this.loadReports(), 1000);
            } else {
                this.showNotification(result.error || 'Report generation failed', 'error');
            }
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.disabled = false;
            }, 2000);
            
        } catch (error) {
            console.error('Error generating report:', error);
            this.showNotification('Failed to generate report', 'error');
        }
    }

    formatNumber(value, decimals = 2) {
        const num = parseFloat(value);
        if (isNaN(num)) return '0';
        
        if (num >= 1000000) {
            return (num / 1000000).toFixed(decimals) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(decimals) + 'K';
        } else {
            return num.toFixed(decimals);
        }
    }

    formatPnL(plsAmount, plsPrice) {
        const pls = parseFloat(plsAmount);
        const usd = pls * (plsPrice || 0);
        const sign = pls >= 0 ? '+' : '';
        
        return `${sign}${this.formatNumber(pls)} PLS (~${this.formatUSD(usd)})`;
    }

    formatUSD(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
        }).format(amount);
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PnLDashboard();
});