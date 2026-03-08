/**
 * Entry point for RAG memory backed by @hazeljs/memory.
 * Import from '@hazeljs/rag/memory-hazel' and ensure @hazeljs/memory is installed.
 */
export {
  HazelMemoryStoreAdapter,
  createHazelMemoryStoreAdapter,
} from './memory/stores/hazel-memory-store.adapter';
