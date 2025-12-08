import fs from 'fs';
import path from 'path';
import { Generator } from './generator';
import inquirer from 'inquirer';

jest.mock('fs');
jest.mock('inquirer');

describe('Generator', () => {
  let generator: Generator;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockInquirer = inquirer as jest.Mocked<typeof inquirer>;

  beforeEach(() => {
    generator = new Generator();
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockImplementation(() => {});
  });

  describe('generate', () => {
    it('should create directory if it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.writeFileSync.mockImplementation(() => {});

      await generator.generate({
        name: 'test',
        path: 'src/test',
        template: 'test template',
      });

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'src/test'),
        { recursive: true }
      );
    });

    it('should write file with rendered template', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      await generator.generate({
        name: 'test',
        path: 'src/test',
        template: 'Hello {{name}}!',
        data: { name: 'World' },
      });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test.ts'),
        'Hello World!',
      );
    });

    it('should generate file with correct name and content', async () => {
      const options = {
        name: 'test',
        path: 'src/test',
        template: '{{className}}'
      };

      await generator.generate(options);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test.ts'),
        'Test'
      );
    });
  });

  describe('promptForOptions', () => {
    it('should prompt for missing options', async () => {
      mockInquirer.prompt.mockResolvedValue({
        name: 'test',
        path: 'src/test',
      });

      const result = await generator.promptForOptions({});

      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        {
          name: 'name',
          message: 'What is the name of the component?',
          type: 'input',
          when: true
        },
        {
          name: 'path',
          message: 'Where should the component be generated?',
          type: 'input',
          default: 'src',
          when: true
        },
      ]);

      expect(result).toEqual({
        name: 'test',
        path: 'src/test',
      });
    });

    it('should not prompt for provided options', async () => {
      mockInquirer.prompt.mockResolvedValue({});

      const result = await generator.promptForOptions({
        name: 'test',
        path: 'src/test',
      });

      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        {
          name: 'name',
          message: 'What is the name of the component?',
          type: 'input',
          when: false
        },
        {
          name: 'path',
          message: 'Where should the component be generated?',
          type: 'input',
          default: 'src',
          when: false
        },
      ]);

      expect(result).toEqual({
        name: 'test',
        path: 'src/test',
      });
    });
  });

  describe('name transformations', () => {
    it('should convert to PascalCase', () => {
      expect(generator['toPascalCase']('test-name')).toBe('TestName');
      expect(generator['toPascalCase']('test_name')).toBe('TestName');
      expect(generator['toPascalCase']('testName')).toBe('Testname');
      expect(generator['toPascalCase']('test')).toBe('Test');
    });

    it('should convert to kebab-case', () => {
      expect(generator['toKebabCase']('testName')).toBe('test-name');
      expect(generator['toKebabCase']('TestName')).toBe('test-name');
      expect(generator['toKebabCase']('test_name')).toBe('test-name');
      expect(generator['toKebabCase']('test')).toBe('test');
    });
  });
}); 