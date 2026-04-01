import 'reflect-metadata';
import {
  AIValidate,
  AIValidateProperty,
  getAIValidationMetadata,
  hasAIValidationMetadata,
  getAIPropertyValidationMetadata,
} from './ai-validate.decorator';
import type { AIValidationOptions } from '../ai-enhanced.types';

// Mock logger
jest.mock('@hazeljs/core', () => ({
  debug: jest.fn(),
}));

describe('AI Validate Decorators', () => {
  describe('AIValidate', () => {
    it('should apply decorator with default options', () => {
      const options: AIValidationOptions = {
        provider: 'openai',
        instruction: 'Validate this email format',
      };

      @AIValidate(options)
      class TestClass {}

      const metadata = getAIValidationMetadata(TestClass);

      expect(metadata).toBeDefined();
      expect(metadata?.provider).toBe('openai');
      expect(metadata?.instruction).toBe('Validate this email format');
      expect(metadata?.model).toBe('gpt-3.5-turbo');
      expect(metadata?.failOnInvalid).toBe(true);
    });

    it('should merge custom options with defaults', () => {
      const options: AIValidationOptions = {
        provider: 'anthropic',
        instruction: 'Check if content is appropriate',
        model: 'claude-3',
        failOnInvalid: false,
      };

      @AIValidate(options)
      class TestClass {}

      const metadata = getAIValidationMetadata(TestClass);

      expect(metadata?.provider).toBe('anthropic');
      expect(metadata?.instruction).toBe('Check if content is appropriate');
      expect(metadata?.model).toBe('claude-3');
      expect(metadata?.failOnInvalid).toBe(false);
    });

    it('should work with anonymous classes', () => {
      const options: AIValidationOptions = {
        provider: 'openai',
        instruction: 'Test validation',
      };

      class AnonymousTest {
        constructor(public value: string) {}
      }
      AIValidate(options)(AnonymousTest);

      const metadata = getAIValidationMetadata(AnonymousTest);

      expect(metadata).toBeDefined();
      expect(metadata?.instruction).toBe('Test validation');
    });

    it('should handle classes without names', () => {
      const options: AIValidationOptions = {
        provider: 'openai',
        instruction: 'Test validation',
      };

      @AIValidate(options)
      class TestClass {}

      // Should not throw error even if class name is not available
      expect(getAIValidationMetadata(TestClass)).toBeDefined();
    });
  });

  describe('getAIValidationMetadata', () => {
    it('should return undefined for non-decorated classes', () => {
      class TestClass {}

      const metadata = getAIValidationMetadata(TestClass);

      expect(metadata).toBeUndefined();
    });

    it('should return metadata for decorated classes', () => {
      const options: AIValidationOptions = {
        provider: 'openai',
        instruction: 'Test validation',
      };

      @AIValidate(options)
      class TestClass {}

      const metadata = getAIValidationMetadata(TestClass);

      expect(metadata).toBeDefined();
      expect(metadata?.provider).toBe('openai');
    });

    it('should return the same metadata for multiple calls', () => {
      const options: AIValidationOptions = {
        provider: 'openai',
        instruction: 'Test validation',
      };

      @AIValidate(options)
      class TestClass {}

      const metadata1 = getAIValidationMetadata(TestClass);
      const metadata2 = getAIValidationMetadata(TestClass);

      expect(metadata1).toBe(metadata2);
    });
  });

  describe('hasAIValidationMetadata', () => {
    it('should return false for non-decorated classes', () => {
      class TestClass {}

      const hasMetadata = hasAIValidationMetadata(TestClass);

      expect(hasMetadata).toBe(false);
    });

    it('should return true for decorated classes', () => {
      const options: AIValidationOptions = {
        provider: 'openai',
        instruction: 'Test validation',
      };

      @AIValidate(options)
      class TestClass {}

      const hasMetadata = hasAIValidationMetadata(TestClass);

      expect(hasMetadata).toBe(true);
    });
  });

  describe('AIValidateProperty', () => {
    it('should apply decorator to property', () => {
      const options: AIValidationOptions = {
        provider: 'openai',
        instruction: 'Validate email format',
      };

      class TestClass {
        @AIValidateProperty(options)
        email: string = '';
      }

      const metadata = getAIPropertyValidationMetadata(new TestClass(), 'email');

      expect(metadata).toBeDefined();
      expect(metadata?.provider).toBe('openai');
      expect(metadata?.instruction).toBe('Validate email format');
      expect(metadata?.model).toBe('gpt-3.5-turbo');
      expect(metadata?.failOnInvalid).toBe(true);
    });

    it('should merge custom options with defaults', () => {
      const options: AIValidationOptions = {
        provider: 'anthropic',
        instruction: 'Check username appropriateness',
        model: 'claude-3',
        failOnInvalid: false,
      };

      class TestClass {
        @AIValidateProperty(options)
        username: string = '';
      }

      const metadata = getAIPropertyValidationMetadata(new TestClass(), 'username');

      expect(metadata?.provider).toBe('anthropic');
      expect(metadata?.instruction).toBe('Check username appropriateness');
      expect(metadata?.model).toBe('claude-3');
      expect(metadata?.failOnInvalid).toBe(false);
    });

    it('should work with symbol property keys', () => {
      const propertySymbol = Symbol('email');
      const options: AIValidationOptions = {
        provider: 'openai',
        instruction: 'Validate email',
      };

      class TestClass {
        @AIValidateProperty(options)
        [propertySymbol]: string = '';
      }

      const metadata = getAIPropertyValidationMetadata(new TestClass(), propertySymbol);

      expect(metadata).toBeDefined();
      expect(metadata?.instruction).toBe('Validate email');
    });

    it('should handle multiple properties with different validators', () => {
      const emailOptions: AIValidationOptions = {
        provider: 'openai',
        instruction: 'Validate email format',
      };

      const nameOptions: AIValidationOptions = {
        provider: 'anthropic',
        instruction: 'Validate name format',
      };

      class TestClass {
        @AIValidateProperty(emailOptions)
        email: string = '';

        @AIValidateProperty(nameOptions)
        name: string = '';
      }

      const instance = new TestClass();
      const emailMetadata = getAIPropertyValidationMetadata(instance, 'email');
      const nameMetadata = getAIPropertyValidationMetadata(instance, 'name');

      expect(emailMetadata?.provider).toBe('openai');
      expect(emailMetadata?.instruction).toBe('Validate email format');

      expect(nameMetadata?.provider).toBe('anthropic');
      expect(nameMetadata?.instruction).toBe('Validate name format');
    });
  });

  describe('getAIPropertyValidationMetadata', () => {
    it('should return undefined for non-decorated properties', () => {
      class TestClass {
        regularProperty: string = '';
      }

      const metadata = getAIPropertyValidationMetadata(new TestClass(), 'regularProperty');

      expect(metadata).toBeUndefined();
    });

    it('should return metadata for decorated properties', () => {
      const options: AIValidationOptions = {
        provider: 'openai',
        instruction: 'Test validation',
      };

      class TestClass {
        @AIValidateProperty(options)
        testProperty: string = '';
      }

      const metadata = getAIPropertyValidationMetadata(new TestClass(), 'testProperty');

      expect(metadata).toBeDefined();
      expect(metadata?.instruction).toBe('Test validation');
    });

    it('should return undefined for non-existent properties', () => {
      class TestClass {}

      const metadata = getAIPropertyValidationMetadata(new TestClass(), 'nonExistentProperty');

      expect(metadata).toBeUndefined();
    });

    it('should work with symbol property keys', () => {
      const propertySymbol = Symbol('testProperty');
      const options: AIValidationOptions = {
        provider: 'openai',
        instruction: 'Test validation',
      };

      class TestClass {
        @AIValidateProperty(options)
        [propertySymbol]: string = '';
      }

      const metadata = getAIPropertyValidationMetadata(new TestClass(), propertySymbol);

      expect(metadata).toBeDefined();
      expect(metadata?.instruction).toBe('Test validation');
    });
  });

  describe('Integration Tests', () => {
    it('should work together with class and property decorators', () => {
      const classOptions: AIValidationOptions = {
        provider: 'openai',
        instruction: 'General validation for user data',
      };

      const emailOptions: AIValidationOptions = {
        provider: 'anthropic',
        instruction: 'Validate email format specifically',
      };

      @AIValidate(classOptions)
      class UserClass {
        @AIValidateProperty(emailOptions)
        email: string = '';

        name: string = '';
      }

      const instance = new UserClass();

      // Check class-level metadata
      const classMetadata = getAIValidationMetadata(UserClass);
      expect(classMetadata?.provider).toBe('openai');
      expect(classMetadata?.instruction).toBe('General validation for user data');

      // Check property-level metadata
      const emailMetadata = getAIPropertyValidationMetadata(instance, 'email');
      expect(emailMetadata?.provider).toBe('anthropic');
      expect(emailMetadata?.instruction).toBe('Validate email format specifically');

      // Check non-decorated property
      const nameMetadata = getAIPropertyValidationMetadata(instance, 'name');
      expect(nameMetadata).toBeUndefined();

      // Check has metadata
      expect(hasAIValidationMetadata(UserClass)).toBe(true);
    });

    it('should handle inheritance correctly', () => {
      const baseOptions: AIValidationOptions = {
        provider: 'openai',
        instruction: 'Base validation',
      };

      const derivedOptions: AIValidationOptions = {
        provider: 'anthropic',
        instruction: 'Derived validation',
      };

      @AIValidate(baseOptions)
      class BaseClass {
        @AIValidateProperty({ provider: 'openai', instruction: 'Base property validation' })
        baseProperty: string = '';
      }

      @AIValidate(derivedOptions)
      class DerivedClass extends BaseClass {
        @AIValidateProperty({ provider: 'anthropic', instruction: 'Derived property validation' })
        derivedProperty: string = '';
      }

      const baseInstance = new BaseClass();
      const derivedInstance = new DerivedClass();

      // Base class metadata
      const baseClassMetadata = getAIValidationMetadata(BaseClass);
      expect(baseClassMetadata?.instruction).toBe('Base validation');

      const basePropertyMetadata = getAIPropertyValidationMetadata(baseInstance, 'baseProperty');
      expect(basePropertyMetadata?.provider).toBe('openai');

      // Derived class metadata
      const derivedClassMetadata = getAIValidationMetadata(DerivedClass);
      expect(derivedClassMetadata?.instruction).toBe('Derived validation');

      const derivedPropertyMetadata = getAIPropertyValidationMetadata(
        derivedInstance,
        'derivedProperty'
      );
      expect(derivedPropertyMetadata?.provider).toBe('anthropic');

      // Inherited property on derived instance
      const inheritedPropertyMetadata = getAIPropertyValidationMetadata(
        derivedInstance,
        'baseProperty'
      );
      expect(inheritedPropertyMetadata?.provider).toBe('openai');
    });

    it('should handle multiple inheritance levels', () => {
      @AIValidate({ provider: 'openai', instruction: 'Grandparent validation' })
      class GrandParentClass {
        @AIValidateProperty({ provider: 'openai', instruction: 'Grandparent property' })
        grandParentProperty: string = '';
      }

      @AIValidate({ provider: 'anthropic', instruction: 'Parent validation' })
      class ParentClass extends GrandParentClass {
        @AIValidateProperty({ provider: 'anthropic', instruction: 'Parent property' })
        parentProperty: string = '';
      }

      @AIValidate({ provider: 'gemini', instruction: 'Child validation' })
      class ChildClass extends ParentClass {
        @AIValidateProperty({ provider: 'gemini', instruction: 'Child property' })
        childProperty: string = '';
      }

      const childInstance = new ChildClass();

      // Each class should have its own validation metadata
      expect(getAIValidationMetadata(GrandParentClass)?.instruction).toBe('Grandparent validation');
      expect(getAIValidationMetadata(ParentClass)?.instruction).toBe('Parent validation');
      expect(getAIValidationMetadata(ChildClass)?.instruction).toBe('Child validation');

      // Each property should have its own validation metadata
      expect(getAIPropertyValidationMetadata(childInstance, 'grandParentProperty')?.provider).toBe(
        'openai'
      );
      expect(getAIPropertyValidationMetadata(childInstance, 'parentProperty')?.provider).toBe(
        'anthropic'
      );
      expect(getAIPropertyValidationMetadata(childInstance, 'childProperty')?.provider).toBe(
        'gemini'
      );
    });
  });
});
