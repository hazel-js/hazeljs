"use strict";
/**
 * Agent Executor
 * Core execution loop for agents
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentExecutor = void 0;
const crypto_1 = require("crypto");
const agent_types_1 = require("../types/agent.types");
const event_types_1 = require("../types/event.types");
const prompts_1 = require("@hazeljs/prompts");
const agent_error_1 = require("../errors/agent.error");
require("../prompts/agent-system.prompt");
const agent_system_prompt_1 = require("../prompts/agent-system.prompt");
/**
 * Agent Executor
 * Implements the core agent execution loop
 */
class AgentExecutor {
    constructor(stateManager, contextBuilder, toolExecutor, toolRegistry, llmProvider, eventEmitter) {
        this.stateManager = stateManager;
        this.contextBuilder = contextBuilder;
        this.toolExecutor = toolExecutor;
        this.toolRegistry = toolRegistry;
        this.llmProvider = llmProvider;
        this.eventEmitter = eventEmitter;
    }
    /**
     * Helper to handle both sync and async state manager calls
     */
    async unwrap(value) {
        return value instanceof Promise ? await value : value;
    }
    throwIfAborted(signal) {
        if (signal?.aborted) {
            throw agent_error_1.AgentError.cancelled();
        }
    }
    throwIfTimeout(deadline) {
        if (Date.now() > deadline) {
            throw agent_error_1.AgentError.timeout();
        }
    }
    /**
     * Execute agent with controlled loop
     */
    async execute(context, maxSteps = 10, options = {}) {
        const startTime = Date.now();
        const timeoutMs = options.timeoutMs;
        const signal = options.signal;
        const deadline = timeoutMs != null ? startTime + timeoutMs : undefined;
        try {
            this.throwIfAborted(signal);
            this.emitEvent(event_types_1.AgentEventType.EXECUTION_STARTED, context.executionId, {
                input: context.input,
                sessionId: context.sessionId,
                userId: context.userId,
                options: context.metadata,
            });
            await this.unwrap(this.stateManager.updateState(context.executionId, agent_types_1.AgentState.THINKING));
            let stepNumber = 0;
            let finalResponse;
            while (await this.unwrap(this.stateManager.canContinue(context.executionId, maxSteps))) {
                if (deadline != null)
                    this.throwIfTimeout(deadline);
                this.throwIfAborted(signal);
                stepNumber++;
                const { step } = await this.executeStep(context, stepNumber, signal);
                await this.unwrap(this.stateManager.addStep(context.executionId, step));
                if (step.state === agent_types_1.AgentState.COMPLETED) {
                    finalResponse = step.action?.response;
                    break;
                }
                if (step.state === agent_types_1.AgentState.FAILED) {
                    throw step.error || new Error('Step failed without error');
                }
                if (step.state === agent_types_1.AgentState.WAITING_FOR_APPROVAL) {
                    await this.unwrap(this.stateManager.updateState(context.executionId, agent_types_1.AgentState.WAITING_FOR_APPROVAL));
                    break;
                }
                if (step.state === agent_types_1.AgentState.WAITING_FOR_INPUT) {
                    await this.unwrap(this.stateManager.updateState(context.executionId, agent_types_1.AgentState.WAITING_FOR_INPUT));
                    break;
                }
            }
            if (stepNumber >= maxSteps) {
                await this.unwrap(this.stateManager.updateState(context.executionId, agent_types_1.AgentState.FAILED));
                throw agent_error_1.AgentError.maxSteps(maxSteps);
            }
            await this.unwrap(this.stateManager.updateState(context.executionId, agent_types_1.AgentState.COMPLETED));
            const duration = Date.now() - startTime;
            this.emitEvent(event_types_1.AgentEventType.EXECUTION_COMPLETED, context.executionId, {
                response: finalResponse,
                steps: stepNumber,
                duration,
            });
            return {
                executionId: context.executionId,
                agentId: context.agentId,
                state: agent_types_1.AgentState.COMPLETED,
                response: finalResponse,
                steps: context.steps,
                metadata: context.metadata,
                duration,
                completedAt: new Date(),
            };
        }
        catch (error) {
            await this.unwrap(this.stateManager.updateState(context.executionId, agent_types_1.AgentState.FAILED));
            const duration = Date.now() - startTime;
            this.emitEvent(event_types_1.AgentEventType.EXECUTION_FAILED, context.executionId, {
                error: error,
                step: context.steps.length,
                duration,
            });
            return {
                executionId: context.executionId,
                agentId: context.agentId,
                state: agent_types_1.AgentState.FAILED,
                error: error,
                steps: context.steps,
                metadata: context.metadata,
                duration,
                completedAt: new Date(),
            };
        }
    }
    /**
     * Execute agent and stream step/token chunks when streaming is enabled.
     */
    async *executeStream(context, maxSteps = 10, options = {}) {
        const startTime = Date.now();
        const timeoutMs = options.timeoutMs;
        const signal = options.signal;
        const deadline = timeoutMs != null ? startTime + timeoutMs : undefined;
        const streaming = !!(options.streaming && this.llmProvider?.streamChat);
        try {
            this.throwIfAborted(signal);
            this.emitEvent(event_types_1.AgentEventType.EXECUTION_STARTED, context.executionId, {
                input: context.input,
                sessionId: context.sessionId,
                userId: context.userId,
                options: context.metadata,
            });
            await this.unwrap(this.stateManager.updateState(context.executionId, agent_types_1.AgentState.THINKING));
            let stepNumber = 0;
            let finalResponse;
            while (await this.unwrap(this.stateManager.canContinue(context.executionId, maxSteps))) {
                if (deadline != null)
                    this.throwIfTimeout(deadline);
                this.throwIfAborted(signal);
                stepNumber++;
                // Stream tokens in real-time if streaming is enabled
                if (streaming) {
                    let step;
                    for await (const chunk of this.executeStepStream(context, stepNumber, signal)) {
                        if (chunk.type === 'step') {
                            step = chunk.step;
                            yield { type: 'step', step };
                        }
                        else if (chunk.type === 'token') {
                            yield { type: 'token', content: chunk.content };
                        }
                    }
                    if (!step)
                        throw new Error('No step returned from executeStepStream');
                    await this.unwrap(this.stateManager.addStep(context.executionId, step));
                    if (step.state === agent_types_1.AgentState.COMPLETED) {
                        finalResponse = step.action?.response;
                        break;
                    }
                    if (step.state === agent_types_1.AgentState.FAILED) {
                        throw step.error || new Error('Step failed without error');
                    }
                    if (step.state === agent_types_1.AgentState.WAITING_FOR_APPROVAL) {
                        await this.unwrap(this.stateManager.updateState(context.executionId, agent_types_1.AgentState.WAITING_FOR_APPROVAL));
                        break;
                    }
                    if (step.state === agent_types_1.AgentState.WAITING_FOR_INPUT) {
                        await this.unwrap(this.stateManager.updateState(context.executionId, agent_types_1.AgentState.WAITING_FOR_INPUT));
                        break;
                    }
                    continue;
                }
                // Non-streaming path
                const stepResult = await this.executeStep(context, stepNumber, signal, streaming);
                const { step, tokenChunks } = stepResult;
                yield { type: 'step', step };
                if (tokenChunks) {
                    for (const content of tokenChunks) {
                        yield { type: 'token', content };
                    }
                }
                await this.unwrap(this.stateManager.addStep(context.executionId, step));
                if (step.state === agent_types_1.AgentState.COMPLETED) {
                    finalResponse = step.action?.response;
                    break;
                }
                if (step.state === agent_types_1.AgentState.FAILED) {
                    throw step.error || new Error('Step failed without error');
                }
                if (step.state === agent_types_1.AgentState.WAITING_FOR_APPROVAL) {
                    await this.unwrap(this.stateManager.updateState(context.executionId, agent_types_1.AgentState.WAITING_FOR_APPROVAL));
                    break;
                }
                if (step.state === agent_types_1.AgentState.WAITING_FOR_INPUT) {
                    await this.unwrap(this.stateManager.updateState(context.executionId, agent_types_1.AgentState.WAITING_FOR_INPUT));
                    break;
                }
            }
            if (stepNumber >= maxSteps) {
                await this.unwrap(this.stateManager.updateState(context.executionId, agent_types_1.AgentState.FAILED));
                throw agent_error_1.AgentError.maxSteps(maxSteps);
            }
            await this.unwrap(this.stateManager.updateState(context.executionId, agent_types_1.AgentState.COMPLETED));
            const duration = Date.now() - startTime;
            const result = {
                executionId: context.executionId,
                agentId: context.agentId,
                state: agent_types_1.AgentState.COMPLETED,
                response: finalResponse,
                steps: context.steps,
                metadata: context.metadata,
                duration,
                completedAt: new Date(),
            };
            this.emitEvent(event_types_1.AgentEventType.EXECUTION_COMPLETED, context.executionId, {
                response: finalResponse,
                steps: stepNumber,
                duration,
            });
            yield { type: 'done', result };
        }
        catch (error) {
            await this.unwrap(this.stateManager.updateState(context.executionId, agent_types_1.AgentState.FAILED));
            const duration = Date.now() - startTime;
            const result = {
                executionId: context.executionId,
                agentId: context.agentId,
                state: agent_types_1.AgentState.FAILED,
                error: error,
                steps: context.steps,
                metadata: context.metadata,
                duration,
                completedAt: new Date(),
            };
            this.emitEvent(event_types_1.AgentEventType.EXECUTION_FAILED, context.executionId, {
                error: error,
                step: context.steps.length,
                duration,
            });
            yield { type: 'done', result };
        }
    }
    /**
     * Execute a single step. Returns step and optional token chunks when streaming.
     */
    async executeStep(context, stepNumber, signal, streaming) {
        const stepId = (0, crypto_1.randomUUID)();
        const startTime = Date.now();
        const step = {
            id: stepId,
            agentId: context.agentId,
            executionId: context.executionId,
            stepNumber,
            state: agent_types_1.AgentState.THINKING,
            timestamp: new Date(),
        };
        this.emitEvent(event_types_1.AgentEventType.STEP_STARTED, context.executionId, {
            stepNumber,
            state: step.state,
        });
        try {
            this.throwIfAborted(signal);
            const { action, tokenChunks } = await this.decideNextAction(context, { signal, streaming });
            step.action = action;
            switch (action.type) {
                case agent_types_1.AgentActionType.USE_TOOL:
                    step.state = agent_types_1.AgentState.USING_TOOL;
                    step.result = await this.executeTool(context, action);
                    break;
                case agent_types_1.AgentActionType.ASK_USER:
                    step.state = agent_types_1.AgentState.WAITING_FOR_INPUT;
                    this.emitEvent(event_types_1.AgentEventType.USER_INPUT_REQUESTED, context.executionId, {
                        question: action.question,
                    });
                    break;
                case agent_types_1.AgentActionType.RESPOND:
                    step.state = agent_types_1.AgentState.COMPLETED;
                    step.result = {
                        success: true,
                        output: action.response,
                    };
                    break;
                case agent_types_1.AgentActionType.WAIT:
                    step.state = agent_types_1.AgentState.WAITING_FOR_APPROVAL;
                    break;
                case agent_types_1.AgentActionType.USE_TOOLS:
                    step.state = agent_types_1.AgentState.USING_TOOL;
                    if (action.toolCalls && action.toolCalls.length > 0) {
                        const toolResults = await Promise.all(action.toolCalls.map((tc) => this.executeTool(context, {
                            ...action,
                            type: agent_types_1.AgentActionType.USE_TOOL,
                            toolName: tc.toolName,
                            toolInput: tc.toolInput,
                        })));
                        // Combine all tool results
                        step.result = {
                            success: toolResults.every((r) => r.success),
                            output: toolResults.map((r, i) => ({
                                tool: action.toolCalls[i].toolName,
                                output: r.output,
                                error: r.error,
                            })),
                        };
                    }
                    break;
                case agent_types_1.AgentActionType.COMPLETE:
                    step.state = agent_types_1.AgentState.COMPLETED;
                    step.result = {
                        success: true,
                        output: action.response,
                    };
                    break;
                default:
                    step.state = agent_types_1.AgentState.THINKING;
            }
            step.duration = Date.now() - startTime;
            this.emitEvent(event_types_1.AgentEventType.STEP_COMPLETED, context.executionId, {
                stepNumber,
                state: step.state,
                action,
                result: step.result,
            });
            return { step, tokenChunks };
        }
        catch (error) {
            step.state = agent_types_1.AgentState.FAILED;
            step.error = error;
            step.duration = Date.now() - startTime;
            this.emitEvent(event_types_1.AgentEventType.STEP_FAILED, context.executionId, {
                stepNumber,
                state: step.state,
                error: error.message,
            });
            return { step };
        }
    }
    /**
     * Execute a single step with real-time token streaming.
     * Yields tokens as they arrive from the LLM instead of buffering them.
     */
    async *executeStepStream(context, stepNumber, signal) {
        const stepId = (0, crypto_1.randomUUID)();
        const startTime = Date.now();
        const step = {
            id: stepId,
            agentId: context.agentId,
            executionId: context.executionId,
            stepNumber,
            state: agent_types_1.AgentState.THINKING,
            timestamp: new Date(),
        };
        this.emitEvent(event_types_1.AgentEventType.STEP_STARTED, context.executionId, {
            stepNumber,
            state: step.state,
        });
        try {
            this.throwIfAborted(signal);
            // Build the LLM request
            const prompt = this.buildPrompt(context);
            const tools = this.toolRegistry.getToolDefinitionsForLLM(context.agentId);
            const messages = [
                { role: 'system', content: prompt.system },
                ...prompt.messages,
                { role: 'user', content: context.input },
            ];
            const request = {
                messages,
                tools: tools.length > 0 ? tools : undefined,
            };
            const streamChat = this.llmProvider?.streamChat;
            if (streamChat) {
                let content = '';
                // Stream tokens in real-time by directly forwarding chunks
                const stream = streamChat(request);
                for await (const chunk of stream) {
                    if (signal)
                        this.throwIfAborted(signal);
                    if (chunk.content) {
                        content += chunk.content;
                        // Yield token immediately - each yield returns control to caller
                        yield { type: 'token', content: chunk.content };
                        // Force microtask to allow immediate processing
                        await Promise.resolve();
                    }
                }
                // After streaming completes, create the action
                step.action = {
                    type: agent_types_1.AgentActionType.RESPOND,
                    response: content,
                };
                step.state = agent_types_1.AgentState.COMPLETED;
                step.result = {
                    success: true,
                    output: content,
                };
            }
            else if (this.llmProvider) {
                // Fallback to non-streaming
                const response = await this.llmProvider.chat(request);
                step.action = {
                    type: agent_types_1.AgentActionType.RESPOND,
                    response: response.content,
                };
                step.state = agent_types_1.AgentState.COMPLETED;
                step.result = {
                    success: true,
                    output: response.content,
                };
            }
            else {
                // No LLM provider
                step.action = {
                    type: agent_types_1.AgentActionType.RESPOND,
                    response: 'No LLM provider configured',
                };
                step.state = agent_types_1.AgentState.COMPLETED;
                step.result = {
                    success: true,
                    output: 'No LLM provider configured',
                };
            }
            step.duration = Date.now() - startTime;
            this.emitEvent(event_types_1.AgentEventType.STEP_COMPLETED, context.executionId, {
                stepNumber,
                state: step.state,
                duration: step.duration,
            });
            // Yield the completed step
            yield { type: 'step', step };
        }
        catch (error) {
            step.state = agent_types_1.AgentState.FAILED;
            step.error = error;
            step.duration = Date.now() - startTime;
            this.emitEvent(event_types_1.AgentEventType.STEP_FAILED, context.executionId, {
                stepNumber,
                state: step.state,
                error: error.message,
            });
            yield { type: 'step', step };
        }
    }
    /**
     * Decide next action using LLM. Optionally streams and returns token chunks.
     */
    async decideNextAction(context, opts) {
        if (!this.llmProvider) {
            return {
                action: {
                    type: agent_types_1.AgentActionType.RESPOND,
                    response: 'No LLM provider configured',
                },
            };
        }
        const prompt = this.buildPrompt(context);
        const tools = this.toolRegistry.getToolDefinitionsForLLM(context.agentId);
        const messages = [
            { role: 'system', content: prompt.system },
            ...prompt.messages,
            { role: 'user', content: context.input },
        ];
        const request = {
            messages,
            tools: tools.length > 0 ? tools : undefined,
        };
        const streamChat = this.llmProvider?.streamChat;
        const useStreaming = !!(opts?.streaming && streamChat);
        try {
            if (useStreaming && streamChat) {
                const tokenChunks = [];
                let content = '';
                for await (const chunk of streamChat(request)) {
                    if (opts?.signal)
                        this.throwIfAborted(opts.signal);
                    if (chunk.content) {
                        tokenChunks.push(chunk.content);
                        content += chunk.content;
                    }
                }
                return {
                    action: { type: agent_types_1.AgentActionType.RESPOND, response: content },
                    tokenChunks,
                };
            }
            const response = await this.llmProvider.chat(request);
            if (response.tool_calls && response.tool_calls.length > 0) {
                // Parse all tool calls
                const parsedCalls = [];
                for (const toolCall of response.tool_calls) {
                    let toolInput;
                    try {
                        toolInput = JSON.parse(toolCall.function.arguments);
                    }
                    catch (parseError) {
                        throw agent_error_1.AgentError.invalidToolInput(toolCall.function.name, 'Invalid JSON in tool arguments', parseError);
                    }
                    parsedCalls.push({ toolName: toolCall.function.name, toolInput });
                }
                // Single tool call — use existing USE_TOOL for backward compatibility
                if (parsedCalls.length === 1) {
                    return {
                        action: {
                            type: agent_types_1.AgentActionType.USE_TOOL,
                            toolName: parsedCalls[0].toolName,
                            toolInput: parsedCalls[0].toolInput,
                            thought: response.content,
                        },
                    };
                }
                // Multiple tool calls — parallel execution
                return {
                    action: {
                        type: agent_types_1.AgentActionType.USE_TOOLS,
                        toolCalls: parsedCalls,
                        thought: response.content,
                    },
                };
            }
            return {
                action: { type: agent_types_1.AgentActionType.RESPOND, response: response.content },
            };
        }
        catch (error) {
            if (error instanceof agent_error_1.AgentError)
                throw error;
            throw agent_error_1.AgentError.llmError('I encountered an error while processing your request.', error);
        }
    }
    /**
     * Execute a tool
     */
    async executeTool(context, action) {
        if (!action.toolName || !action.toolInput) {
            return {
                success: false,
                error: 'Tool name or input missing',
            };
        }
        const fullToolName = `${context.agentId}.${action.toolName}`;
        const tool = this.toolRegistry.getTool(fullToolName);
        if (!tool) {
            return {
                success: false,
                error: agent_error_1.AgentError.toolNotFound(action.toolName).message,
            };
        }
        const result = await this.toolExecutor.execute(tool, action.toolInput, context.agentId, context.sessionId, context.userId);
        // Store as assistant message summarizing the tool call + result (OpenAI requires tool
        // messages to follow assistant messages with tool_calls; we avoid that format to keep
        // storage simple and ensure the LLM receives the tool result context)
        const toolSummary = `[Tool: ${action.toolName}]\nInput: ${JSON.stringify(action.toolInput)}\nOutput: ${JSON.stringify(result.output)}`;
        await this.unwrap(this.stateManager.addMessage(context.executionId, 'assistant', toolSummary));
        return {
            success: result.success,
            output: result.output,
            error: result.error?.message,
            metadata: {
                duration: result.duration,
            },
        };
    }
    /**
     * Build prompt for LLM
     */
    buildPrompt(context) {
        const basePrompt = context.metadata?.systemPrompt || 'You are a helpful AI agent.';
        const description = context.metadata?.agentDescription || '';
        const ragContext = context.ragContext && context.ragContext.length > 0 ? context.ragContext.join('\n\n') : '';
        let systemPrompt;
        if (description || ragContext) {
            systemPrompt = prompts_1.PromptRegistry.get(agent_system_prompt_1.AGENT_SYSTEM_KEY)
                .render({ systemPrompt: basePrompt, description, ragContext })
                .replace(/\n\nAgent description: \n/, '\n')
                .replace(/\n\nRelevant context:\n$/, '');
        }
        else {
            systemPrompt = basePrompt;
        }
        const messages = context.memory.conversationHistory.map((msg) => ({
            role: msg.role,
            content: msg.content,
        }));
        return {
            system: systemPrompt,
            messages,
        };
    }
    /**
     * Resume execution after pause
     */
    async resume(executionId, input) {
        const contextResult = this.stateManager.getContext(executionId);
        const context = await this.unwrap(contextResult);
        if (!context) {
            throw agent_error_1.AgentError.executionNotFound(executionId);
        }
        if (input) {
            await this.unwrap(this.stateManager.addMessage(executionId, 'user', input));
            this.emitEvent(event_types_1.AgentEventType.USER_INPUT_RECEIVED, executionId, {
                response: input,
            });
        }
        await this.unwrap(this.stateManager.updateState(executionId, agent_types_1.AgentState.THINKING));
        return this.execute(context);
    }
    /**
     * Emit event
     */
    emitEvent(type, executionId, data) {
        if (this.eventEmitter) {
            this.eventEmitter(type, executionId, data);
        }
    }
}
exports.AgentExecutor = AgentExecutor;
