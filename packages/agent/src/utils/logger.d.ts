/**
 * Structured Logger
 * Production-ready logging with levels, context, and formatting
 */
export declare enum LogLevel {
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
export declare class Logger {
  private level;
  private enableConsole;
  private enableJson;
  private customHandler?;
  constructor(config?: LoggerConfig);
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  fatal(message: string, error?: Error, context?: LogContext): void;
  private log;
  private logToConsole;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map
