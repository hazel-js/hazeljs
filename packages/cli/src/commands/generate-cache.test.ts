import fs from 'fs';
import { Command } from 'commander';
import { generateCache } from './generate-cache';

jest.mock('fs');

describe('generateCache', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  let program: Command;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation();
    program = new Command();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should generate a cache service file', async () => {
    generateCache(program);
    await program.parseAsync(['node', 'test', 'cache', 'product']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('product.cache.ts'),
      expect.stringContaining('ProductCacheService'),
    );
  });

  it('should import from @hazeljs/cache', async () => {
    generateCache(program);
    await program.parseAsync(['node', 'test', 'cache', 'product']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain("from '@hazeljs/cache'");
    expect(writtenContent).toContain('@Cacheable');
    expect(writtenContent).toContain('@CacheEvict');
  });
});
