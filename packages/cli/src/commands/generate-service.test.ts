import fs from 'fs';
import { generateService } from './generate-service';
import { Generator } from '../utils/generator';

jest.mock('fs');
jest.mock('../utils/generator');

describe('generateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  });

  it('should register service command', () => {
    const program: any = { command: jest.fn().mockReturnThis(), description: jest.fn().mockReturnThis(), option: jest.fn().mockReturnThis(), action: jest.fn() };
    generateService(program);
    expect(program.command).toHaveBeenCalledWith('service <name>');
    expect(program.description).toHaveBeenCalledWith('Generate a new service');
  });

  it('should generate service file', async () => {
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

  it('should include proper return types', async () => {
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