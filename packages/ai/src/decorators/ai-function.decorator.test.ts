import {
  AIFunction,
  AIPrompt,
  getAIFunctionMetadata,
  hasAIFunctionMetadata,
  getAIPromptMetadata,
} from './ai-function.decorator';
import type { AIFunctionOptions } from '../ai-enhanced.types';

// Mock logger
jest.mock('@hazeljs/core', () => ({
  debug: jest.fn(),
}));

describe('AI Function Decorators', () => {
  describe('AIFunction', () => {
    it('should apply decorator with default options', () => {
      const options: AIFunctionOptions = {
        provider: 'openai',
        model: 'gpt-4',
      };

      class TestClass {
        @AIFunction(options)
        async testMethod() {}
      }

      const instance = new TestClass();
      const metadata = getAIFunctionMetadata(instance, 'testMethod');

      expect(metadata).toBeDefined();
      expect(metadata?.provider).toBe('openai');
      expect(metadata?.model).toBe('gpt-4');
      expect(metadata?.streaming).toBe(false);
      expect(metadata?.temperature).toBe(0.7);
      expect(metadata?.maxTokens).toBe(1000);
    });

    it('should merge custom options with defaults', () => {
      const options: AIFunctionOptions = {
        provider: 'anthropic',
        model: 'claude-3',
        streaming: true,
        temperature: 0.5,
        maxTokens: 2000,
      };

      class TestClass {
        @AIFunction(options)
        async testMethod() {}
      }

      const instance = new TestClass();
      const metadata = getAIFunctionMetadata(instance, 'testMethod');

      expect(metadata?.provider).toBe('anthropic');
      expect(metadata?.model).toBe('claude-3');
      expect(metadata?.streaming).toBe(true);
      expect(metadata?.temperature).toBe(0.5);
      expect(metadata?.maxTokens).toBe(2000);
    });

    it('should work with symbol property keys', () => {
      const methodSymbol = Symbol('testMethod');

      class TestClass {
        @AIFunction({ provider: 'openai' })
        async [methodSymbol]() {}
      }

      const instance = new TestClass();
      const metadata = getAIFunctionMetadata(instance, methodSymbol);

      expect(metadata).toBeDefined();
      expect(metadata?.provider).toBe('openai');
    });

    it('should return the original descriptor', () => {
      const originalDescriptor = {
        value: async function () {},
        writable: true,
        enumerable: true,
        configurable: true,
      };

      const decorator = AIFunction({ provider: 'openai' });
      const result = decorator({}, 'testMethod', originalDescriptor);

      expect(result).toBe(originalDescriptor);
    });
  });

  describe('getAIFunctionMetadata', () => {
    it('should return undefined for non-decorated methods', () => {
      class TestClass {
        async regularMethod() {}
      }

      const instance = new TestClass();
      const metadata = getAIFunctionMetadata(instance, 'regularMethod');

      expect(metadata).toBeUndefined();
    });

    it('should return metadata for decorated methods', () => {
      class TestClass {
        @AIFunction({ provider: 'openai' })
        async decoratedMethod() {}
      }

      const instance = new TestClass();
      const metadata = getAIFunctionMetadata(instance, 'decoratedMethod');

      expect(metadata).toBeDefined();
      expect(metadata?.provider).toBe('openai');
    });

    it('should handle different instances separately', () => {
      class TestClass {
        @AIFunction({ provider: 'openai' })
        async method() {}
      }

      const instance1 = new TestClass();
      const instance2 = new TestClass();

      const metadata1 = getAIFunctionMetadata(instance1, 'method');
      const metadata2 = getAIFunctionMetadata(instance2, 'method');

      expect(metadata1).toEqual(metadata2);
    });
  });

  describe('hasAIFunctionMetadata', () => {
    it('should return false for non-decorated methods', () => {
      class TestClass {
        async regularMethod() {}
      }

      const instance = new TestClass();
      const hasMetadata = hasAIFunctionMetadata(instance, 'regularMethod');

      expect(hasMetadata).toBe(false);
    });

    it('should return true for decorated methods', () => {
      class TestClass {
        @AIFunction({ provider: 'openai' })
        async decoratedMethod() {}
      }

      const instance = new TestClass();
      const hasMetadata = hasAIFunctionMetadata(instance, 'decoratedMethod');

      expect(hasMetadata).toBe(true);
    });

    it('should work with symbol property keys', () => {
      const methodSymbol = Symbol('testMethod');

      class TestClass {
        @AIFunction({ provider: 'openai' })
        async [methodSymbol]() {}
      }

      const instance = new TestClass();
      const hasMetadata = hasAIFunctionMetadata(instance, methodSymbol);

      expect(hasMetadata).toBe(true);
    });
  });

  describe('AIPrompt', () => {
    it('should mark parameter as prompt', () => {
      class TestClass {
        @AIFunction({ provider: 'openai' })
        async testMethod(@AIPrompt() _prompt: string, _otherParam: string) {}
      }

      const instance = new TestClass();
      const promptIndices = getAIPromptMetadata(instance, 'testMethod');

      expect(promptIndices).toEqual([0]);
    });

    it('should mark multiple parameters as prompt', () => {
      class TestClass {
        @AIFunction({ provider: 'openai' })
        async testMethod(
          @AIPrompt() _prompt1: string,
          _regularParam: string,
          @AIPrompt() _prompt2: string
        ) {}
      }

      const instance = new TestClass();
      const promptIndices = getAIPromptMetadata(instance, 'testMethod');

      expect(promptIndices).toEqual([0, 2]);
    });

    it('should handle no prompt parameters', () => {
      class TestClass {
        @AIFunction({ provider: 'openai' })
        async testMethod(_param1: string, _param2: string) {}
      }

      const instance = new TestClass();
      const promptIndices = getAIPromptMetadata(instance, 'testMethod');

      expect(promptIndices).toEqual([]);
    });

    it('should work with symbol property keys', () => {
      const methodSymbol = Symbol('testMethod');

      class TestClass {
        @AIFunction({ provider: 'openai' })
        async [methodSymbol](@AIPrompt() _prompt: string) {}
      }

      const instance = new TestClass();
      const promptIndices = getAIPromptMetadata(instance, methodSymbol);

      expect(promptIndices).toEqual([0]);
    });

    it('should accumulate prompt parameters across multiple decorators', () => {
      class TestClass {
        @AIFunction({ provider: 'openai' })
        async testMethod(
          @AIPrompt() _prompt1: string,
          @AIPrompt() _prompt2: string,
          _regularParam: string
        ) {}
      }

      const instance = new TestClass();
      const promptIndices = getAIPromptMetadata(instance, 'testMethod');

      expect(promptIndices).toEqual([0, 1]);
    });
  });

  describe('getAIPromptMetadata', () => {
    it('should return empty array for non-decorated methods', () => {
      class TestClass {
        async regularMethod(_param: string) {}
      }

      const instance = new TestClass();
      const promptIndices = getAIPromptMetadata(instance, 'regularMethod');

      expect(promptIndices).toEqual([]);
    });

    it('should return correct indices for decorated parameters', () => {
      class TestClass {
        @AIFunction({ provider: 'openai' })
        async testMethod(
          _regular1: string,
          @AIPrompt() _prompt1: string,
          _regular2: string,
          @AIPrompt() _prompt2: string,
          _regular3: string
        ) {}
      }

      const instance = new TestClass();
      const promptIndices = getAIPromptMetadata(instance, 'testMethod');

      expect(promptIndices).toEqual([1, 3]);
    });

    it('should handle non-existent methods', () => {
      class TestClass {}

      const instance = new TestClass();
      const promptIndices = getAIPromptMetadata(instance, 'nonExistentMethod');

      expect(promptIndices).toEqual([]);
    });
  });

  describe('Integration Tests', () => {
    it('should work together with multiple decorators', () => {
      class TestClass {
        @AIFunction({
          provider: 'anthropic',
          model: 'claude-3',
          streaming: true,
        })
        async complexMethod(
          @AIPrompt() _systemPrompt: string,
          _context: string,
          @AIPrompt() _userPrompt: string,
          _options?: { temperature: number }
        ) {}
      }

      const instance = new TestClass();

      // Check AI function metadata
      const functionMetadata = getAIFunctionMetadata(instance, 'complexMethod');
      expect(functionMetadata?.provider).toBe('anthropic');
      expect(functionMetadata?.model).toBe('claude-3');
      expect(functionMetadata?.streaming).toBe(true);

      // Check prompt metadata
      const promptIndices = getAIPromptMetadata(instance, 'complexMethod');
      expect(promptIndices).toEqual([0, 2]);

      // Check has metadata
      expect(hasAIFunctionMetadata(instance, 'complexMethod')).toBe(true);
    });

    it('should handle inheritance correctly', () => {
      class BaseClass {
        @AIFunction({ provider: 'openai' })
        async baseMethod(@AIPrompt() _prompt: string) {}
      }

      class DerivedClass extends BaseClass {
        @AIFunction({ provider: 'anthropic' })
        async derivedMethod(@AIPrompt() _prompt: string) {}
      }

      const baseInstance = new BaseClass();
      const derivedInstance = new DerivedClass();

      // Base class method
      const baseMetadata = getAIFunctionMetadata(baseInstance, 'baseMethod');
      expect(baseMetadata?.provider).toBe('openai');

      const basePromptIndices = getAIPromptMetadata(baseInstance, 'baseMethod');
      expect(basePromptIndices).toEqual([0]);

      // Derived class method
      const derivedMetadata = getAIFunctionMetadata(derivedInstance, 'derivedMethod');
      expect(derivedMetadata?.provider).toBe('anthropic');

      const derivedPromptIndices = getAIPromptMetadata(derivedInstance, 'derivedMethod');
      expect(derivedPromptIndices).toEqual([0]);

      // Inherited method on derived instance
      const inheritedMetadata = getAIFunctionMetadata(derivedInstance, 'baseMethod');
      expect(inheritedMetadata?.provider).toBe('openai');
    });
  });
});
