"use strict";
/**
 * Structured Logger
 * Production-ready logging with levels, context, and formatting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["FATAL"] = 4] = "FATAL";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor(config = {}) {
        this.level = config.level ?? LogLevel.INFO;
        this.enableConsole = config.enableConsole ?? true;
        this.enableJson = config.enableJson ?? false;
        this.customHandler = config.customHandler;
    }
    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context);
    }
    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }
    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }
    error(message, error, context) {
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
    fatal(message, error, context) {
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
    log(level, message, context) {
        if (level < this.level) {
            return;
        }
        const entry = {
            timestamp: new Date().toISOString(),
            level: LogLevel[level],
            message,
            context,
        };
        if (context?.error) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            entry.error = context.error;
        }
        if (this.customHandler) {
            this.customHandler(entry);
        }
        if (this.enableConsole) {
            this.logToConsole(level, entry);
        }
    }
    logToConsole(level, entry) {
        if (this.enableJson) {
            // eslint-disable-next-line no-console
            console.log(JSON.stringify(entry));
            return;
        }
        const levelColors = {
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
    setLevel(level) {
        this.level = level;
    }
    getLevel() {
        return this.level;
    }
}
exports.Logger = Logger;
exports.logger = new Logger();
