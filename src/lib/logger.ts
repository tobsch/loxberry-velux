/**
 * Logger configuration for KLF200 Plugin
 */

import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

let logger: winston.Logger | null = null;

export interface LoggerOptions {
  level: string;
  logDir: string;
  maxFiles: number;
  maxSize: string;
}

/**
 * Initialize the logger
 */
export function initLogger(options: LoggerOptions): winston.Logger {
  // Ensure log directory exists
  if (!fs.existsSync(options.logDir)) {
    fs.mkdirSync(options.logDir, { recursive: true });
  }

  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
      if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
      }
      if (stack) {
        log += `\n${stack}`;
      }
      return log;
    })
  );

  logger = winston.createLogger({
    level: options.level,
    format: logFormat,
    transports: [
      // Console output
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          logFormat
        )
      }),
      // File output
      new winston.transports.File({
        filename: path.join(options.logDir, 'klf200.log'),
        maxsize: parseSize(options.maxSize),
        maxFiles: options.maxFiles,
        tailable: true
      }),
      // Error file
      new winston.transports.File({
        filename: path.join(options.logDir, 'klf200-error.log'),
        level: 'error',
        maxsize: parseSize(options.maxSize),
        maxFiles: options.maxFiles,
        tailable: true
      })
    ]
  });

  return logger;
}

/**
 * Get the logger instance
 */
export function getLogger(): winston.Logger {
  if (!logger) {
    // Return a default console logger if not initialized
    return winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [new winston.transports.Console()]
    });
  }
  return logger;
}

/**
 * Parse size string to bytes
 */
function parseSize(size: string): number {
  const match = size.match(/^(\d+)([kmg])?$/i);
  if (!match) {
    return 10 * 1024 * 1024; // Default 10MB
  }

  const value = parseInt(match[1], 10);
  const unit = (match[2] || 'b').toLowerCase();

  switch (unit) {
    case 'k':
      return value * 1024;
    case 'm':
      return value * 1024 * 1024;
    case 'g':
      return value * 1024 * 1024 * 1024;
    default:
      return value;
  }
}
