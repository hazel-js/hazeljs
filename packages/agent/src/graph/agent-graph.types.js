"use strict";
/**
 * AgentGraph Types
 * Type definitions for the multi-agent orchestration graph system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELEGATES_LIST_KEY = exports.DELEGATE_METADATA_KEY = exports.END = void 0;
/** Sentinel value marking the end of a graph execution */
exports.END = '__end__';
exports.DELEGATE_METADATA_KEY = Symbol('hazel:delegate');
exports.DELEGATES_LIST_KEY = Symbol('hazel:delegates');
