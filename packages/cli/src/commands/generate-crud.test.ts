import fs from 'fs';
import { Command } from 'commander';
import { generateCrud } from './generate-crud';

jest.mock('fs');

describe('generateCrud', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  let program: Command;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined as any);
    mockFs.writeFileSync.mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation();
    program = new Command();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should generate all CRUD files', async () => {
    generateCrud(program);
    await program.parseAsync(['node', 'test', 'crud', 'product']);

    const writtenFiles = mockFs.writeFileSync.mock.calls.map(call => call[0] as string);
    expect(writtenFiles.some(f => f.includes('product.controller.ts'))).toBe(true);
    expect(writtenFiles.some(f => f.includes('product.service.ts'))).toBe(true);
    expect(writtenFiles.some(f => f.includes('product.dto.ts'))).toBe(true);
    expect(writtenFiles.some(f => f.includes('product.module.ts'))).toBe(true);
  });

  it('should use @hazeljs/core imports', async () => {
    generateCrud(program);
    await program.parseAsync(['node', 'test', 'crud', 'product']);

    const controllerContent = mockFs.writeFileSync.mock.calls
      .find(call => (call[0] as string).includes('controller'))?.[1] as string;
    expect(controllerContent).toContain("from '@hazeljs/core'");
  });

  it('should support --dry-run flag', async () => {
    generateCrud(program);
    await program.parseAsync(['node', 'test', 'crud', 'product', '--dry-run']);

    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should support custom route path', async () => {
    generateCrud(program);
    await program.parseAsync(['node', 'test', 'crud', 'product', '-r', 'api/products']);

    const controllerContent = mockFs.writeFileSync.mock.calls
      .find(call => (call[0] as string).includes('controller'))?.[1] as string;
    expect(controllerContent).toContain('api/products');
  });
});
