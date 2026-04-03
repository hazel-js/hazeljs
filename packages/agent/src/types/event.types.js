"use strict";
/**
 * Agent Runtime Event Types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentEventType = void 0;
/**
 * Event types emitted by the agent runtime
 */
var AgentEventType;
(function (AgentEventType) {
    AgentEventType["EXECUTION_STARTED"] = "agent.execution.started";
    AgentEventType["EXECUTION_COMPLETED"] = "agent.execution.completed";
    AgentEventType["EXECUTION_FAILED"] = "agent.execution.failed";
    AgentEventType["STEP_STARTED"] = "agent.step.started";
    AgentEventType["STEP_COMPLETED"] = "agent.step.completed";
    AgentEventType["STEP_FAILED"] = "agent.step.failed";
    AgentEventType["STATE_CHANGED"] = "agent.state.changed";
    AgentEventType["TOOL_EXECUTION_STARTED"] = "tool.execution.started";
    AgentEventType["TOOL_EXECUTION_COMPLETED"] = "tool.execution.completed";
    AgentEventType["TOOL_EXECUTION_FAILED"] = "tool.execution.failed";
    AgentEventType["TOOL_APPROVAL_REQUESTED"] = "tool.approval.requested";
    AgentEventType["TOOL_APPROVAL_GRANTED"] = "tool.approval.granted";
    AgentEventType["TOOL_APPROVAL_DENIED"] = "tool.approval.denied";
    AgentEventType["USER_INPUT_REQUESTED"] = "agent.input.requested";
    AgentEventType["USER_INPUT_RECEIVED"] = "agent.input.received";
    AgentEventType["MEMORY_UPDATED"] = "agent.memory.updated";
    AgentEventType["RAG_QUERY_EXECUTED"] = "agent.rag.executed";
    // Graph orchestration events
    AgentEventType["GRAPH_STARTED"] = "graph.started";
    AgentEventType["GRAPH_COMPLETED"] = "graph.completed";
    AgentEventType["GRAPH_FAILED"] = "graph.failed";
    AgentEventType["GRAPH_NODE_STARTED"] = "graph.node.started";
    AgentEventType["GRAPH_NODE_COMPLETED"] = "graph.node.completed";
    AgentEventType["GRAPH_NODE_FAILED"] = "graph.node.failed";
    AgentEventType["GRAPH_PARALLEL_STARTED"] = "graph.parallel.started";
    AgentEventType["GRAPH_PARALLEL_COMPLETED"] = "graph.parallel.completed";
    // Supervisor events
    AgentEventType["SUPERVISOR_ROUND_STARTED"] = "supervisor.round.started";
    AgentEventType["SUPERVISOR_DELEGATED"] = "supervisor.delegated";
    AgentEventType["SUPERVISOR_FINISHED"] = "supervisor.finished";
    // Agent delegation events (agent-as-tool)
    AgentEventType["DELEGATE_STARTED"] = "agent.delegate.started";
    AgentEventType["DELEGATE_COMPLETED"] = "agent.delegate.completed";
})(AgentEventType || (exports.AgentEventType = AgentEventType = {}));
