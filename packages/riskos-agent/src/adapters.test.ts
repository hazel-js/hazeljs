import {
  createKycToolFromStore,
  createEvidenceToolFromAuditSink,
  createPlaceholderRiskHistoryTool,
  createPlaceholderTransactionTimelineTool,
} from './adapters';

describe('createKycToolFromStore', () => {
  it('should return not_found when session does not exist', async () => {
    const store = { get: jest.fn().mockResolvedValue(null) };
    const tool = createKycToolFromStore(store);
    const result = await tool.getKycStatus('session-1');
    expect(result).toEqual({ status: 'not_found' });
    expect(store.get).toHaveBeenCalledWith('session-1');
  });

  it('should return known status with decision when session exists', async () => {
    const store = {
      get: jest.fn().mockResolvedValue({ decision: { status: 'APPROVED' } }),
    };
    const tool = createKycToolFromStore(store);
    const result = await tool.getKycStatus('session-2');
    expect(result).toEqual({ status: 'known', decision: 'APPROVED' });
  });

  it('should handle session without decision', async () => {
    const store = { get: jest.fn().mockResolvedValue({}) };
    const tool = createKycToolFromStore(store);
    const result = await tool.getKycStatus('session-3');
    expect(result).toEqual({ status: 'known', decision: undefined });
  });
});

describe('createEvidenceToolFromAuditSink', () => {
  it('should return traces from buildEvidencePack', async () => {
    const traces = [{ id: 't1' }, { id: 't2' }];
    const sink = {
      buildEvidencePack: jest.fn().mockResolvedValue({ traces }),
    };
    const tool = createEvidenceToolFromAuditSink(sink);
    const result = await tool.getEvidence('req-1', 'tenant-1');
    expect(result).toEqual({ traces });
    expect(sink.buildEvidencePack).toHaveBeenCalledWith({
      requestId: 'req-1',
      tenantId: 'tenant-1',
    });
  });

  it('should work without tenantId', async () => {
    const sink = {
      buildEvidencePack: jest.fn().mockResolvedValue({ traces: [] }),
    };
    const tool = createEvidenceToolFromAuditSink(sink);
    const result = await tool.getEvidence('req-2');
    expect(result).toEqual({ traces: [] });
    expect(sink.buildEvidencePack).toHaveBeenCalledWith({
      requestId: 'req-2',
      tenantId: undefined,
    });
  });
});

describe('createPlaceholderRiskHistoryTool', () => {
  it('should return placeholder risk history', async () => {
    const tool = createPlaceholderRiskHistoryTool();
    const result = await tool.getRiskHistory('entity-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      score: 0,
      reasons: ['No risk history available'],
    });
    expect(result[0].ts).toBeDefined();
  });
});

describe('createPlaceholderTransactionTimelineTool', () => {
  it('should return placeholder timeline for case', async () => {
    const tool = createPlaceholderTransactionTimelineTool();
    const result = await tool.getTimeline('case-123');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      amount: 0,
      desc: 'Placeholder for case case-123',
    });
    expect(result[0].ts).toBeDefined();
  });
});
