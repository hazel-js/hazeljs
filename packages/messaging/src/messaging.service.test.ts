/**
 * MessagingService tests
 */
import { MessagingService } from './messaging.service';
import { MemoryConversationContextStore } from './store/memory-conversation-context';
import type { IncomingMessage } from './types/message.types';
import type { IAIProvider } from '@hazeljs/ai';

const createMockMessage = (overrides: Partial<IncomingMessage> = {}): IncomingMessage => ({
  id: 'msg-1',
  channel: 'telegram',
  conversationId: 'conv-123',
  userId: 'user-456',
  text: 'Hello',
  timestamp: new Date(),
  ...overrides,
});

describe('MessagingService', () => {
  describe('customHandler', () => {
    it('calls customHandler and returns response', async () => {
      const customHandler = jest.fn().mockResolvedValue('Custom reply');
      const service = new MessagingService({
        customHandler,
      });

      const msg = createMockMessage({ text: 'Hi' });
      const reply = await service.handleMessage(msg);

      expect(customHandler).toHaveBeenCalledWith(msg);
      expect(reply).toBe('Custom reply');
    });

    it('appends user and assistant turns to store', async () => {
      const store = new MemoryConversationContextStore();
      const customHandler = jest.fn().mockResolvedValue('Echo');
      const service = new MessagingService({ customHandler }, store);

      await service.handleMessage(createMockMessage({ text: 'Hello' }));

      const turns = await store.getTurns('default:telegram:user-456');
      expect(turns).toHaveLength(2);
      expect(turns[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(turns[1]).toEqual({ role: 'assistant', content: 'Echo' });
    });

    it('uses sessionId from message when provided', async () => {
      const store = new MemoryConversationContextStore();
      const customHandler = jest.fn().mockResolvedValue('OK');
      const service = new MessagingService({ customHandler }, store);

      await service.handleMessage(createMockMessage({ sessionId: 'custom-session', text: 'Hi' }));

      const turns = await store.getTurns('custom-session');
      expect(turns).toHaveLength(2);
    });

    it('does not append assistant turn when reply is empty', async () => {
      const store = new MemoryConversationContextStore();
      const customHandler = jest.fn().mockResolvedValue('');
      const service = new MessagingService({ customHandler }, store);

      const reply = await service.handleMessage(createMockMessage({ text: 'Hi' }));

      expect(reply).toBe('');
      const turns = await store.getTurns('default:telegram:user-456');
      expect(turns).toHaveLength(1);
      expect(turns[0].role).toBe('user');
    });
  });

  describe('agentHandler', () => {
    it('calls agentHandler and returns string result', async () => {
      const agentHandler = jest.fn().mockResolvedValue('Agent says hi');
      const store = new MemoryConversationContextStore();
      const service = new MessagingService({ agentHandler }, store);

      const msg = createMockMessage({ text: 'Help' });
      const reply = await service.handleMessage(msg);

      expect(agentHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: msg, sessionId: expect.any(String) })
      );
      expect(reply).toBe('Agent says hi');
    });

    it('handles AgentHandlerResult with response property', async () => {
      const agentHandler = jest.fn().mockResolvedValue({
        response: 'Here is the answer',
        sources: [{ content: 'doc1', score: 0.9 }],
      });
      const service = new MessagingService({ agentHandler });

      const reply = await service.handleMessage(createMockMessage({ text: 'Query' }));

      expect(reply).toBe('Here is the answer');
    });

    it('appends turns to store for agentHandler', async () => {
      const store = new MemoryConversationContextStore();
      const agentHandler = jest.fn().mockResolvedValue('Done');
      const service = new MessagingService({ agentHandler }, store);

      await service.handleMessage(createMockMessage({ text: 'Go' }));

      const turns = await store.getTurns('default:telegram:user-456');
      expect(turns).toHaveLength(2);
    });
  });

  describe('aiProvider (LLM)', () => {
    it('throws when no aiProvider, agentHandler, or customHandler', async () => {
      const service = new MessagingService({});

      await expect(service.handleMessage(createMockMessage())).rejects.toThrow(
        'MessagingService requires aiProvider, agentHandler, or customHandler'
      );
    });

    it('calls aiProvider.complete and returns response', async () => {
      const mockComplete = jest.fn().mockResolvedValue({ content: '  LLM reply  ' });
      const aiProvider = { complete: mockComplete } as unknown as IAIProvider;
      const service = new MessagingService({ aiProvider });

      const reply = await service.handleMessage(createMockMessage({ text: 'Hello' }));

      expect(mockComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user', content: 'Hello' }),
          ]),
        })
      );
      expect(reply).toBe('LLM reply');
    });

    it('uses fallback when response content is null/undefined', async () => {
      const aiProvider = {
        complete: jest.fn().mockResolvedValue({ content: null }),
      } as unknown as IAIProvider;
      const service = new MessagingService({ aiProvider });

      const reply = await service.handleMessage(createMockMessage());

      expect(reply).toBe('I could not generate a response.');
    });

    it('uses RAG when ragService provided', async () => {
      const mockComplete = jest.fn().mockResolvedValue({ content: 'RAG answer' });
      const aiProvider = { complete: mockComplete } as unknown as IAIProvider;
      const ragService = {
        search: jest.fn().mockResolvedValue([
          { content: 'Doc 1 content', score: 0.9 },
          { content: 'Doc 2 content', score: 0.8 },
        ]),
      };
      const service = new MessagingService({ aiProvider, ragService });

      await service.handleMessage(createMockMessage({ text: 'What is X?' }));

      expect(ragService.search).toHaveBeenCalledWith(
        'What is X?',
        expect.objectContaining({ topK: 5, minScore: 0.5 })
      );
      const systemContent = (
        mockComplete.mock.calls[0][0] as { messages: Array<{ role: string; content: string }> }
      ).messages[0].content;
      expect(systemContent).toContain('Doc 1 content');
      expect(systemContent).toContain('Doc 2 content');
    });

    it('does not augment prompt when RAG returns no results', async () => {
      const mockComplete = jest.fn().mockResolvedValue({ content: 'Answer' });
      const aiProvider = { complete: mockComplete } as unknown as IAIProvider;
      const ragService = { search: jest.fn().mockResolvedValue([]) };
      const service = new MessagingService({ aiProvider, ragService });

      await service.handleMessage(createMockMessage({ text: 'Query' }));

      const systemContent = (
        mockComplete.mock.calls[0][0] as { messages: Array<{ role: string; content: string }> }
      ).messages[0].content;
      expect(systemContent).not.toContain('Context:');
    });
  });

  describe('clearSession', () => {
    it('clears conversation history', async () => {
      const store = new MemoryConversationContextStore();
      const customHandler = jest.fn().mockResolvedValue('Hi');
      const service = new MessagingService({ customHandler }, store);

      await service.handleMessage(createMockMessage({ text: 'Hello' }));
      await service.clearSession('default:telegram:user-456');

      const turns = await store.getTurns('default:telegram:user-456');
      expect(turns).toEqual([]);
    });
  });

  describe('getOptions', () => {
    it('returns copy of options', () => {
      const service = new MessagingService({
        customHandler: () => 'x',
        model: 'gpt-4',
      });

      const opts = service.getOptions();
      expect(opts.model).toBe('gpt-4');
      expect(opts.customHandler).toBeDefined();
      expect(opts).not.toBe(service.getOptions());
    });
  });
});
