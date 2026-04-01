declare module '@hazeljs/agent' {
  export interface AgentExecutionResult {
    response: string;
    usage?: { tokens?: number; [key: string]: unknown };
    [key: string]: unknown;
  }

  export interface AgentConfig {
    name?: string;
    [key: string]: unknown;
  }

  export class AgentService {
    constructor(aiService?: unknown);
    execute(
      name: string,
      input: string,
      options?: Record<string, unknown>
    ): Promise<AgentExecutionResult>;
    pipeline(
      id: string,
      agents: string[]
    ): { execute: (input: string) => Promise<AgentExecutionResult> };
  }

  export const Agent: unknown;
  export const Tool: unknown;
  export const Delegate: unknown;
}

declare module '@hazeljs/rag' {
  export class RAGPipeline {
    static from(config: Record<string, unknown>): RAGPipeline;
    initialize(): Promise<void>;
    config: {
      vectorStore: unknown;
      embeddingProvider: unknown;
      textSplitter: unknown;
    };
  }

  export class RAGService {
    constructor(config: Record<string, unknown>);
    initialize(): Promise<void>;
    index(data: unknown): Promise<string[]>;
    ingest(path: string): Promise<string[]>;
    ask(query: string, options?: Record<string, unknown>): Promise<unknown>;
    search(query: string, options?: Record<string, unknown>): Promise<unknown[]>;
  }
}
