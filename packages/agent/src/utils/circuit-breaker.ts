/**
 * Circuit Breaker Pattern
 * Re-exports from @hazeljs/resilience for backward compatibility.
 *
 * @deprecated Import directly from '@hazeljs/resilience' instead (removal planned after v0.9.0).
 * This module is kept for backward compatibility with existing agent code.
 */

export {
  CircuitState,
  CircuitBreakerError,
  CircuitBreaker,
  CircuitBreakerConfig,
  WithCircuitBreaker,
} from '@hazeljs/resilience';
