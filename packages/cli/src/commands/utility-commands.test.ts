import fs from 'fs';
import { execSync } from 'child_process';
import { Command } from 'commander';
import { buildCommand } from './build';
import { startCommand } from './start';
import { testCommand } from './test';
import { infoCommand } from './info';

jest.mock('fs');
jest.mock('child_process', () => ({ execSync: jest.fn() }));

describe('utility commands', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockExec = execSync as unknown as jest.Mock;

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
    exitSpy.mockClear();
    logSpy.mockClear();
    errSpy.mockClear();
    delete process.env.PORT;
  });

  it('build: exits when package.json missing', async () => {
    mockFs.existsSync.mockReturnValue(false);
    const program = new Command();
    buildCommand(program);
    await program.parseAsync(['build'], { from: 'user' });
    expect(exitSpy).toHaveBeenCalled();
  });

  it('build: uses watch command when --watch is set', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ scripts: { build: 'tsc' } }) as any);
    const program = new Command();
    buildCommand(program);
    await program.parseAsync(['build', '--watch'], { from: 'user' });
    expect(mockExec).toHaveBeenCalledWith('npm run build -- --watch', { stdio: 'inherit' });
  });

  it('start: dev mode exits when dev script missing', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ scripts: { start: 'node dist/index.js' } }) as any);
    const program = new Command();
    startCommand(program);
    await program.parseAsync(['start', '--dev'], { from: 'user' });
    expect(exitSpy).toHaveBeenCalled();
  });

  it('start: sets PORT when provided', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ scripts: { start: 'node dist/index.js' } }) as any);
    const program = new Command();
    startCommand(program);
    await program.parseAsync(['start', '--port', '7777'], { from: 'user' });
    expect(process.env.PORT).toBe('7777');
    expect(mockExec).toHaveBeenCalledWith('npm start', { stdio: 'inherit' });
  });

  it('test: uses test:ci when present', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ scripts: { test: 'jest', 'test:ci': 'jest --ci' } }) as any);
    const program = new Command();
    testCommand(program);
    await program.parseAsync(['test', '--ci'], { from: 'user' });
    expect(mockExec).toHaveBeenCalledWith('npm run test:ci', { stdio: 'inherit' });
  });

  it('test: adds pattern and coverage args when not in ci', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ scripts: { test: 'jest' } }) as any);
    const program = new Command();
    testCommand(program);
    await program.parseAsync(['test', 'user.test', '--coverage'], { from: 'user' });
    expect(mockExec).toHaveBeenCalledWith('npm test -- user.test --coverage', { stdio: 'inherit' });
  });

  it('info: returns early when package.json missing', async () => {
    mockFs.existsSync.mockReturnValue(false);
    const program = new Command();
    infoCommand(program);
    await program.parseAsync(['info'], { from: 'user' });
    expect(exitSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });
});

