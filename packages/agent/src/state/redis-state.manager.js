"use strict";
/**
 * Redis State Manager
 * Redis-backed persistence for agent execution state
 * Provides fast, distributed state management with TTL support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisStateManager = void 0;
const agent_types_1 = require("../types/agent.types");
const crypto_1 = require("crypto");
/**
 * Redis-backed state manager for agent execution state
 * Provides fast, distributed state management with automatic expiration
 */
class RedisStateManager {
    constructor(config) {
        if (!config.client) {
            throw new Error('Redis client is required');
        }
        this.client = config.client;
        this.keyPrefix = config.keyPrefix || 'agent:state:';
        this.defaultTTL = config.defaultTTL || 3600; // 1 hour
        this.completedTTL = config.completedTTL || 86400; // 24 hours
        this.failedTTL = config.failedTTL || 604800; // 7 days
    }
    /**
     * Get the Redis key for an execution context
     */
    getKey(executionId) {
        return `${this.keyPrefix}${executionId}`;
    }
    /**
     * Get the Redis key for session contexts
     */
    getSessionKey(sessionId) {
        return `${this.keyPrefix}session:${sessionId}`;
    }
    /**
     * Serialize context to JSON
     */
    serialize(context) {
        return JSON.stringify(context, (key, value) => {
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        });
    }
    /**
     * Deserialize context from JSON
     */
    deserialize(data) {
        const parsed = JSON.parse(data);
        return {
            ...parsed,
            createdAt: new Date(parsed.createdAt),
            updatedAt: new Date(parsed.updatedAt),
            steps: parsed.steps.map((step) => ({
                ...step,
                timestamp: new Date(step.timestamp),
            })),
            memory: {
                ...parsed.memory,
                conversationHistory: parsed.memory.conversationHistory.map((msg) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp),
                })),
            },
        };
    }
    /**
     * Get TTL based on state
     */
    getTTL(state) {
        if (state === agent_types_1.AgentState.COMPLETED) {
            return this.completedTTL;
        }
        if (state === agent_types_1.AgentState.FAILED) {
            return this.failedTTL;
        }
        return this.defaultTTL;
    }
    async createContext(agentId, sessionId, input, userId, metadata) {
        const executionId = (0, crypto_1.randomUUID)();
        const now = new Date();
        const context = {
            executionId,
            agentId,
            sessionId,
            userId,
            input,
            state: agent_types_1.AgentState.IDLE,
            steps: [],
            memory: {
                conversationHistory: [],
                workingMemory: {},
                facts: [],
                entities: [],
            },
            metadata: metadata || {},
            createdAt: now,
            updatedAt: now,
        };
        const key = this.getKey(executionId);
        const serialized = this.serialize(context);
        const ttl = this.getTTL(context.state);
        // Store context
        await this.client.setEx(key, ttl, serialized);
        // Add to session index
        await this.client.sAdd(this.getSessionKey(sessionId), executionId);
        await this.client.expire(this.getSessionKey(sessionId), ttl);
        return context;
    }
    async getContext(executionId) {
        const key = this.getKey(executionId);
        const data = await this.client.get(key);
        if (!data) {
            return undefined;
        }
        return this.deserialize(data);
    }
    async updateState(executionId, newState) {
        const context = await this.getContext(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        context.state = newState;
        context.updatedAt = new Date();
        const key = this.getKey(executionId);
        const serialized = this.serialize(context);
        const ttl = this.getTTL(newState);
        await this.client.setEx(key, ttl, serialized);
    }
    async addStep(executionId, step) {
        const context = await this.getContext(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        context.steps.push(step);
        context.updatedAt = new Date();
        const key = this.getKey(executionId);
        const serialized = this.serialize(context);
        const ttl = this.getTTL(context.state);
        await this.client.setEx(key, ttl, serialized);
    }
    async updateLastStep(executionId, updates) {
        const context = await this.getContext(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        if (context.steps.length === 0) {
            throw new Error('No steps to update');
        }
        const lastStep = context.steps[context.steps.length - 1];
        Object.assign(lastStep, updates);
        context.updatedAt = new Date();
        const key = this.getKey(executionId);
        const serialized = this.serialize(context);
        const ttl = this.getTTL(context.state);
        await this.client.setEx(key, ttl, serialized);
    }
    async addMessage(executionId, role, content) {
        const context = await this.getContext(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        context.memory.conversationHistory.push({
            role,
            content,
            timestamp: new Date(),
        });
        context.updatedAt = new Date();
        const key = this.getKey(executionId);
        const serialized = this.serialize(context);
        const ttl = this.getTTL(context.state);
        await this.client.setEx(key, ttl, serialized);
    }
    async setWorkingMemory(executionId, key, value) {
        const context = await this.getContext(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        context.memory.workingMemory[key] = value;
        context.updatedAt = new Date();
        const redisKey = this.getKey(executionId);
        const serialized = this.serialize(context);
        const ttl = this.getTTL(context.state);
        await this.client.setEx(redisKey, ttl, serialized);
    }
    async getWorkingMemory(executionId, key) {
        const context = await this.getContext(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        return context.memory.workingMemory[key];
    }
    async addRAGContext(executionId, contexts) {
        const context = await this.getContext(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        context.ragContext = contexts;
        context.updatedAt = new Date();
        const redisKey = this.getKey(executionId);
        const serialized = this.serialize(context);
        const ttl = this.getTTL(context.state);
        await this.client.setEx(redisKey, ttl, serialized);
    }
    async canContinue(executionId, maxSteps) {
        const context = await this.getContext(executionId);
        if (!context) {
            return false;
        }
        if (context.state === agent_types_1.AgentState.COMPLETED || context.state === agent_types_1.AgentState.FAILED) {
            return false;
        }
        if (context.steps.length >= maxSteps) {
            return false;
        }
        return true;
    }
    async deleteContext(executionId) {
        const context = await this.getContext(executionId);
        if (context) {
            // Remove from session index
            await this.client.sRem(this.getSessionKey(context.sessionId), executionId);
        }
        const key = this.getKey(executionId);
        await this.client.del(key);
    }
    async clear() {
        // Get all keys with prefix
        const pattern = `${this.keyPrefix}*`;
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
            await this.client.del(...keys);
        }
    }
    async getSessionContexts(sessionId) {
        const sessionKey = this.getSessionKey(sessionId);
        const executionIds = await this.client.sMembers(sessionKey);
        const contexts = [];
        for (const executionId of executionIds) {
            const context = await this.getContext(executionId);
            if (context) {
                contexts.push(context);
            }
        }
        return contexts;
    }
}
exports.RedisStateManager = RedisStateManager;
