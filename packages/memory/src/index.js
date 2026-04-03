"use strict";
/**
 * @hazeljs/memory — Pluggable user memory with multi-store support
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultTtlForCategory = exports.DEFAULT_MEMORY_SERVICE_CONFIG = exports.DEFAULT_CATEGORY_CONFIG = exports.MemoryService = exports.VectorEpisodicStore = exports.RedisStore = exports.PostgresStore = exports.CompositeMemoryStore = exports.createMemoryStore = exports.createDefaultMemoryStore = exports.InMemoryStore = void 0;
// Types
__exportStar(require("./types/memory-item.types"), exports);
__exportStar(require("./types/category.types"), exports);
__exportStar(require("./types/store.types"), exports);
// Default in-memory store
var in_memory_store_1 = require("./store/in-memory.store");
Object.defineProperty(exports, "InMemoryStore", { enumerable: true, get: function () { return in_memory_store_1.InMemoryStore; } });
Object.defineProperty(exports, "createDefaultMemoryStore", { enumerable: true, get: function () { return in_memory_store_1.createDefaultMemoryStore; } });
// Store factory
var create_memory_store_1 = require("./store/create-memory-store");
Object.defineProperty(exports, "createMemoryStore", { enumerable: true, get: function () { return create_memory_store_1.createMemoryStore; } });
// Composite store
var composite_store_1 = require("./store/composite.store");
Object.defineProperty(exports, "CompositeMemoryStore", { enumerable: true, get: function () { return composite_store_1.CompositeMemoryStore; } });
// Adapters
var postgres_store_1 = require("./store/adapters/postgres.store");
Object.defineProperty(exports, "PostgresStore", { enumerable: true, get: function () { return postgres_store_1.PostgresStore; } });
var redis_store_1 = require("./store/adapters/redis.store");
Object.defineProperty(exports, "RedisStore", { enumerable: true, get: function () { return redis_store_1.RedisStore; } });
var vector_episodic_store_1 = require("./store/adapters/vector-episodic.store");
Object.defineProperty(exports, "VectorEpisodicStore", { enumerable: true, get: function () { return vector_episodic_store_1.VectorEpisodicStore; } });
// Service
var memory_service_1 = require("./service/memory.service");
Object.defineProperty(exports, "MemoryService", { enumerable: true, get: function () { return memory_service_1.MemoryService; } });
// Config
var memory_config_1 = require("./config/memory.config");
Object.defineProperty(exports, "DEFAULT_CATEGORY_CONFIG", { enumerable: true, get: function () { return memory_config_1.DEFAULT_CATEGORY_CONFIG; } });
Object.defineProperty(exports, "DEFAULT_MEMORY_SERVICE_CONFIG", { enumerable: true, get: function () { return memory_config_1.DEFAULT_MEMORY_SERVICE_CONFIG; } });
Object.defineProperty(exports, "getDefaultTtlForCategory", { enumerable: true, get: function () { return memory_config_1.getDefaultTtlForCategory; } });
