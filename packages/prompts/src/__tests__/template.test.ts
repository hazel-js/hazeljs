import { PromptTemplate } from '../template';

describe('PromptTemplate', () => {
  describe('constructor', () => {
    it('stores template string and metadata', () => {
      const tpl = new PromptTemplate('Hello {name}', { name: 'Test', version: '1.0.0' });
      expect(tpl.template).toBe('Hello {name}');
      expect(tpl.metadata.name).toBe('Test');
      expect(tpl.metadata.version).toBe('1.0.0');
    });
  });

  describe('render()', () => {
    it('substitutes a single variable', () => {
      const tpl = new PromptTemplate<{ name: string }>('Hello {name}!', { name: 'Test' });
      expect(tpl.render({ name: 'World' })).toBe('Hello World!');
    });

    it('substitutes multiple variables', () => {
      const tpl = new PromptTemplate<{ query: string; context: string }>(
        'Context: {context}\nQuestion: {query}',
        { name: 'QA' }
      );
      const rendered = tpl.render({ query: 'What?', context: 'Some context' });
      expect(rendered).toBe('Context: Some context\nQuestion: What?');
    });

    it('leaves unrecognised placeholders intact', () => {
      const tpl = new PromptTemplate<Record<string, unknown>>('Hello {name} from {place}', {
        name: 'Test',
      });
      expect(tpl.render({ name: 'Alice' })).toBe('Hello Alice from {place}');
    });

    it('converts non-string values to string', () => {
      const tpl = new PromptTemplate<{ count: number }>('Count: {count}', { name: 'Counter' });
      expect(tpl.render({ count: 42 })).toBe('Count: 42');
    });

    it('handles empty template', () => {
      const tpl = new PromptTemplate<Record<string, unknown>>('', { name: 'Empty' });
      expect(tpl.render({})).toBe('');
    });

    it('handles template with no placeholders', () => {
      const tpl = new PromptTemplate<Record<string, unknown>>('Static text only.', {
        name: 'Static',
      });
      expect(tpl.render({})).toBe('Static text only.');
    });

    it('substitutes the same placeholder multiple times', () => {
      const tpl = new PromptTemplate<{ word: string }>('{word} and {word} again', { name: 'Rep' });
      expect(tpl.render({ word: 'yes' })).toBe('yes and yes again');
    });

    it('handles multiline templates', () => {
      const tpl = new PromptTemplate<{ a: string; b: string }>('Line 1: {a}\nLine 2: {b}\nDone.', {
        name: 'ML',
      });
      const result = tpl.render({ a: 'foo', b: 'bar' });
      expect(result).toBe('Line 1: foo\nLine 2: bar\nDone.');
    });

    it('handles undefined values by leaving placeholder', () => {
      const tpl = new PromptTemplate<{ defined: string; optional?: string }>(
        '{defined} {optional}',
        { name: 'Partial' }
      );
      expect(tpl.render({ defined: 'hello' })).toBe('hello {optional}');
    });
  });

  describe('strict mode', () => {
    it('should throw error when variable is missing in strict mode', () => {
      const tpl = new PromptTemplate<{ name: string }>('Hello {name}!', { name: 'Test' });

      expect(() => {
        tpl.render({} as any, { strict: true });
      }).toThrow('Missing required template variable');
    });

    it('should not throw in non-strict mode', () => {
      const tpl = new PromptTemplate<{ name: string }>('Hello {name}!', { name: 'Test' });

      expect(tpl.render({} as any, { strict: false })).toBe('Hello {name}!');
    });

    it('should allow undefined in non-strict mode by default', () => {
      const tpl = new PromptTemplate<{ name: string }>('Hello {name}!', { name: 'Test' });

      expect(tpl.render({} as any)).toBe('Hello {name}!');
    });
  });

  describe('conditionals {#if}', () => {
    it('should render content when condition is true', () => {
      const tpl = new PromptTemplate<{ show: boolean }>('{#if show}Visible{/if}', {
        name: 'Conditional',
      });

      expect(tpl.render({ show: true })).toBe('Visible');
    });

    it('should not render content when condition is false', () => {
      const tpl = new PromptTemplate<{ show: boolean }>('{#if show}Hidden{/if}', {
        name: 'Conditional',
      });

      expect(tpl.render({ show: false })).toBe('');
    });

    it('should handle nested variables in conditional blocks', () => {
      const tpl = new PromptTemplate<{ show: boolean; name: string }>(
        '{#if show}Hello {name}!{/if}',
        { name: 'Conditional' }
      );

      expect(tpl.render({ show: true, name: 'World' })).toBe('Hello World!');
    });

    it('should handle multiple conditionals', () => {
      const tpl = new PromptTemplate<{ a: boolean; b: boolean }>('{#if a}A{/if}{#if b}B{/if}', {
        name: 'Multi',
      });

      expect(tpl.render({ a: true, b: false })).toBe('A');
      expect(tpl.render({ a: false, b: true })).toBe('B');
      expect(tpl.render({ a: true, b: true })).toBe('AB');
    });
  });

  describe('loops {#each}', () => {
    it('should iterate over array', () => {
      const tpl = new PromptTemplate<{ items: string[] }>('{#each items}{.}{/each}', {
        name: 'Loop',
      });

      expect(tpl.render({ items: ['a', 'b', 'c'] })).toBe('abc');
    });

    it('should handle empty arrays', () => {
      const tpl = new PromptTemplate<{ items: string[] }>('{#each items}{.}{/each}', {
        name: 'Loop',
      });

      expect(tpl.render({ items: [] })).toBe('');
    });

    it('should provide index in loops', () => {
      const tpl = new PromptTemplate<{ items: string[] }>('{#each items}{@index}:{.} {/each}', {
        name: 'Loop',
      });

      expect(tpl.render({ items: ['a', 'b'] })).toBe('0:a 1:b ');
    });

    it('should handle arrays with numbers', () => {
      const tpl = new PromptTemplate<{ nums: number[] }>('{#each nums}{.},{/each}', {
        name: 'Loop',
      });

      expect(tpl.render({ nums: [1, 2, 3] })).toBe('1,2,3,');
    });
  });

  describe('partials {@include}', () => {
    it('should include partial templates', () => {
      const partial = new PromptTemplate<{ name: string }>('Hello {name}!', { name: 'Greeting' });
      const main = new PromptTemplate<{ name: string }>('Start {@include greeting} End', {
        name: 'Main',
      });

      const includeResolver = (key: string) => {
        if (key === 'greeting') return partial.render({ name: 'World' });
        return undefined;
      };

      const result = main.render({ name: 'World' }, { includeResolver });
      expect(result).toBe('Start Hello World! End');
    });

    it('should handle missing partials gracefully', () => {
      const tpl = new PromptTemplate<Record<string, unknown>>('{@include missing}', {
        name: 'Main',
      });

      expect(tpl.render({})).toBe('{@include missing}');
    });

    it('should pass variables to partials', () => {
      const partial = new PromptTemplate<{ value: number }>('Value: {value}', { name: 'Partial' });
      const main = new PromptTemplate<{ value: number }>('{@include part}', { name: 'Main' });

      const includeResolver = (key: string) => {
        if (key === 'part') return partial.render({ value: 42 });
        return undefined;
      };

      const result = main.render({ value: 42 }, { includeResolver });
      expect(result).toBe('Value: 42');
    });
  });

  describe('preview()', () => {
    it('should generate preview with sample data and token estimate', () => {
      const tpl = new PromptTemplate<{ name: string; age: number }>('Name: {name}, Age: {age}', {
        name: 'Profile',
      });

      const preview = tpl.preview({ name: 'Alice', age: 30 });
      expect(preview).toContain('Name: Alice, Age: 30');
      expect(preview).toContain('Preview:');
      expect(preview).toContain('tokens');
    });

    it('should work with conditionals in preview', () => {
      const tpl = new PromptTemplate<{ show: boolean; msg: string }>('{#if show}{msg}{/if}', {
        name: 'Test',
      });

      const preview = tpl.preview({ show: true, msg: 'Hello' });
      expect(preview).toContain('Hello');
      expect(preview).toContain('Preview:');
    });

    it('should work with loops in preview', () => {
      const tpl = new PromptTemplate<{ items: number[] }>('{#each items}{.} {/each}', {
        name: 'Test',
      });

      const preview = tpl.preview({ items: [1, 2, 3] });
      expect(preview).toContain('1 2 3');
      expect(preview).toContain('Preview:');
    });
  });

  describe('variables()', () => {
    it('should extract simple variables', () => {
      const tpl = new PromptTemplate<{ name: string; age: number }>(
        'Hello {name}, you are {age} years old',
        { name: 'Test' }
      );

      const vars = tpl.variables();
      expect(vars).toContain('name');
      expect(vars).toContain('age');
      expect(vars.length).toBe(2);
    });

    it('should extract variables from conditionals', () => {
      const tpl = new PromptTemplate<{ show: boolean; msg: string }>('{#if show}{msg}{/if}', {
        name: 'Test',
      });

      const vars = tpl.variables();
      expect(vars).toContain('show');
      expect(vars).toContain('msg');
    });

    it('should extract variables from loops', () => {
      const tpl = new PromptTemplate<{ items: string[] }>('{#each items}{item}{/each}', {
        name: 'Test',
      });

      const vars = tpl.variables();
      expect(vars).toContain('items');
    });

    it('should deduplicate variables', () => {
      const tpl = new PromptTemplate<{ name: string }>('{name} and {name} again', { name: 'Test' });

      const vars = tpl.variables();
      expect(vars).toEqual(['name']);
    });

    it('should handle templates with no variables', () => {
      const tpl = new PromptTemplate<Record<string, unknown>>('Static text only', { name: 'Test' });

      const vars = tpl.variables();
      expect(vars).toEqual([]);
    });
  });

  describe('complex scenarios', () => {
    it('should handle nested conditionals and loops', () => {
      const tpl = new PromptTemplate<{ show: boolean; items: string[] }>(
        '{#if show}{#each items}- {.}\n{/each}{/if}',
        { name: 'Complex' }
      );

      expect(tpl.render({ show: true, items: ['a', 'b'] })).toBe('- a\n- b\n');
      expect(tpl.render({ show: false, items: ['a', 'b'] })).toBe('');
    });

    it('should combine all features', () => {
      const partial = new PromptTemplate<{ value: string }>('[{value}]', { name: 'Bracket' });
      const tpl = new PromptTemplate<{ show: boolean; items: string[] }>(
        '{#if show}{#each items}{@include bracket} {/each}{/if}',
        { name: 'All' }
      );

      const includeResolver = (key: string) => {
        if (key === 'bracket') return partial.render({ value: 'x' });
        return undefined;
      };

      const result = tpl.render({ show: true, items: ['a', 'b'] }, { includeResolver });
      expect(result).toContain('[');
    });
  });
});
