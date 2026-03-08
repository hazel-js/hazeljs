import {
  getDefaultTtlForCategory,
  DEFAULT_CATEGORY_CONFIG,
  DEFAULT_MEMORY_SERVICE_CONFIG,
} from '../config/memory.config';
import { MemoryCategory } from '../types/category.types';

describe('memory.config', () => {
  describe('getDefaultTtlForCategory', () => {
    it('returns TTL for EMOTIONAL', () => {
      const ttl = getDefaultTtlForCategory(MemoryCategory.EMOTIONAL);
      expect(ttl).toBeDefined();
      expect(ttl).toBe(30 * 60 * 1000);
    });

    it('returns undefined for categories without defaultTtlMs', () => {
      expect(getDefaultTtlForCategory(MemoryCategory.PREFERENCE)).toBeUndefined();
      expect(getDefaultTtlForCategory(MemoryCategory.PROFILE)).toBeUndefined();
    });
  });

  describe('DEFAULT_CATEGORY_CONFIG', () => {
    it('has config for all categories', () => {
      const categories = Object.values(MemoryCategory);
      for (const cat of categories) {
        expect(DEFAULT_CATEGORY_CONFIG[cat]).toBeDefined();
      }
    });

    it('EMOTIONAL has defaultTtlMs', () => {
      expect(DEFAULT_CATEGORY_CONFIG[MemoryCategory.EMOTIONAL].defaultTtlMs).toBe(30 * 60 * 1000);
    });

    it('EPISODIC and SEMANTIC_SUMMARY have supportsVectorSearch', () => {
      expect(DEFAULT_CATEGORY_CONFIG[MemoryCategory.EPISODIC].supportsVectorSearch).toBe(true);
      expect(DEFAULT_CATEGORY_CONFIG[MemoryCategory.SEMANTIC_SUMMARY].supportsVectorSearch).toBe(
        true
      );
    });
  });

  describe('DEFAULT_MEMORY_SERVICE_CONFIG', () => {
    it('has defaultEmotionalTtlMs and explicitOverInferred', () => {
      expect(DEFAULT_MEMORY_SERVICE_CONFIG.defaultEmotionalTtlMs).toBeDefined();
      expect(DEFAULT_MEMORY_SERVICE_CONFIG.explicitOverInferred).toBe(true);
    });
  });
});
