import { createInvestigatorRuntime, runInvestigator } from './create-investigator-runtime';
import {
  createKycToolFromStore,
  createEvidenceToolFromAuditSink,
  createPlaceholderRiskHistoryTool,
  createPlaceholderTransactionTimelineTool,
} from './adapters';

const mockAiService = {
  chat: jest.fn(),
  streamChat: jest.fn(),
} as never;

const mockTools = {
  kyc: createKycToolFromStore({ get: async () => null }),
  evidence: createEvidenceToolFromAuditSink({
    buildEvidencePack: async () => ({ traces: [] }),
  }),
  riskHistory: createPlaceholderRiskHistoryTool(),
  transactionTimeline: createPlaceholderTransactionTimelineTool(),
};

describe('createInvestigatorRuntime', () => {
  it('should return an AgentRuntime with expected methods', () => {
    const runtime = createInvestigatorRuntime({
      aiService: mockAiService,
      tools: mockTools,
    });
    expect(runtime).toBeDefined();
    expect(typeof runtime.registerAgent).toBe('function');
    expect(typeof runtime.registerAgentInstance).toBe('function');
    expect(typeof runtime.execute).toBe('function');
  });

  it('should use default model when not provided', () => {
    const runtime = createInvestigatorRuntime({
      aiService: mockAiService,
      tools: mockTools,
    });
    expect(runtime).toBeDefined();
  });

  it('should accept custom model', () => {
    const runtime = createInvestigatorRuntime({
      aiService: mockAiService,
      tools: mockTools,
      model: 'claude-3-opus',
    });
    expect(runtime).toBeDefined();
  });

  it('should accept custom memoryManager', () => {
    const mockMemory = {} as never;
    const runtime = createInvestigatorRuntime({
      aiService: mockAiService,
      tools: mockTools,
      memoryManager: mockMemory,
    });
    expect(runtime).toBeDefined();
  });
});

describe('runInvestigator', () => {
  it('should return response, steps, and duration from runtime.execute', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      response: 'Investigation complete',
      steps: [{ type: 'tool' }],
      duration: 150,
    });
    const mockRuntime = { execute: mockExecute };

    const result = await runInvestigator(
      mockRuntime as unknown as Parameters<typeof runInvestigator>[0],
      {
        caseId: 'c1',
        question: 'What is the KYC status?',
      }
    );

    expect(result).toEqual({
      response: 'Investigation complete',
      steps: 1,
      duration: 150,
    });
    expect(mockExecute).toHaveBeenCalledWith(
      'investigator-agent',
      'Case c1: What is the KYC status?',
      expect.objectContaining({
        sessionId: expect.stringMatching(/^investigation-c1-\d+$/),
        userId: undefined,
        metadata: { caseId: 'c1', tenantId: undefined },
      })
    );
  });

  it('should use provided sessionId when given', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      response: 'OK',
      steps: [],
      duration: 0,
    });
    const mockRuntime = { execute: mockExecute };

    await runInvestigator(mockRuntime as unknown as Parameters<typeof runInvestigator>[0], {
      caseId: 'c2',
      question: 'Q',
      sessionId: 'custom-session-123',
    });

    expect(mockExecute).toHaveBeenCalledWith(
      'investigator-agent',
      'Case c2: Q',
      expect.objectContaining({
        sessionId: 'custom-session-123',
        userId: undefined,
        metadata: { caseId: 'c2', tenantId: undefined },
      })
    );
  });

  it('should pass userId and tenantId to metadata', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      response: 'OK',
      steps: [],
      duration: 0,
    });
    const mockRuntime = { execute: mockExecute };

    await runInvestigator(mockRuntime as unknown as Parameters<typeof runInvestigator>[0], {
      caseId: 'c3',
      question: 'Q',
      userId: 'u1',
      tenantId: 't1',
    });

    expect(mockExecute).toHaveBeenCalledWith(
      'investigator-agent',
      'Case c3: Q',
      expect.objectContaining({
        userId: 'u1',
        metadata: { caseId: 'c3', tenantId: 't1' },
      })
    );
  });

  it('should return "No response" when result.response is undefined', async () => {
    const mockRuntime = {
      execute: jest.fn().mockResolvedValue({
        response: undefined,
        steps: [],
        duration: 0,
      }),
    };

    const result = await runInvestigator(
      mockRuntime as unknown as Parameters<typeof runInvestigator>[0],
      {
        caseId: 'c4',
        question: 'Q',
      }
    );

    expect(result.response).toBe('No response');
    expect(result.steps).toBe(0);
  });
});
