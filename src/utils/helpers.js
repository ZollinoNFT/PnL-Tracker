const moment = require('moment');
const logger = require('./logger');

class Helpers {
  static formatBigInt(value, decimals = 18) {
    if (typeof value === 'string') {
      value = BigInt(value);
    }
    
    const divisor = BigInt(10 ** decimals);
    const wholePart = value / divisor;
    const fractionalPart = value % divisor;
    
    const wholeStr = wholePart.toString();
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    
    // Remove trailing zeros from fractional part
    const trimmedFractional = fractionalStr.replace(/0+$/, '');
    
    if (trimmedFractional === '') {
      return wholeStr;
    }
    
    return `${wholeStr}.${trimmedFractional}`;
  }

  static parseToBigInt(value, decimals = 18) {
    if (typeof value === 'bigint') {
      return value;
    }
    
    const str = value.toString();
    const [wholePart, fractionalPart = ''] = str.split('.');
    
    const fractionalPadded = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
    const combined = wholePart + fractionalPadded;
    
    return BigInt(combined);
  }

  static formatPercentage(value, decimals = 2) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(decimals)}%`;
  }

  static formatCurrency(value, currency = 'USD', decimals = 2) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(Math.abs(num));
  }

  static formatLargeNumber(num, decimals = 2) {
    const absNum = Math.abs(num);
    
    if (absNum >= 1e12) {
      return (num / 1e12).toFixed(decimals) + 'T';
    } else if (absNum >= 1e9) {
      return (num / 1e9).toFixed(decimals) + 'B';
    } else if (absNum >= 1e6) {
      return (num / 1e6).toFixed(decimals) + 'M';
    } else if (absNum >= 1e3) {
      return (num / 1e3).toFixed(decimals) + 'K';
    }
    
    return num.toFixed(decimals);
  }

  static calculateTimeDifference(startTimestamp, endTimestamp = null) {
    const start = moment.unix(startTimestamp);
    const end = endTimestamp ? moment.unix(endTimestamp) : moment();
    
    const duration = moment.duration(end.diff(start));
    
    const days = Math.floor(duration.asDays());
    const hours = duration.hours();
    const minutes = duration.minutes();
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  static isValidAddress(address) {
    return typeof address === 'string' && 
           address.startsWith('0x') && 
           address.length === 42 &&
           /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  static normalizeAddress(address) {
    return this.isValidAddress(address) ? address.toLowerCase() : null;
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static retryOperation(operation, maxRetries = 3, delay = 1000) {
    return new Promise(async (resolve, reject) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await operation();
          resolve(result);
          return;
        } catch (error) {
          logger.warn(`Operation failed (attempt ${attempt}/${maxRetries}):`, error.message);
          
          if (attempt === maxRetries) {
            reject(error);
            return;
          }
          
          await this.sleep(delay * attempt); // Exponential backoff
        }
      }
    });
  }

  static sanitizeFileName(filename) {
    return filename.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  }

  static calculateAPR(initialValue, currentValue, daysHeld) {
    if (daysHeld <= 0 || initialValue <= 0) return 0;
    
    const totalReturn = (currentValue - initialValue) / initialValue;
    const annualizedReturn = (totalReturn * 365) / daysHeld;
    
    return annualizedReturn * 100; // Convert to percentage
  }

  static groupBy(array, keyFn) {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {});
  }

  static roundToDecimals(num, decimals = 6) {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  }

  static formatTimestamp(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
    return moment.unix(timestamp).format(format);
  }

  static getCurrentTimestamp() {
    return Math.floor(Date.now() / 1000);
  }

  static validateEnvironment() {
    const required = ['WALLET_ADDRESS'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    if (!this.isValidAddress(process.env.WALLET_ADDRESS)) {
      throw new Error('Invalid WALLET_ADDRESS format');
    }

    return true;
  }

  static createProgressBar(current, total, width = 40) {
    const percentage = Math.min(current / total, 1);
    const filled = Math.floor(percentage * width);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percent = (percentage * 100).toFixed(1);
    
    return `[${bar}] ${percent}% (${current}/${total})`;
  }
}

module.exports = Helpers;