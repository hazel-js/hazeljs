import { PromptRegistry } from '../registry';
import { PromptTemplate } from '../template';
import { resolvePromptForExperiment } from '../prompt-feature-toggle';

beforeEach(() => {
  PromptRegistry.clear();
  PromptRegistry.configure([]);
});

afterAll(() => {
  PromptRegistry.clear();
  PromptRegistry.configure([]);
});

describe('resolvePromptForExperiment', () => {
  it('returns variant when isEnabled returns true', async () => {
    const control = new PromptTemplate('control', { name: 'C', version: '1.0.0' });
    const variant = new PromptTemplate('variant', { name: 'V', version: '1.0.0' });
    PromptRegistry.register('exp:control', control);
    PromptRegistry.register('exp:variant', variant);

    const result = await resolvePromptForExperiment({
      flagKey: 'flag-a',
      controlKey: 'exp:control',
      variantKey: 'exp:variant',
      isEnabled: () => true,
    });

    expect(result.template).toBe('variant');
  });

  it('returns control when isEnabled returns false', async () => {
    const control = new PromptTemplate('control', { name: 'C', version: '1.0.0' });
    const variant = new PromptTemplate('variant', { name: 'V', version: '1.0.0' });
    PromptRegistry.register('exp2:control', control);
    PromptRegistry.register('exp2:variant', variant);

    const result = await resolvePromptForExperiment({
      flagKey: 'flag-b',
      controlKey: 'exp2:control',
      variantKey: 'exp2:variant',
      isEnabled: () => false,
    });

    expect(result.template).toBe('control');
  });

  it('awaits async isEnabled', async () => {
    PromptRegistry.register('exp3:c', new PromptTemplate('c', { name: 'C', version: '1.0.0' }));
    PromptRegistry.register('exp3:v', new PromptTemplate('v', { name: 'V', version: '1.0.0' }));

    const result = await resolvePromptForExperiment({
      flagKey: 'x',
      controlKey: 'exp3:c',
      variantKey: 'exp3:v',
      isEnabled: async (key) => key === 'x',
    });

    expect(result.template).toBe('v');
  });
});
