import fs from 'fs';
import { Command } from 'commander';
import { generateWebSocketGateway } from './generate-websocket-gateway';

jest.mock('fs');

describe('generateWebSocketGateway', () => {
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

  it('should register the gateway command with alias', () => {
    generateWebSocketGateway(program);
    const cmd = program.commands.find(c => c.name() === 'gateway');
    expect(cmd).toBeDefined();
    expect(cmd?.alias()).toBe('ws');
  });

  it('should generate a gateway file with correct suffix', async () => {
    generateWebSocketGateway(program);
    await program.parseAsync(['node', 'test', 'gateway', 'chat']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('chat.gateway.ts'),
      expect.stringContaining('ChatGateway'),
    );
  });

  it('should import from @hazeljs/websocket', async () => {
    generateWebSocketGateway(program);
    await program.parseAsync(['node', 'test', 'gateway', 'chat']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain("from '@hazeljs/websocket'");
    expect(writtenContent).toContain('@Realtime');
  });
});
