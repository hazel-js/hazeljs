import fs from 'fs';
import path from 'path';
import { Generator, toPascalCase, toKebabCase, toCamelCase, renderTemplate } from './generator';
import inquirer from 'inquirer';

jest.mock('fs');
jest.mock('inquirer');

describe('Generator utilities', () => {
  describe('toPascalCase', () => {
    it('should convert kebab-case', () => {
      expect(toPascalCase('test-name')).toBe('TestName');
    });

    it('should convert snake_case', () => {
      expect(toPascalCase('test_name')).toBe('TestName');
    });

    it('should handle single word', () => {
      expect(toPascalCase('test')).toBe('Test');
    });
  });

  describe('toKebabCase', () => {
    it('should convert camelCase', () => {
      expect(toKebabCase('testName')).toBe('test-name');
    });

    it('should convert PascalCase', () => {
      expect(toKebabCase('TestName')).toBe('test-name');
    });

    it('should convert snake_case', () => {
      expect(toKebabCase('test_name')).toBe('test-name');
    });

    it('should handle single word', () => {
      expect(toKebabCase('test')).toBe('test');
    });
  });

  describe('toCamelCase', () => {
    it('should convert kebab-case', () => {
      expect(toCamelCase('test-name')).toBe('testName');
    });

    it('should convert snake_case', () => {
      expect(toCamelCase('test_name')).toBe('testName');
    });

    it('should handle single word', () => {
      expect(toCamelCase('test')).toBe('test');
    });
  });

  describe('renderTemplate', () => {
    it('should replace mustache variables', () => {
      const result = renderTemplate('Hello {{name}}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should handle multiple variables', () => {
      const result = renderTemplate('{{className}} at {{fileName}}', {
        className: 'Test',
        fileName: 'test',
      });
      expect(result).toBe('Test at test');
    });
  });
});

describe('Generator class', () => {
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

    it('should include className and fileName in template data', async () => {
      await generator.generate({
        name: 'my-widget',
        path: 'src',
        template: '{{className}} {{fileName}} {{camelName}}',
      });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        'MyWidget my-widget myWidget',
      );
    });

    it('should not write files in dry-run mode', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await generator.generate({
        name: 'test',
        template: 'content',
        dryRun: true,
      });

      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[dry-run]'));
      consoleSpy.mockRestore();
    });
  });

  describe('promptForOptions', () => {
    it('should prompt for missing options', async () => {
      mockInquirer.prompt.mockResolvedValue({
        name: 'test',
        path: 'src/test',
      });

      const result = await generator.promptForOptions({});

      expect(mockInquirer.prompt).toHaveBeenCalled();
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

      expect(result).toEqual({
        name: 'test',
        path: 'src/test',
      });
    });
  });
});
