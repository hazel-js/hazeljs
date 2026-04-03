"use strict";
/**
 * Core Agent Runtime Types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentActionType = exports.AgentState = void 0;
/**
 * Agent execution state
 */
var AgentState;
(function (AgentState) {
    AgentState["IDLE"] = "idle";
    AgentState["THINKING"] = "thinking";
    AgentState["USING_TOOL"] = "using_tool";
    AgentState["WAITING_FOR_INPUT"] = "waiting_for_input";
    AgentState["WAITING_FOR_APPROVAL"] = "waiting_for_approval";
    AgentState["COMPLETED"] = "completed";
    AgentState["FAILED"] = "failed";
})(AgentState || (exports.AgentState = AgentState = {}));
/**
 * Agent action types
 */
var AgentActionType;
(function (AgentActionType) {
    AgentActionType["THINK"] = "think";
    AgentActionType["USE_TOOL"] = "use_tool";
    AgentActionType["USE_TOOLS"] = "use_tools";
    AgentActionType["ASK_USER"] = "ask_user";
    AgentActionType["RESPOND"] = "respond";
    AgentActionType["WAIT"] = "wait";
    AgentActionType["COMPLETE"] = "complete";
})(AgentActionType || (exports.AgentActionType = AgentActionType = {}));
