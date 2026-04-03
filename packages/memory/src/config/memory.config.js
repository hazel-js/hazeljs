"use strict";
/**
 * Default configuration for memory (TTLs, retention, category defaults).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CATEGORY_CONFIG = exports.DEFAULT_MEMORY_SERVICE_CONFIG = void 0;
exports.getDefaultTtlForCategory = getDefaultTtlForCategory;
const category_types_1 = require("../types/category.types");
Object.defineProperty(exports, "DEFAULT_CATEGORY_CONFIG", { enumerable: true, get: function () { return category_types_1.DEFAULT_CATEGORY_CONFIG; } });
exports.DEFAULT_MEMORY_SERVICE_CONFIG = {
    defaultEmotionalTtlMs: 30 * 60 * 1000, // 30 min
    explicitOverInferred: true,
};
/**
 * Get default TTL for a category (e.g. emotional).
 */
function getDefaultTtlForCategory(category) {
    return category_types_1.DEFAULT_CATEGORY_CONFIG[category]?.defaultTtlMs;
}
