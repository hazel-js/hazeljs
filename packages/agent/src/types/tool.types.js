"use strict";
/**
 * Tool System Types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolExecutionStatus = void 0;
/**
 * Tool execution status
 */
var ToolExecutionStatus;
(function (ToolExecutionStatus) {
    ToolExecutionStatus["PENDING"] = "pending";
    ToolExecutionStatus["APPROVED"] = "approved";
    ToolExecutionStatus["REJECTED"] = "rejected";
    ToolExecutionStatus["EXECUTING"] = "executing";
    ToolExecutionStatus["COMPLETED"] = "completed";
    ToolExecutionStatus["FAILED"] = "failed";
})(ToolExecutionStatus || (exports.ToolExecutionStatus = ToolExecutionStatus = {}));
