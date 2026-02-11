/**
 * Circuit Breaker Pattern
 * Re-exports from @hazeljs/resilience for backward compatibility.
 *
 * @deprecated Import directly from '@hazeljs/resilience' instead.
 * This module is kept for backward compatibility with existing agent code.
 */

export {
  CircuitState,
  CircuitBreakerError,
  CircuitBreaker,
  CircuitBreakerConfig,
  WithCircuitBreaker,
} from '@hazeljs/resilience';
