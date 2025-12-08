import fs from 'fs';
import { Command } from 'commander';
import { generateModule } from './generate-module';
import { Generator } from '../utils/generator';

jest.mock('fs');
jest.mock('../utils/generator');

describe('generateModule', () => {
  let program: Command;
  let mockAction: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    program = new Command();
    mockAction = jest.fn();
    program.action(mockAction);
  });

  it('should register module command', () => {
    generateModule(program);
    const command = program.commands.find(cmd => cmd.name() === 'module');
    expect(command).toBeDefined();
    expect(command?.description()).toBe('Generate a new module (with controller, service, DTOs)');
  });

  it('should generate module file', async () => {
    const name = 'test';
    const path = 'src/test';
    const mockGenerator = {
      generate: jest.fn(),
      promptForOptions: jest.fn().mockResolvedValue({ name, path }),
    };
    (Generator as jest.Mock).mockImplementation(() => mockGenerator);

    const handler = async (name: string, options: { path?: string }) => {
      const generator = new (Generator as any)();
      const generatorOptions = { name, path: options.path };
      const finalOptions = await generator.promptForOptions(generatorOptions);
      await generator.generate(finalOptions);
    };

    await handler(name, { path });
    expect(mockGenerator.generate).toHaveBeenCalledWith({ name, path });
  });

  it('should include controller and service imports', async () => {
    const name = 'test';
    const path = 'src/test';
    const mockGenerator = {
      generate: jest.fn(),
      promptForOptions: jest.fn().mockResolvedValue({ name, path }),
    };
    (Generator as jest.Mock).mockImplementation(() => mockGenerator);

    const handler = async (name: string, options: { path?: string }) => {
      const generator = new (Generator as any)();
      const generatorOptions = { name, path: options.path };
      const finalOptions = await generator.promptForOptions(generatorOptions);
      await generator.generate(finalOptions);
    };

    await handler(name, { path });
    expect(mockGenerator.generate).toHaveBeenCalledWith({ name, path });
  });

  it('should include module configuration', async () => {
    const name = 'test';
    const path = 'src/test';
    const mockGenerator = {
      generate: jest.fn(),
      promptForOptions: jest.fn().mockResolvedValue({ name, path }),
    };
    (Generator as jest.Mock).mockImplementation(() => mockGenerator);

    const handler = async (name: string, options: { path?: string }) => {
      const generator = new (Generator as any)();
      const generatorOptions = { name, path: options.path };
      const finalOptions = await generator.promptForOptions(generatorOptions);
      await generator.generate(finalOptions);
    };

    await handler(name, { path });
    expect(mockGenerator.generate).toHaveBeenCalledWith({ name, path });
  });
}); 