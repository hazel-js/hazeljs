"use strict";
/**
 * Circuit Breaker Pattern
 * Re-exports from @hazeljs/resilience for backward compatibility.
 *
 * @deprecated Import directly from '@hazeljs/resilience' instead.
 * This module is kept for backward compatibility with existing agent code.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithCircuitBreaker = exports.CircuitBreaker = exports.CircuitBreakerError = exports.CircuitState = void 0;
var resilience_1 = require("@hazeljs/resilience");
Object.defineProperty(exports, "CircuitState", { enumerable: true, get: function () { return resilience_1.CircuitState; } });
Object.defineProperty(exports, "CircuitBreakerError", { enumerable: true, get: function () { return resilience_1.CircuitBreakerError; } });
Object.defineProperty(exports, "CircuitBreaker", { enumerable: true, get: function () { return resilience_1.CircuitBreaker; } });
Object.defineProperty(exports, "WithCircuitBreaker", { enumerable: true, get: function () { return resilience_1.WithCircuitBreaker; } });
