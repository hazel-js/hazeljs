import winston from 'winston';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { IncomingMessage, ServerResponse } from 'http';

// Load environment variables
dotenv.config();

const logLevel = process.env.LOG_LEVEL || 'info';
const logDir = process.env.LOG_DIR || 'logs';

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Professional color scheme for different log levels
const colors = {
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.blue,
  http: chalk.magenta,
  debug: chalk.gray,
  silly: chalk.gray,
};

// Professional category-based coloring
const categoryColors: Record<string, (text: string) => string> = {
  // Module operations
  'Initializing HazelModule': chalk.blue.bold,
  'Initializing module': chalk.blue.bold,
  'Initializing imported modules': chalk.blue,
  'Initializing HazelApp': chalk.cyan.bold,

  // Provider operations
  'Registering providers': chalk.green.bold,
  'Registering provider': chalk.green,
  'Created instance of': chalk.green,

  // Controller operations
  'Registering controllers': chalk.yellow.bold,
  'Registering controller': chalk.yellow,

  // Route operations
  'Registering route': chalk.magenta.bold,

  // Server operations
  'Server listening on': chalk.green.bold,
  'Application started': chalk.cyan.bold,
  'Connected to database': chalk.green.bold,
  'Disconnected from database': chalk.yellow,

  // Cache operations
  'Cache service initialized': chalk.blue,
  'Cache registered': chalk.green,
  'Configuring cache module': chalk.blue,

  // Configuration
  'Configuration loaded': chalk.green,
  Configuring: chalk.blue,

  // Container
  'Container initialized': chalk.cyan.bold,
};

// Helper to detect log category and apply appropriate color
const getCategoryColor = (message: string): ((text: string) => string) => {
  for (const [category, colorFn] of Object.entries(categoryColors)) {
    if (message.includes(category)) {
      return colorFn;
    }
  }
  return chalk.white;
};

// Custom format for better readability with enhanced colors
const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  // Get the appropriate color for the log level
  const levelColor = colors[level as keyof typeof colors] || chalk.white;

  // Format the timestamp with subtle color
  const time = chalk.gray.dim(timestamp as string);

  // Format the level with color and padding (no icons for professional look)
  const levelStr = levelColor.bold(`[${level.toUpperCase()}]`.padEnd(9));

  // Convert message to string
  const messageStr = String(message);

  // Detect category and apply appropriate color to message
  const categoryColor = getCategoryColor(messageStr);
  let msg = categoryColor(messageStr);

  // Special formatting for important messages
  if (messageStr.includes('Server listening on')) {
    msg = chalk.green.bold(messageStr);
  } else if (messageStr.includes('Application started')) {
    msg = chalk.cyan.bold(messageStr);
  } else if (messageStr.includes('→ Local:') || messageStr.includes('→ Network:')) {
    msg = chalk.green(messageStr);
  }

  // Format metadata if present with enhanced colors
  let metaStr = '';
  if (Object.keys(metadata).length > 0) {
    metaStr = Object.entries(metadata)
      .map(([key, value]) => {
        // Color keys based on their type
        let keyColor = chalk.cyan;
        if (key.includes('module') || key.includes('Module')) {
          keyColor = chalk.blue;
        } else if (
          key.includes('provider') ||
          key.includes('Provider') ||
          key.includes('Service')
        ) {
          keyColor = chalk.green;
        } else if (key.includes('controller') || key.includes('Controller')) {
          keyColor = chalk.yellow;
        } else if (key.includes('route') || key.includes('Route')) {
          keyColor = chalk.magenta;
        }

        const formattedKey = keyColor.bold(key);

        // Use a custom replacer function to handle circular references
        const seen = new WeakSet();
        const safeValue = JSON.stringify(value, (key, val) => {
          // Skip known circular references
          if (key === 'socket' || key === 'parser' || key === 'res' || key === 'req') {
            return '[Circular]';
          }
          // Skip Node.js internal objects
          if (key === '_idlePrev' || key === '_idleNext' || key === 'cleanupInterval') {
            return '[Internal]';
          }
          // Handle circular references
          if (typeof val === 'object' && val !== null) {
            if (seen.has(val)) {
              return '[Circular]';
            }
            seen.add(val);
          }
          return val;
        });

        // Color values based on their content
        let valueColor = chalk.yellow;
        if (typeof value === 'string') {
          if (
            value.includes('Module') ||
            value.includes('Service') ||
            value.includes('Controller')
          ) {
            valueColor = chalk.cyan;
          } else if (value.includes('http://') || value.includes('localhost')) {
            valueColor = chalk.green;
          }
        }

        const formattedValue = valueColor(safeValue);
        return `${formattedKey}=${formattedValue}`;
      })
      .join(' ');
    metaStr = chalk.gray.dim(' | ') + metaStr;
  }

  return `${time} ${levelStr} ${msg}${metaStr}`;
});

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    customFormat
  ),
  transports: [
    // Console transport with colors
    new winston.transports.Console({
      format: winston.format.combine(customFormat),
    }),
    // File transport for all logs (without colors)
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          let msg = `${timestamp} [${level.toUpperCase()}] ${message}`;
          if (Object.keys(metadata).length > 0) {
            msg += ` | ${JSON.stringify(metadata, (key, val) => {
              if (key === 'socket' || key === 'parser' || key === 'res' || key === 'req') {
                return '[Circular]';
              }
              return val;
            })}`;
          }
          return msg;
        })
      ),
    }),
    // File transport for errors only (without colors)
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          let msg = `${timestamp} [${level.toUpperCase()}] ${message}`;
          if (Object.keys(metadata).length > 0) {
            msg += ` | ${JSON.stringify(metadata, (key, val) => {
              if (key === 'socket' || key === 'parser' || key === 'res' || key === 'req') {
                return '[Circular]';
              }
              return val;
            })}`;
          }
          return msg;
        })
      ),
    }),
  ],
});

// Log application info when starting
const appInfo = {
  service: process.env.APP_NAME || 'hazeljs',
  version: process.env.APP_VERSION || '0.1.0',
  environment: process.env.NODE_ENV || 'development',
};

logger.info(chalk.cyan.bold('Application started'), appInfo);

// Add request logging middleware with beautiful formatting
export const requestLogger = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
): void => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor =
      res.statusCode >= 500
        ? chalk.red
        : res.statusCode >= 400
          ? chalk.yellow
          : res.statusCode >= 300
            ? chalk.cyan
            : res.statusCode >= 200
              ? chalk.green
              : chalk.white;

    logger.info(`${chalk.bold(req.method)} ${req.url}`, {
      status: statusColor(res.statusCode),
      duration: chalk.yellow(`${duration}ms`),
      userAgent: chalk.gray(req.headers['user-agent']),
      ip: chalk.gray(req.socket.remoteAddress),
    });
  });
  next();
};

// Export logger instance
export default logger;
