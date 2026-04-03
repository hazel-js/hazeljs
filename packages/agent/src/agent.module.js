"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AgentService_1, AgentModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentModule = exports.AgentService = exports.GUARDRAILS_SERVICE_TOKEN = void 0;
const core_1 = require("@hazeljs/core");
const agent_runtime_1 = require("./runtime/agent.runtime");
const agent_decorator_1 = require("./decorators/agent.decorator");
/** Token for optional GuardrailsService injection (from @hazeljs/guardrails) */
exports.GUARDRAILS_SERVICE_TOKEN = 'GuardrailsService';
/**
 * Agent Service
 * Injectable service for agent runtime
 */
let AgentService = AgentService_1 = class AgentService {
    constructor(guardrailsService, config = {}) {
        this.agentInstances = new Map();
        this.discoveryComplete = false;
        const moduleOpts = AgentModule.getOptions();
        const runtimeConfig = {
            ...(moduleOpts.runtime || config),
            guardrailsService: guardrailsService ?? moduleOpts.runtime?.guardrailsService ?? config.guardrailsService,
            llmProvider: moduleOpts.runtime?.llmProvider ?? config.llmProvider,
        };
        this.runtime = new agent_runtime_1.AgentRuntime(runtimeConfig);
        // Defer agent discovery and LLM provider resolution until after all modules are loaded
        setImmediate(() => {
            this.autoDiscoverAgents();
            this.resolveLLMProvider();
        });
    }
    /**
     * Resolve AIEnhancedService from global registry if no LLM provider is configured
     */
    resolveLLMProvider(retryCount = 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const aiService = global.__HAZELJS_AI_ENHANCED_SERVICE__;
        if (aiService && typeof aiService.complete === 'function') {
            const llmProvider = AgentService_1.createLLMProviderFromAI(aiService);
            this.runtime.setLLMProvider(llmProvider);
            // eslint-disable-next-line no-console
            console.log('AgentService: ✓ LLM provider configured from AIEnhancedService');
        }
        else if (retryCount < 10) {
            setTimeout(() => this.resolveLLMProvider(retryCount + 1), 50);
        }
    }
    /**
     * Create an LLM provider adapter from AIEnhancedService
     * Users can call this to create an LLM provider from AIEnhancedService
     */
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-inferrable-types, @typescript-eslint/explicit-module-boundary-types */
    static createLLMProviderFromAI(aiService) {
        return {
            async chat(request) {
                try {
                    const msgs = request.messages;
                    // Don't pass tools on follow-up calls that already have tool results in history.
                    // The executor appends the user input last, so if there are assistant messages
                    // before the final user message they are tool summaries — the LLM should
                    // synthesise a final answer, not call tools again.
                    const hasToolResultsInHistory = msgs.some((m) => m.role === 'assistant' &&
                        typeof m.content === 'string' &&
                        m.content.startsWith('[Tool:'));
                    // Map LLMToolDefinition[] → AIFunction[] (extract .function wrapper)
                    const functions = !hasToolResultsInHistory && request.tools && request.tools.length > 0
                        ? request.tools.map((t) => t.function)
                        : undefined;
                    const aiRequest = {
                        messages: msgs,
                        temperature: request.temperature,
                        maxTokens: request.maxTokens,
                        ...(functions ? { functions, functionCall: 'auto' } : {}),
                    };
                    const response = (await aiService.complete(aiRequest));
                    // Handle both toolCalls (new) and functionCall (legacy) formats
                    const tool_calls = response.toolCalls && response.toolCalls.length > 0
                        ? response.toolCalls.map((tc) => ({ ...tc, type: 'function' }))
                        : response.functionCall
                            ? [
                                {
                                    id: `call_${Date.now()}`,
                                    type: 'function',
                                    function: {
                                        name: response.functionCall.name,
                                        arguments: response.functionCall.arguments,
                                    },
                                },
                            ]
                            : undefined;
                    return {
                        content: response.content || '',
                        tool_calls,
                        usage: response.usage,
                    };
                }
                catch (error) {
                    // eslint-disable-next-line no-console
                    console.error('AgentService: LLM adapter error:', error);
                    throw error;
                }
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            async *streamChat(request) {
                if (!aiService.stream) {
                    throw new Error('AIEnhancedService does not support streaming');
                }
                const stream = aiService.stream({
                    messages: request.messages,
                    functions: request.tools,
                });
                for await (const chunk of stream) {
                    yield chunk;
                }
            },
        };
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-inferrable-types, @typescript-eslint/explicit-module-boundary-types */
    }
    /**
     * Ensure agent discovery has completed
     */
    ensureDiscovery() {
        if (!this.discoveryComplete) {
            this.autoDiscoverAgents();
        }
    }
    /**
     * Auto-discover @Agent decorated classes from the global registry
     */
    autoDiscoverAgents() {
        if (this.discoveryComplete) {
            return;
        }
        try {
            // Get all registered agents from the global registry
            const registeredAgents = (0, agent_decorator_1.getRegisteredAgents)();
            for (const agentClass of registeredAgents) {
                try {
                    // Register the agent class with the runtime
                    this.runtime.registerAgent(agentClass);
                    // Get agent name from metadata
                    const agentName = this.getAgentName(agentClass);
                    // Create and register instance
                    const agentInstance = this.createAgentInstance(agentClass, agentName);
                    this.runtime.registerAgentInstance(agentName, agentInstance);
                    this.agentInstances.set(agentName, agentInstance);
                }
                catch (_error) {
                    // eslint-disable-next-line no-console
                    console.warn(`AgentService: Failed to register agent ${agentClass.name}:`, _error);
                }
            }
            this.discoveryComplete = true;
        }
        catch (error) {
            // eslint-disable-next-line no-console
            console.error('AgentService: Auto-discovery failed:', error);
        }
    }
    getAgentName(agentClass) {
        // Try to get the agent name from the @Agent decorator metadata
        const metadata = (0, agent_decorator_1.getAgentMetadata)(agentClass);
        if (metadata && metadata.name) {
            return metadata.name;
        }
        // Fallback to class name
        return agentClass.name.toLowerCase().replace('agent', '-agent');
    }
    createAgentInstance(agentClass, _agentName) {
        // Create instance with runtime injection
        try {
            const instance = new agentClass(this.runtime);
            return instance;
        }
        catch {
            // Try without dependencies
            const instance = new agentClass();
            return instance;
        }
    }
    getRuntime() {
        this.ensureDiscovery();
        return this.runtime;
    }
    /**
     * Build a compiled sequential pipeline graph (same as `AgentRuntime.pipeline`).
     */
    pipeline(pipelineId, agentNames) {
        this.ensureDiscovery();
        return this.runtime.pipeline(pipelineId, agentNames);
    }
    /**
     * Create a supervisor that routes tasks to worker agents (requires LLM on runtime).
     */
    createSupervisor(config) {
        this.ensureDiscovery();
        return this.runtime.createSupervisor(config);
    }
    /**
     * Start building a custom multi-agent graph for this runtime.
     */
    createGraph(graphId) {
        this.ensureDiscovery();
        return this.runtime.createGraph(graphId);
    }
    async execute(agentName, input, options) {
        this.ensureDiscovery();
        return this.runtime.execute(agentName, input, options);
    }
    async resume(executionId, input) {
        return this.runtime.resume(executionId, input);
    }
    async getContext(executionId) {
        return this.runtime.getContext(executionId);
    }
    /**
     * Execute with streaming; yields step and token chunks when LLM supports streamChat.
     */
    async *executeStream(agentName, input, options) {
        yield* this.runtime.executeStream(agentName, input, options);
    }
    /**
     * Cancel an in-flight execution by executionId.
     */
    cancel(executionId) {
        this.runtime.cancel(executionId);
    }
    on(type, handler) {
        return this.runtime.on(type, handler);
    }
    getAgents() {
        this.ensureDiscovery();
        return this.runtime.getAgents();
    }
    approveToolExecution(requestId, approvedBy) {
        return this.runtime.approveToolExecution(requestId, approvedBy);
    }
    rejectToolExecution(requestId) {
        return this.runtime.rejectToolExecution(requestId);
    }
    getPendingApprovals() {
        return this.runtime.getPendingApprovals();
    }
};
exports.AgentService = AgentService;
exports.AgentService = AgentService = AgentService_1 = __decorate([
    (0, core_1.Service)(),
    __param(0, (0, core_1.Inject)(exports.GUARDRAILS_SERVICE_TOKEN)),
    __metadata("design:paramtypes", [Object, Object])
], AgentService);
/**
 * Agent Module
 * Uses static configuration pattern compatible with HazelJS DI
 */
let AgentModule = AgentModule_1 = class AgentModule {
    static forRoot(config = {}) {
        AgentModule_1.options = config;
        return AgentModule_1;
    }
    static getOptions() {
        return AgentModule_1.options;
    }
};
exports.AgentModule = AgentModule;
AgentModule.options = {};
/**
 * Create an LLM provider from AIEnhancedService
 *
 * @example
 * ```typescript
 * import { AIEnhancedService } from '@hazeljs/ai';
 *
 * AgentModule.forRoot({
 *   runtime: {
 *     llmProvider: AgentService.createLLMProviderFromAI(
 *       (global as any).__HAZELJS_AI_ENHANCED_SERVICE__
 *     ),
 *   },
 * })
 * ```
 */
// Delegate to AgentService implementation
AgentModule.createLLMProviderFromAI = AgentService.createLLMProviderFromAI;
exports.AgentModule = AgentModule = AgentModule_1 = __decorate([
    (0, core_1.HazelModule)({
        providers: [AgentService],
        exports: [AgentService],
    })
], AgentModule);
