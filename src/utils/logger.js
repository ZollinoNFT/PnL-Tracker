import winston from 'winston';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import config from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure log directory exists
const logDir = dirname(config.logging.logFilePath);
try {
    mkdirSync(logDir, { recursive: true });
} catch (error) {
    // Directory might already exist
}

// Create logger instance
const logger = winston.createLogger({
    level: config.logging.debugMode ? 'debug' : 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'pnl-tracker' },
    transports: [
        // File transport for all logs
        new winston.transports.File({
            filename: config.logging.logFilePath,
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        // File transport for errors
        new winston.transports.File({
            filename: config.logging.logFilePath.replace('.log', '.error.log'),
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        })
    ]
});

// Add console transport in development
if (config.logging.debugMode) {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

export default logger;