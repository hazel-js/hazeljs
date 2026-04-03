"use strict";
/**
 * Agent Context Builder
 * Builds execution context with memory and RAG integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentContextBuilder = void 0;
/**
 * Agent Context Builder
 * Prepares context for agent execution
 */
class AgentContextBuilder {
    constructor(memoryManager) {
        this.memoryManager = memoryManager;
    }
    /**
     * Build context with memory
     */
    async buildWithMemory(context, maxHistory = 20) {
        if (!this.memoryManager) {
            return;
        }
        const history = await this.memoryManager.getConversationHistory(context.sessionId, maxHistory);
        context.memory.conversationHistory = history.map((msg) => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp || new Date(),
        }));
        const entities = await this.memoryManager.getAllEntities(context.sessionId);
        context.memory.entities = entities.map((entity) => ({
            name: entity.name,
            type: entity.type,
            attributes: entity.attributes,
        }));
        const workingMemoryKeys = ['current_task', 'user_preferences', 'session_state'];
        for (const key of workingMemoryKeys) {
            const value = await this.memoryManager.getContext(key, context.sessionId);
            if (value !== null) {
                context.memory.workingMemory[key] = value;
            }
        }
    }
    /**
     * Build context with RAG
     */
    async buildWithRAG(context, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ragService, topK = 5) {
        if (!ragService) {
            return;
        }
        try {
            const results = await ragService.search(context.input, { topK });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            context.ragContext = results.map((r) => r.content || r.text);
        }
        catch {
            context.ragContext = [];
        }
    }
    /**
     * Persist context to memory
     */
    async persistToMemory(context) {
        if (!this.memoryManager) {
            return;
        }
        for (const msg of context.memory.conversationHistory) {
            await this.memoryManager.addMessage({
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
            }, context.sessionId, context.userId);
        }
        for (const [key, value] of Object.entries(context.memory.workingMemory)) {
            await this.memoryManager.setContext(key, value, context.sessionId);
        }
        for (const entity of context.memory.entities) {
            const existingEntity = await this.memoryManager.getEntity(entity.name);
            if (existingEntity) {
                await this.memoryManager.updateEntity(entity.name, entity);
            }
            else {
                await this.memoryManager.trackEntity({
                    name: entity.name,
                    type: entity.type,
                    attributes: entity.attributes,
                    relationships: [],
                    firstSeen: new Date(),
                    lastSeen: new Date(),
                    mentions: 1,
                }, context.sessionId);
            }
        }
    }
}
exports.AgentContextBuilder = AgentContextBuilder;
