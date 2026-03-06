import { TransformerService } from './transformer.service';

describe('TransformerService', () => {
  let service: TransformerService;

  beforeEach(() => {
    service = new TransformerService();
  });

  it('registers and applies transform', async () => {
    service.register('double', (x) => (x as number) * 2);
    const result = await service.apply('double', 5);
    expect(result).toBe(10);
  });

  it('throws for unregistered transform', async () => {
    await expect(service.apply('missing', 1)).rejects.toThrow('Transform not found: missing');
  });

  it('pipe composes functions', async () => {
    const fn = service.pipe(
      (x) => (x as number) + 1,
      (x) => (x as number) * 2
    );
    const result = await fn(5);
    expect(result).toBe(12);
  });

  it('map transforms array', async () => {
    const mapper = service.map((x) => (x as number) * 2);
    const result = await mapper([1, 2, 3]);
    expect(result).toEqual([2, 4, 6]);
  });

  it('filter filters array', async () => {
    const filter = service.filter((x) => (x as number) > 2);
    const result = await filter([1, 2, 3, 4]);
    expect(result).toEqual([3, 4]);
  });

  it('apply returns sync result without awaiting', async () => {
    service.register('sync', (x) => (x as number) + 1);
    const result = await service.apply('sync', 10);
    expect(result).toBe(11);
  });

  it('filter with async predicate', async () => {
    const filter = service.filter(async (x) => (x as number) > 1);
    const result = await filter([1, 2, 3]);
    expect(result).toEqual([2, 3]);
  });
});
