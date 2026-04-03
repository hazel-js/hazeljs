import { HazelAI } from '../../hazel-ai';

describe('HCEL agent orchestration', () => {
  let ai: HazelAI;

  const graphStub = {
    graphId: 'p1',
    executionId: 'ex1',
    state: {
      input: 'task',
      messages: [],
      data: {},
      nodeResults: {},
    },
    steps: [],
    nodeExecutions: {},
    duration: 1,
    completedAt: new Date(),
    success: true,
  };

  beforeEach(() => {
    ai = new HazelAI();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('agentPipeline delegates to HazelAI.agentPipeline', async () => {
    jest.spyOn(ai, 'agentPipeline').mockResolvedValue(graphStub as never);

    const result = await ai.hazel
      .agentPipeline({ pipelineId: 'p1', agents: ['agent-a', 'agent-b'] })
      .execute('task');

    expect(ai.agentPipeline).toHaveBeenCalledWith('p1', ['agent-a', 'agent-b'], 'task', undefined);
    expect(result).toEqual(graphStub);
  });

  it('agentSupervisor delegates to HazelAI.supervisor with context', async () => {
    const sup = {
      response: 'final',
      rounds: [],
      totalDuration: 2,
      completedAt: new Date(),
      success: true,
    };
    jest.spyOn(ai, 'supervisor').mockResolvedValue(sup);

    const result = await ai.hazel
      .context({ userId: 'u1', sessionId: 's1' })
      .agentSupervisor({
        name: 'lead',
        workers: ['w1', 'w2'],
        maxRounds: 3,
      })
      .execute('big task');

    expect(ai.supervisor).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'lead', workers: ['w1', 'w2'] }),
      'big task',
      { userId: 'u1', sessionId: 's1' }
    );
    expect(result).toEqual(sup);
  });

  it('agentGraphCompiled delegates to HazelAI.runAgentGraph', async () => {
    jest.spyOn(ai, 'runAgentGraph').mockResolvedValue(graphStub as never);
    const compiled = {
      execute: jest.fn(),
    };

    const result = await ai.hazel
      .context({ userId: 'u2' })
      .agentGraphCompiled('my-graph', compiled, { maxSteps: 20 })
      .execute('go');

    expect(ai.runAgentGraph).toHaveBeenCalled();
    const call = (ai.runAgentGraph as jest.Mock).mock.calls[0];
    expect(call[0]).toBe(compiled);
    expect(call[1]).toBe('go');
    expect(call[2]).toMatchObject({
      maxSteps: 20,
      initialData: expect.objectContaining({ userId: 'u2' }),
    });
    expect(result).toEqual(graphStub);
  });
});
