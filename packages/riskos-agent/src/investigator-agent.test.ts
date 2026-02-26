import { InvestigatorAgent } from './investigator-agent';
import type { InvestigatorAgentToolsConfig } from './types';

function createMockTools(): InvestigatorAgentToolsConfig {
  return {
    kyc: {
      getKycStatus: jest.fn().mockResolvedValue({ status: 'known', decision: 'APPROVED' }),
    },
    evidence: {
      getEvidence: jest.fn().mockResolvedValue({ traces: [{ id: 't1' }] }),
    },
    riskHistory: {
      getRiskHistory: jest
        .fn()
        .mockResolvedValue([{ ts: '2024-01-01', score: 10, reasons: ['test'] }]),
    },
    transactionTimeline: {
      getTimeline: jest.fn().mockResolvedValue([{ ts: '2024-01-01', amount: 100, desc: 'tx1' }]),
    },
  };
}

describe('InvestigatorAgent', () => {
  let agent: InvestigatorAgent;
  let tools: InvestigatorAgentToolsConfig;

  beforeEach(() => {
    tools = createMockTools();
    agent = new InvestigatorAgent(tools);
  });

  describe('getKycStatus', () => {
    it('should delegate to kyc tool', async () => {
      const result = await agent.getKycStatus({ sessionId: 's1', tenantId: 't1' });
      expect(result).toEqual({ status: 'known', decision: 'APPROVED' });
      expect(tools.kyc.getKycStatus).toHaveBeenCalledWith('s1', 't1');
    });

    it('should work without tenantId', async () => {
      await agent.getKycStatus({ sessionId: 's2' });
      expect(tools.kyc.getKycStatus).toHaveBeenCalledWith('s2', undefined);
    });
  });

  describe('getEvidence', () => {
    it('should delegate to evidence tool', async () => {
      const result = await agent.getEvidence({ requestId: 'r1', tenantId: 't1' });
      expect(result).toEqual({ traces: [{ id: 't1' }] });
      expect(tools.evidence.getEvidence).toHaveBeenCalledWith('r1', 't1');
    });
  });

  describe('getRiskHistory', () => {
    it('should delegate to riskHistory tool', async () => {
      const result = await agent.getRiskHistory({ entityId: 'e1', tenantId: 't1' });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ score: 10, reasons: ['test'] });
      expect(tools.riskHistory.getRiskHistory).toHaveBeenCalledWith('e1', 't1');
    });
  });

  describe('getTransactionTimeline', () => {
    it('should delegate to transactionTimeline tool', async () => {
      const result = await agent.getTransactionTimeline({ caseId: 'c1', tenantId: 't1' });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ amount: 100, desc: 'tx1' });
      expect(tools.transactionTimeline.getTimeline).toHaveBeenCalledWith('c1', 't1');
    });
  });
});
