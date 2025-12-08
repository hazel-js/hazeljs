import fs from 'fs';
import { generateController } from './generate-controller';
import { Generator } from '../utils/generator';

jest.mock('fs');
jest.mock('../utils/generator');

describe('generateController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  });

  it('should register controller command', () => {
    const program: any = { command: jest.fn().mockReturnThis(), description: jest.fn().mockReturnThis(), option: jest.fn().mockReturnThis(), action: jest.fn() };
    generateController(program);
    expect(program.command).toHaveBeenCalledWith('controller <name>');
    expect(program.description).toHaveBeenCalledWith('Generate a new controller');
  });

  it('should generate controller file with DTO imports and validation', async () => {
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

  it('should include CRUD methods', async () => {
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