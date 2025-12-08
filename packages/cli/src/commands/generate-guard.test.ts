import fs from 'fs';
import { Command } from 'commander';
import { generateGuard } from './generate-guard';
import { Generator } from '../utils/generator';

jest.mock('fs');
jest.mock('../utils/generator');

describe('generateGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  });

  it('should register guard command', () => {
    const mockProgram = {
      command: jest.fn().mockReturnThis(),
      description: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
      action: jest.fn(),
    } as unknown as Command;
    
    generateGuard(mockProgram);
    expect(mockProgram.command).toHaveBeenCalledWith('guard <name>');
    expect(mockProgram.description).toHaveBeenCalledWith('Generate a new guard');
    expect(mockProgram.option).toHaveBeenCalledWith('-p, --path <path>', 'Path where the guard should be generated');
  });

  it('should generate guard file', async () => {
    const name = 'test';
    const path = 'src/test';
    const mockGenerator = {
      generate: jest.fn().mockImplementation(async (options) => {
        const filePath = `${options.path}/${options.name}.guard.ts`;
        const content = `import { Injectable, CanActivate, ExecutionContext } from '@hazeljs/core';

@Injectable()
export class ${options.name}Guard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    // Add your guard logic here
    return true;
  }
}`;
        (fs.writeFileSync as jest.Mock)(filePath, content);
      }),
      promptForOptions: jest.fn().mockResolvedValue({ name, path }),
    };
    (Generator as jest.Mock).mockImplementation(() => mockGenerator);
    
    const mockAction = jest.fn();
    const mockProgram = {
      command: jest.fn().mockReturnThis(),
      description: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
      action: mockAction,
    } as unknown as Command;
    
    generateGuard(mockProgram);
    
    const actionHandler = mockAction.mock.calls[0][0];
    await actionHandler(name, { path });
    
    expect(mockGenerator.generate).toHaveBeenCalledWith({ name, path });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining(`${path}/${name}.guard.ts`),
      expect.stringContaining('canActivate')
    );
  });

  it('should include canActivate method', async () => {
    const name = 'test';
    const path = 'src/test';
    const mockGenerator = {
      generate: jest.fn().mockImplementation(async (options) => {
        const filePath = `${options.path}/${options.name}.guard.ts`;
        const content = `import { Injectable, CanActivate, ExecutionContext } from '@hazeljs/core';

@Injectable()
export class ${options.name}Guard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    // Add your guard logic here
    return true;
  }
}`;
        (fs.writeFileSync as jest.Mock)(filePath, content);
      }),
      promptForOptions: jest.fn().mockResolvedValue({ name, path }),
    };
    (Generator as jest.Mock).mockImplementation(() => mockGenerator);
    
    const mockAction = jest.fn();
    const mockProgram = {
      command: jest.fn().mockReturnThis(),
      description: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
      action: mockAction,
    } as unknown as Command;
    
    generateGuard(mockProgram);
    
    const actionHandler = mockAction.mock.calls[0][0];
    await actionHandler(name, { path });
    
    expect(mockGenerator.generate).toHaveBeenCalledWith({ name, path });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining(`${path}/${name}.guard.ts`),
      expect.stringContaining('canActivate')
    );
  });
}); 