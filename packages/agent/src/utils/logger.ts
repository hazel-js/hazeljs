/**
 * Structured Logger
 * Production-ready logging with levels, context, and formatting
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogContext {
  agentId?: string;
  executionId?: string;
  sessionId?: string;
  toolName?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerConfig {
  level?: LogLevel;
  enableConsole?: boolean;
  enableJson?: boolean;
  customHandler?: (entry: LogEntry) => void;
}

export class Logger {
  private level: LogLevel;
  private enableConsole: boolean;
  private enableJson: boolean;
  private customHandler?: (entry: LogEntry) => void;

  constructor(config: LoggerConfig = {}) {
    this.level = config.level ?? LogLevel.INFO;
    this.enableConsole = config.enableConsole ?? true;
    this.enableJson = config.enableJson ?? false;
    this.customHandler = config.customHandler;
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error
      ? {
          ...context,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : context;
    this.log(LogLevel.ERROR, message, errorContext);
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error
      ? {
          ...context,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : context;
    this.log(LogLevel.FATAL, message, errorContext);
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (level < this.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context,
    };

    if (context?.error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entry.error = context.error as any;
    }

    if (this.customHandler) {
      this.customHandler(entry);
    }

    if (this.enableConsole) {
      this.logToConsole(level, entry);
    }
  }

  private logToConsole(level: LogLevel, entry: LogEntry): void {
    if (this.enableJson) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(entry));
      return;
    }

    const levelColors: Record<LogLevel, string> = {
      [LogLevel.DEBUG]: '\x1b[36m',
      [LogLevel.INFO]: '\x1b[32m',
      [LogLevel.WARN]: '\x1b[33m',
      [LogLevel.ERROR]: '\x1b[31m',
      [LogLevel.FATAL]: '\x1b[35m',
    };

    const reset = '\x1b[0m';
    const color = levelColors[level];
    const levelStr = `${color}[${entry.level}]${reset}`;
    const timestamp = `\x1b[90m${entry.timestamp}${reset}`;

    let logMessage = `${timestamp} ${levelStr} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = JSON.stringify(entry.context, null, 2);
      logMessage += `\n  Context: ${contextStr}`;
    }

    if (entry.error) {
      logMessage += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        logMessage += `\n${entry.error.stack}`;
      }
    }

    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        // eslint-disable-next-line no-console
        console.log(logMessage);
        break;
      case LogLevel.WARN:
        // eslint-disable-next-line no-console
        console.warn(logMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        // eslint-disable-next-line no-console
        console.error(logMessage);
        break;
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }
}

export const logger = new Logger();
