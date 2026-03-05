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
      const tpl = new PromptTemplate<{ a: string; b: string }>(
        'Line 1: {a}\nLine 2: {b}\nDone.',
        { name: 'ML' }
      );
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
});
