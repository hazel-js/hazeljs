import { FlinkClient } from './flink.client';

// Mock fetch for Flink REST API
const mockFetch = jest.fn();

describe('FlinkClient', () => {
  let client: FlinkClient;

  beforeAll(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  beforeEach(() => {
    mockFetch.mockReset();
    client = new FlinkClient({ url: 'http://localhost:8081' });
  });

  it('listJobs fetches job overview', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            jobs: [
              { id: 'j1', status: 'RUNNING', 'start-time': 123, 'end-time': 456, duration: 100 },
            ],
          })
        ),
    });

    const jobs = await client.listJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe('j1');
    expect(jobs[0].status).toBe('RUNNING');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8081/jobs/overview',
      expect.any(Object)
    );
  });

  it('getJobStatus fetches job details', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(JSON.stringify({ state: 'RUNNING', 'start-time': 123, duration: 500 })),
    });

    const status = await client.getJobStatus('j1');
    expect(status.state).toBe('RUNNING');
    expect(status.duration).toBe(500);
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve('Not found') });
    await expect(client.getJobStatus('bad')).rejects.toThrow('Flink API error');
  });

  it('submitJob throws with helpful message', async () => {
    await expect(client.submitJob({})).rejects.toThrow('submitJob: Full Flink deployment requires');
  });

  it('getClusterInfo', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ taskmanagers: 2, 'slots-total': 8 })),
    });
    const info = await client.getClusterInfo();
    expect(info.taskmanagers).toBe(2);
  });

  it('cancelJob', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('') });
    await client.cancelJob('j1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('mode=cancel'),
      expect.any(Object)
    );
  });
});
