import { prepareTrainingData } from './prepare-training-data';

describe('prepareTrainingData', () => {
  it('passes through samples without schema/quality', async () => {
    const result = await prepareTrainingData({
      samples: [{ text: 'hi', label: 'a' }],
    });
    expect(result.data.samples).toEqual([{ text: 'hi', label: 'a' }]);
  });

  it('validates with schema', async () => {
    const schema = {
      validate: (value: unknown) => {
        const v = value as { text?: string };
        if (!v.text) {
          return { success: false as const, errors: [{ path: 'text', message: 'required' }] };
        }
        return { success: true as const, data: value };
      },
    };
    await expect(prepareTrainingData({ samples: [{ label: 'a' }] }, { schema })).rejects.toThrow(
      'schema validation failed'
    );

    const ok = await prepareTrainingData({ samples: [{ text: 'x', label: 'a' }] }, { schema });
    expect(ok.validatedSamples).toHaveLength(1);
  });

  it('runs quality checks when provided', async () => {
    const qualityService = {
      runChecks: async () => ({ passed: false, score: 40, checks: [] }),
      profile: () => ({ totalRows: 1 }),
    };
    await expect(
      prepareTrainingData({ samples: [{ a: 1 }] }, { qualityService, failOnQuality: true })
    ).rejects.toThrow('quality checks failed');
  });
});
