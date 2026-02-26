import { DataModule } from './data.module';

describe('DataModule', () => {
  describe('forRoot', () => {
    it('returns dynamic module structure', () => {
      const result = DataModule.forRoot();

      expect(result).toHaveProperty('module', DataModule);
      expect(result).toHaveProperty('providers');
      expect(result).toHaveProperty('exports');
      expect(Array.isArray(result.providers)).toBe(true);
    });

    it('includes flink config when specified', () => {
      const result = DataModule.forRoot({
        flink: { url: 'http://flink:8081', timeout: 5000 },
      });
      const flinkConfig = result.providers.find(
        (p: unknown) => p && typeof p === 'object' && 'provide' in p
      );
      expect(flinkConfig).toBeDefined();
    });
  });

  describe('getOptions', () => {
    it('returns last forRoot options', () => {
      DataModule.forRoot({ flink: { url: 'http://custom:8081' } });
      const opts = DataModule.getOptions();
      expect(opts.flink?.url).toBe('http://custom:8081');
    });
  });
});
