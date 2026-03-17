import fs from 'fs';
import { execSync } from 'child_process';
import inquirer from 'inquirer';
import { Command } from 'commander';
import { generateApp } from './generate-app';

jest.mock('fs');
jest.mock('child_process', () => ({ execSync: jest.fn() }));
jest.mock('inquirer');

describe('generateApp (hazel new)', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockExec = execSync as unknown as jest.Mock;
  const mockInquirer = inquirer as jest.Mocked<typeof inquirer>;

  let exitSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;

  beforeAll(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.mockImplementation(() => undefined);
    mockFs.mkdirSync.mockImplementation(() => undefined as any);
    mockFs.writeFileSync.mockImplementation(() => undefined as any);
    mockFs.copyFileSync.mockImplementation(() => undefined as any);
    mockFs.readdirSync.mockReturnValue([] as any);
    mockFs.lstatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockInquirer.prompt.mockResolvedValue({} as any);
  });

  it('exits if destination already exists', async () => {
    // dest exists
    mockFs.existsSync.mockImplementation((p: any) => String(p).endsWith('my-app'));
    const program = new Command();
    generateApp(program);
    await program.parseAsync(['new', 'my-app', '--dest', '.'], { from: 'user' });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('creates basic structure when template missing and skip install/git', async () => {
    mockFs.existsSync.mockImplementation((p: any) => {
      const s = String(p);
      if (s.includes('@template')) return false;
      if (s.endsWith('my-app')) return false;
      return false;
    });

    const program = new Command();
    generateApp(program);
    await program.parseAsync(['new', 'my-app', '--dest', '.', '--skip-install', '--skip-git'], { from: 'user' });

    expect(mockFs.mkdirSync).toHaveBeenCalled();
    expect(mockFs.writeFileSync).toHaveBeenCalled();
    expect(mockExec).not.toHaveBeenCalled(); // skipped install + git
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('runs interactive prompt when -i is set', async () => {
    mockFs.existsSync.mockImplementation((p: any) => {
      const s = String(p);
      if (s.includes('@template')) return false;
      if (s.endsWith('my-app')) return false;
      return false;
    });

    mockInquirer.prompt.mockResolvedValue({
      description: 'My app',
      author: 'Me',
      license: 'MIT',
      packages: [],
    } as any);

    const program = new Command();
    generateApp(program);
    await program.parseAsync(['new', 'my-app', '--dest', '.', '--skip-install', '--skip-git', '--interactive'], { from: 'user' });

    expect(mockInquirer.prompt).toHaveBeenCalled();
  });
});

