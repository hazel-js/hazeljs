"use strict";
/**
 * Agent Event Emitter
 * Handles event emission and subscription for agent runtime
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentEventEmitter = void 0;
const logger_1 = require("../utils/logger");
/**
 * Agent Event Emitter
 * Pub/sub system for agent runtime events
 */
class AgentEventEmitter {
    constructor() {
        this.handlers = new Map();
        this.wildcardHandlers = new Set();
        this.logger = new logger_1.Logger({ level: logger_1.LogLevel.WARN });
    }
    /**
     * Subscribe to an event type
     */
    on(type, handler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }
        this.handlers.get(type).add(handler);
    }
    /**
     * Subscribe to all events
     */
    onAny(handler) {
        this.wildcardHandlers.add(handler);
    }
    /**
     * Unsubscribe from an event type
     */
    off(type, handler) {
        const handlers = this.handlers.get(type);
        if (handlers) {
            handlers.delete(handler);
        }
    }
    /**
     * Unsubscribe from all events
     */
    offAny(handler) {
        this.wildcardHandlers.delete(handler);
    }
    /**
     * Emit an event
     */
    async emit(type, agentId, executionId, data, metadata) {
        const event = {
            type,
            agentId,
            executionId,
            timestamp: new Date(),
            data,
            metadata,
        };
        const handlers = this.handlers.get(type);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    await handler(event);
                }
                catch (error) {
                    this.logger.error(`Error in event handler for ${type}`, error instanceof Error ? error : new Error(String(error)), { executionId });
                }
            }
        }
        for (const handler of this.wildcardHandlers) {
            try {
                await handler(event);
            }
            catch (error) {
                this.logger.error(`Error in wildcard event handler for ${type}`, error instanceof Error ? error : new Error(String(error)), { executionId });
            }
        }
    }
    /**
     * Clear all handlers
     */
    clear() {
        this.handlers.clear();
        this.wildcardHandlers.clear();
    }
    /**
     * Get handler count for an event type
     */
    listenerCount(type) {
        return this.handlers.get(type)?.size || 0;
    }
}
exports.AgentEventEmitter = AgentEventEmitter;
