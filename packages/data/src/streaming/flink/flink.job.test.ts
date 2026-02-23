import { FlinkClient } from './flink.client';
import { FlinkJob } from './flink.job';

const mockFetch = jest.fn();

describe('FlinkJob', () => {
  let job: FlinkJob;

  beforeAll(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  beforeEach(() => {
    mockFetch.mockReset();
    const client = new FlinkClient({ url: 'http://localhost:8081' });
    job = new FlinkJob(client);
  });

  it('getStatus fetches job status', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ state: 'RUNNING', duration: 100 })),
    });
    const status = await job.getStatus('j1');
    expect(status.state).toBe('RUNNING');
  });

  it('cancel calls cancel endpoint', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('') });
    await job.cancel('j1');
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/jobs/j1'), expect.any(Object));
  });

  it('createSavepoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ 'request-id': 'req-1' })),
    });
    const result = await job.createSavepoint('j1', '/path');
    expect(result['request-id']).toBe('req-1');
  });
});
