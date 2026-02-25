/**
 * Circuit Breaker Registry
 * Global registry for managing named circuit breaker instances
 */

import { CircuitBreaker } from './circuit-breaker';
import { CircuitBreakerConfig } from '../types';

export class CircuitBreakerRegistry {
  private static breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker by name
   */
  static getOrCreate(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = new CircuitBreaker(config);
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  /**
   * Get an existing circuit breaker
   */
  static get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  /**
   * Register a circuit breaker instance
   */
  static register(name: string, breaker: CircuitBreaker): void {
    this.breakers.set(name, breaker);
  }

  /**
   * Remove a circuit breaker
   */
  static remove(name: string): boolean {
    return this.breakers.delete(name);
  }

  /**
   * Get all registered breakers
   */
  static getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Clear the registry
   */
  static clear(): void {
    this.breakers.clear();
  }
}
