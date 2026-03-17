import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import inquirer from 'inquirer';
import { Command } from 'commander';
import { generateApp } from './generate-app';

jest.mock('fs');
jest.mock('child_process', () => ({ execSync: jest.fn() }));
jest.mock('inquirer');

describe('generateApp interactive package wiring', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockExec = execSync as unknown as jest.Mock;
  const mockInquirer = inquirer as jest.Mocked<typeof inquirer>;

  let exitSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeAll(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(() => {
    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.mockImplementation(() => undefined);
    mockFs.mkdirSync.mockImplementation(() => undefined as any);
    mockFs.copyFileSync.mockImplementation(() => undefined as any);
    mockFs.writeFileSync.mockImplementation(() => undefined as any);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ name: 'x', description: 'y' }) as any);

    const allPackages = [
      '@hazeljs/config',
      '@hazeljs/swagger',
      '@hazeljs/prisma',
      '@hazeljs/typeorm',
      '@hazeljs/audit',
      '@hazeljs/auth',
      '@hazeljs/oauth',
      '@hazeljs/cache',
      '@hazeljs/cron',
      '@hazeljs/websocket',
      '@hazeljs/ai',
      '@hazeljs/agent',
      '@hazeljs/rag',
      '@hazeljs/pdf-to-audio',
      '@hazeljs/data',
      '@hazeljs/event-emitter',
      '@hazeljs/gateway',
      '@hazeljs/graphql',
      '@hazeljs/grpc',
      '@hazeljs/kafka',
      '@hazeljs/messaging',
      '@hazeljs/ml',
    ];

    mockInquirer.prompt.mockResolvedValue({
      description: 'My app',
      author: 'Me',
      license: 'Apache-2.0',
      packages: allPackages,
    } as any);

    // Simulate template exists and has some files/dirs
    mockFs.existsSync.mockImplementation((p: any) => {
      const s = String(p);
      if (s.includes(path.join('@template'))) return true; // template exists
      if (s.endsWith(path.join('.', 'my-app')) || s.endsWith(path.join(process.cwd(), '.', 'my-app'))) return false; // dest doesn't exist
      if (s.endsWith(path.join('my-app', 'package.json'))) return true; // updatePackageJson path
      if (s.endsWith(path.join('my-app', 'src'))) return true;
      return false;
    });

    mockFs.readdirSync.mockImplementation((p: any) => {
      const s = String(p);
      if (s.includes('@template') && s.endsWith('@template')) return ['package.json', 'src'] as any;
      if (s.includes('@template') && s.endsWith(path.join('@template', 'src'))) return ['index.ts', 'app.module.ts', 'hello.controller.ts'] as any;
      return [] as any;
    });

    mockFs.lstatSync.mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith('src')) return { isDirectory: () => true } as any;
      return { isDirectory: () => false } as any;
    });
  });

  it('covers interactive selection and scaffolding boilerplate', async () => {
    const program = new Command();
    generateApp(program);

    await program.parseAsync(['new', 'my-app', '--dest', '.', '--interactive'], { from: 'user' });

    expect(mockInquirer.prompt).toHaveBeenCalled();
    // git init + npm install should be attempted (mocked)
    expect(mockExec).toHaveBeenCalled();
    // boilerplate writes (app.module/index/env files) should happen
    expect(mockFs.writeFileSync).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();

    const out = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).toContain('Project created successfully');
  });
});

