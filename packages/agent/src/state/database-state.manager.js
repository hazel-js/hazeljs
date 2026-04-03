"use strict";
/**
 * Database State Manager
 * Prisma-backed persistence for agent execution state
 * Provides durable, queryable state management with full audit trail
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseStateManager = void 0;
const agent_types_1 = require("../types/agent.types");
const crypto_1 = require("crypto");
/**
 * Database-backed state manager for agent execution state
 * Provides durable persistence with full query capabilities and audit trail
 */
class DatabaseStateManager {
    constructor(config) {
        if (!config.client) {
            throw new Error('Prisma client is required');
        }
        this.client = config.client;
        this.softDelete = config.softDelete !== false;
        this.autoArchive = config.autoArchive || false;
        this.archiveThresholdDays = config.archiveThresholdDays || 30;
    }
    /**
     * Convert database record to AgentContext
     */
    toContext(record) {
        return {
            executionId: record.executionId,
            agentId: record.agentId,
            sessionId: record.sessionId,
            userId: record.userId || undefined,
            input: record.input,
            state: record.state,
            steps: (record.steps || []).map((step) => ({
                id: step.id,
                agentId: step.agentId,
                executionId: step.executionId,
                stepNumber: step.stepNumber,
                state: step.state,
                action: step.action,
                result: step.result,
                error: step.error,
                timestamp: new Date(step.timestamp),
                duration: step.duration,
            })),
            memory: {
                conversationHistory: (record.conversationHistory || []).map((msg) => ({
                    role: msg.role,
                    content: msg.content,
                    timestamp: new Date(msg.timestamp),
                })),
                workingMemory: record.workingMemory || {},
                facts: record.facts || [],
                entities: record.entities || [],
            },
            ragContext: record.ragContext || undefined,
            metadata: record.metadata || {},
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
        };
    }
    /**
     * Convert AgentContext to database record
     */
    toRecord(context) {
        return {
            executionId: context.executionId,
            agentId: context.agentId,
            sessionId: context.sessionId,
            userId: context.userId || null,
            input: context.input,
            state: context.state,
            steps: context.steps,
            conversationHistory: context.memory.conversationHistory,
            workingMemory: context.memory.workingMemory,
            facts: context.memory.facts,
            entities: context.memory.entities,
            ragContext: context.ragContext || null,
            metadata: context.metadata,
            createdAt: context.createdAt,
            updatedAt: context.updatedAt,
        };
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
        const record = this.toRecord(context);
        await this.client.agentContext.create({
            data: record,
        });
        return context;
    }
    async getContext(executionId) {
        const record = await this.client.agentContext.findUnique({
            where: { executionId },
        });
        if (!record) {
            return undefined;
        }
        return this.toContext(record);
    }
    async updateState(executionId, newState) {
        const context = await this.getContext(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        context.state = newState;
        context.updatedAt = new Date();
        await this.client.agentContext.update({
            where: { executionId },
            data: {
                state: newState,
                updatedAt: context.updatedAt,
            },
        });
    }
    async addStep(executionId, step) {
        const context = await this.getContext(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        context.steps.push(step);
        context.updatedAt = new Date();
        await this.client.agentContext.update({
            where: { executionId },
            data: {
                steps: context.steps,
                updatedAt: context.updatedAt,
            },
        });
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
        await this.client.agentContext.update({
            where: { executionId },
            data: {
                steps: context.steps,
                updatedAt: context.updatedAt,
            },
        });
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
        await this.client.agentContext.update({
            where: { executionId },
            data: {
                conversationHistory: context.memory.conversationHistory,
                updatedAt: context.updatedAt,
            },
        });
    }
    async setWorkingMemory(executionId, key, value) {
        const context = await this.getContext(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        context.memory.workingMemory[key] = value;
        context.updatedAt = new Date();
        await this.client.agentContext.update({
            where: { executionId },
            data: {
                workingMemory: context.memory.workingMemory,
                updatedAt: context.updatedAt,
            },
        });
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
        await this.client.agentContext.update({
            where: { executionId },
            data: {
                ragContext: contexts,
                updatedAt: context.updatedAt,
            },
        });
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
        if (this.softDelete) {
            await this.client.agentContext.update({
                where: { executionId },
                data: {
                    deletedAt: new Date(),
                },
            });
        }
        else {
            await this.client.agentContext.delete({
                where: { executionId },
            });
        }
    }
    async clear() {
        if (this.softDelete) {
            await this.client.agentContext.updateMany({
                where: { deletedAt: null },
                data: {
                    deletedAt: new Date(),
                },
            });
        }
        else {
            await this.client.agentContext.deleteMany({});
        }
    }
    async getSessionContexts(sessionId) {
        const records = await this.client.agentContext.findMany({
            where: {
                sessionId,
                deletedAt: this.softDelete ? null : undefined,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return records.map((record) => this.toContext(record));
    }
}
exports.DatabaseStateManager = DatabaseStateManager;
