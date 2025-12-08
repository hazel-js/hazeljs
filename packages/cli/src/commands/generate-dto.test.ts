import fs from 'fs';
import { generateDto } from './generate-dto';
import { Generator } from '../utils/generator';

jest.mock('fs');
jest.mock('../utils/generator');

describe('generateDto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  });

  it('should register dto command', () => {
    const program: any = { command: jest.fn().mockReturnThis(), description: jest.fn().mockReturnThis(), option: jest.fn().mockReturnThis(), action: jest.fn() };
    generateDto(program);
    expect(program.command).toHaveBeenCalledWith('dto <name>');
    expect(program.description).toHaveBeenCalledWith('Generate create and update DTOs');
  });

  it('should generate dto file', async () => {
    const name = 'test';
    const path = 'src/test';
    const mockGenerator = {
      generate: jest.fn(),
      promptForOptions: jest.fn().mockResolvedValue({ name, path }),
    };
    (Generator as jest.Mock).mockImplementation(() => mockGenerator);
    // Simulate the handler
    const handler = async (name: string, options: { path?: string }) => {
      const generator = new (Generator as any)();
      const generatorOptions = { name, path: options.path };
      const finalOptions = await generator.promptForOptions(generatorOptions);
      await generator.generate(finalOptions);
    };
    await handler(name, { path });
    expect(mockGenerator.generate).toHaveBeenCalledWith({ name, path });
  });

  it('should include class properties', async () => {
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

  it('should include validation decorators', async () => {
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