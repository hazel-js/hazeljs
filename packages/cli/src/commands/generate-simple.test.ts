import fs from 'fs';
import { Command } from 'commander';
import {
  SIMPLE_GENERATORS,
  runSimpleGenerator,
  findSimpleGenerator,
  registerSimpleGenerators,
} from './generate-simple';

jest.mock('fs');

describe('generate-simple', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockImplementation(() => {});
  });

  describe('SIMPLE_GENERATORS', () => {
    it('should have at least 15 generator configs', () => {
      expect(SIMPLE_GENERATORS.length).toBeGreaterThanOrEqual(15);
    });

    it('should have unique types', () => {
      const types = SIMPLE_GENERATORS.map((g) => g.type);
      expect(new Set(types).size).toBe(types.length);
    });

    it('should all have non-empty templates', () => {
      for (const g of SIMPLE_GENERATORS) {
        expect(g.template.length).toBeGreaterThan(0);
      }
    });
  });

  describe('findSimpleGenerator', () => {
    it('finds by type', () => {
      const config = findSimpleGenerator('controller');
      expect(config).toBeDefined();
      expect(config!.type).toBe('controller');
    });

    it('returns undefined for unknown type', () => {
      expect(findSimpleGenerator('nope')).toBeUndefined();
    });
  });

  describe('runSimpleGenerator', () => {
    it('generates a controller file in dry-run', async () => {
      const config = findSimpleGenerator('controller')!;
      const result = await runSimpleGenerator(config, 'users', { dryRun: true });
      expect(result.ok).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.created[0]).toContain('users.controller.ts');
    });

    it('generates a guard file', async () => {
      const config = findSimpleGenerator('guard')!;
      const result = await runSimpleGenerator(config, 'auth', {});
      expect(result.ok).toBe(true);
      expect(result.created[0]).toContain('auth.guard.ts');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('generates agent with extra data', async () => {
      const config = findSimpleGenerator('agent')!;
      const result = await runSimpleGenerator(config, 'weather', { dryRun: true });
      expect(result.ok).toBe(true);
      expect(result.created[0]).toContain('weather.agent.ts');
    });

    it('appends nextSteps for cache generator', async () => {
      const config = findSimpleGenerator('cache')!;
      const result = await runSimpleGenerator(config, 'product', { dryRun: true });
      expect(result.nextSteps).toBeDefined();
      expect(result.nextSteps!.some((s) => s.includes('@hazeljs/cache'))).toBe(true);
    });

    it('handles config generator (no name required)', async () => {
      const config = findSimpleGenerator('config')!;
      const result = await runSimpleGenerator(config, '', { dryRun: true });
      expect(result.ok).toBe(true);
      expect(result.created[0]).toContain('app.config.ts');
    });

    it('handles serverless with cloud-function platform', async () => {
      const config = findSimpleGenerator('serverless')!;
      const result = await runSimpleGenerator(config, 'api', {
        dryRun: true,
        platform: 'cloud-function',
      });
      expect(result.ok).toBe(true);
      expect(result.created[0]).toContain('api.handler.ts');
    });

    it('generates with custom path', async () => {
      const config = findSimpleGenerator('service')!;
      const result = await runSimpleGenerator(config, 'order', {
        path: 'src/orders',
        dryRun: true,
      });
      expect(result.ok).toBe(true);
      expect(result.created[0]).toContain('src/orders');
    });
  });

  describe('registerSimpleGenerators', () => {
    it('registers all simple generators as sub-commands', () => {
      const program = new Command();
      registerSimpleGenerators(program);
      const commandNames = program.commands.map((c) => c.name());
      expect(commandNames).toContain('controller');
      expect(commandNames).toContain('guard');
      expect(commandNames).toContain('agent');
      expect(commandNames).toContain('serverless');
      expect(commandNames).toContain('config');
      expect(commandNames.length).toBe(SIMPLE_GENERATORS.length);
    });
  });
});
