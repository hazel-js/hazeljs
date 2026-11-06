/**
 * Duck-typed port matching `@hazeljs/context` ContextService.assemble.
 * Keep as a structural type so `@hazeljs/ai` does not hard-depend on context.
 */

export interface ContextAssembleRequest {
  query: string;
  tenantId: string;
  namespace?: string;
  agentId?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface AssembledContextResult {
  text: string;
  sourcesUsed?: string[];
  tokenEstimate?: number;
  plan?: { sources?: string[]; rationale?: string[] };
}

export interface ContextAssemblerPort {
  assemble(request: ContextAssembleRequest): Promise<AssembledContextResult>;
}

/** Call-level request; query defaults to the last user message when omitted. */
export interface CallContextRequest {
  tenantId: string;
  query?: string;
  namespace?: string;
  agentId?: string;
  userId?: string;
  sessionId?: string;
}

export interface CallContextMeta {
  sourcesUsed?: string[];
  tokenEstimate?: number;
  plan?: { sources?: string[]; rationale?: string[] };
  /** True when assemble threw and the call continued without context. */
  softFailed?: boolean;
  error?: string;
}

/**
 * Merge assembled context into the message list (prepend / append to system).
 */
export function injectAssembledContext(
  messages: import('../ai-enhanced.types').AIMessage[],
  assembledText: string
): import('../ai-enhanced.types').AIMessage[] {
  const text = assembledText.trim();
  if (!text) return messages;

  const msgs = messages.map((m) => ({ ...m }));
  const systemIdx = msgs.findIndex((m) => m.role === 'system');
  if (systemIdx >= 0) {
    const existing = msgs[systemIdx];
    const base =
      typeof existing.content === 'string'
        ? existing.content
        : existing.content.map((p) => (p.type === 'text' ? p.text : '')).join(' ');
    msgs[systemIdx] = {
      ...existing,
      content: `${base}\n\nAssembled context:\n${text}`,
    };
    return msgs;
  }

  return [{ role: 'system', content: `Assembled context:\n${text}` }, ...msgs];
}

export function lastUserQuery(messages: import('../ai-enhanced.types').AIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    if (typeof m.content === 'string') return m.content;
    return m.content
      .map((p) => (p.type === 'text' ? p.text : ''))
      .join(' ')
      .trim();
  }
  return '';
}
