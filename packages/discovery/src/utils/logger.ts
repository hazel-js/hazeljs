/**
 * Pluggable logger for @hazeljs/discovery
 *
 * Consumers can supply their own logger via DiscoveryLogger.setLogger().
 * The default logger writes to the console.
 */

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

const defaultLogger: Logger = {
  // eslint-disable-next-line no-console
  debug: (msg, ...args) => console.debug(`[discovery] ${msg}`, ...args),
  // eslint-disable-next-line no-console
  info: (msg, ...args) => console.info(`[discovery] ${msg}`, ...args),
  // eslint-disable-next-line no-console
  warn: (msg, ...args) => console.warn(`[discovery] ${msg}`, ...args),
  // eslint-disable-next-line no-console
  error: (msg, ...args) => console.error(`[discovery] ${msg}`, ...args),
};

let currentLogger: Logger = defaultLogger;

export const DiscoveryLogger = {
  /** Replace the default console logger with a custom implementation */
  setLogger(logger: Logger): void {
    currentLogger = logger;
  },

  /** Reset to the default console logger */
  resetLogger(): void {
    currentLogger = defaultLogger;
  },

  /** Get the current logger instance */
  getLogger(): Logger {
    return currentLogger;
  },
};
