/**
 * Shared Registry Backend
 * In a real application, this would be Redis/Consul
 * For the demo, we use a singleton in-memory backend
 */

import { MemoryRegistryBackend } from '@hazeljs/discovery';

// Singleton instance shared across all services in this process
export const sharedBackend = new MemoryRegistryBackend();
