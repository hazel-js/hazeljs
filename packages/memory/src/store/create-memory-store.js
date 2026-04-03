"use strict";
/**
 * Factory for creating a MemoryStore from config (default: in-memory).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMemoryStore = createMemoryStore;
const in_memory_store_1 = require("./in-memory.store");
const composite_store_1 = require("./composite.store");
const postgres_store_1 = require("./adapters/postgres.store");
const redis_store_1 = require("./adapters/redis.store");
/**
 * Create a MemoryStore from config. Default type is 'in-memory'.
 */
function createMemoryStore(config) {
    if (!config || config.type === 'in-memory') {
        return (0, in_memory_store_1.createDefaultMemoryStore)(config?.type === 'in-memory' ? config.options : undefined);
    }
    if (config.type === 'postgres') {
        return new postgres_store_1.PostgresStore(config.options);
    }
    if (config.type === 'redis') {
        return new redis_store_1.RedisStore(config.options);
    }
    if (config.type === 'composite') {
        return new composite_store_1.CompositeMemoryStore(config.options);
    }
    return (0, in_memory_store_1.createDefaultMemoryStore)();
}
