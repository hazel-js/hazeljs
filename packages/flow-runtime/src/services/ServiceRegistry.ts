/**
 * Service registry - logger + placeholders for AI/RAG/Agent clients
 * Keep minimal - no dependency on Hazel core
 */

export interface ServiceRegistry {
  logger: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
    debug: (msg: string, meta?: Record<string, unknown>) => void;
  };
  // Placeholders for future: ai, rag, agent
}

export function createServiceRegistry(): ServiceRegistry {
  return {
    logger: {
      info: (msg, meta): void => {
        // eslint-disable-next-line no-console -- default logger implementation
        console.log('[INFO]', msg, meta ?? '');
      },
      error: (msg, meta): void => {
        // eslint-disable-next-line no-console -- default logger implementation
        console.error('[ERROR]', msg, meta ?? '');
      },
      debug: (msg, meta): void => {
        // eslint-disable-next-line no-console -- default logger implementation
        console.debug('[DEBUG]', msg, meta ?? '');
      },
    },
  };
}
