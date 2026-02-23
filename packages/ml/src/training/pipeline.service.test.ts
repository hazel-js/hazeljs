import { PipelineService } from './pipeline.service';

describe('PipelineService', () => {
  let service: PipelineService;

  beforeEach(() => {
    service = new PipelineService();
  });

  it('registers and runs pipeline', async () => {
    service.registerPipeline('test', [
      { name: 'step1', transform: (d) => ({ ...(d as object), a: 1 }) },
      { name: 'step2', transform: (d) => ({ ...(d as object), b: 2 }) },
    ]);
    const result = await service.run('test', { x: 0 });
    expect(result).toEqual({ x: 0, a: 1, b: 2 });
  });

  it('handles async transforms', async () => {
    service.registerPipeline('async', [
      { name: 'async', transform: async (d) => ({ ...(d as object), done: true }) },
    ]);
    const result = await service.run('async', {});
    expect(result).toEqual({ done: true });
  });

  it('throws when pipeline not found', async () => {
    await expect(service.run('missing', {})).rejects.toThrow('Pipeline not found: missing');
  });

  it('getPipeline returns steps', () => {
    const steps = [{ name: 's1', transform: (d: unknown) => d }];
    service.registerPipeline('p', steps);
    expect(service.getPipeline('p')).toEqual(steps);
    expect(service.getPipeline('x')).toBeUndefined();
  });

  it('listPipelines returns names', () => {
    service.registerPipeline('a', []);
    service.registerPipeline('b', []);
    expect(service.listPipelines()).toEqual(['a', 'b']);
  });
});
