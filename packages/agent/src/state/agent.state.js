"use strict";
/**
 * Agent State Management
 * Manages agent execution state and persistence
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentStateManager = void 0;
const agent_types_1 = require("../types/agent.types");
const crypto_1 = require("crypto");
/**
 * Agent State Manager
 * In-memory implementation - default state manager
 * Handles state transitions and persistence
 */
class AgentStateManager {
    constructor() {
        this.contexts = new Map();
    }
    /**
     * Create a new agent execution context
     */
    createContext(agentId, sessionId, input, userId, metadata) {
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
        this.contexts.set(executionId, context);
        return context;
    }
    /**
     * Get execution context
     */
    getContext(executionId) {
        return this.contexts.get(executionId);
    }
    /**
     * Update agent state
     */
    updateState(executionId, newState) {
        const context = this.contexts.get(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        context.state = newState;
        context.updatedAt = new Date();
    }
    /**
     * Add a step to the execution
     */
    addStep(executionId, step) {
        const context = this.contexts.get(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        context.steps.push(step);
        context.updatedAt = new Date();
    }
    /**
     * Update the last step
     */
    updateLastStep(executionId, updates) {
        const context = this.contexts.get(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        if (context.steps.length === 0) {
            throw new Error('No steps to update');
        }
        const lastStep = context.steps[context.steps.length - 1];
        Object.assign(lastStep, updates);
        context.updatedAt = new Date();
    }
    /**
     * Add message to conversation history
     */
    addMessage(executionId, role, content) {
        const context = this.contexts.get(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        context.memory.conversationHistory.push({
            role,
            content,
            timestamp: new Date(),
        });
        context.updatedAt = new Date();
    }
    /**
     * Set working memory value
     */
    setWorkingMemory(executionId, key, value) {
        const context = this.contexts.get(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        context.memory.workingMemory[key] = value;
        context.updatedAt = new Date();
    }
    /**
     * Get working memory value
     */
    getWorkingMemory(executionId, key) {
        const context = this.contexts.get(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        return context.memory.workingMemory[key];
    }
    /**
     * Add RAG context
     */
    addRAGContext(executionId, contexts) {
        const context = this.contexts.get(executionId);
        if (!context) {
            throw new Error(`Execution context ${executionId} not found`);
        }
        context.ragContext = contexts;
        context.updatedAt = new Date();
    }
    /**
     * Check if execution can continue
     */
    canContinue(executionId, maxSteps) {
        const context = this.contexts.get(executionId);
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
    /**
     * Delete execution context
     */
    deleteContext(executionId) {
        this.contexts.delete(executionId);
    }
    /**
     * Clear all contexts
     */
    clear() {
        this.contexts.clear();
    }
    /**
     * Get all contexts for a session
     */
    getSessionContexts(sessionId) {
        return Array.from(this.contexts.values()).filter((ctx) => ctx.sessionId === sessionId);
    }
}
exports.AgentStateManager = AgentStateManager;
