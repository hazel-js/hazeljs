import * as fs from 'fs';
import * as path from 'path';
import { AIEnhancedService } from '../ai-enhanced.service';
import { AIModule } from '../ai.module';
import { AgentTool } from '../tools/agent-tool.decorator';
import { runAiGolden } from './run-ai-golden';
import type { AiGoldenDataset } from './run-ai-golden';

class EchoTools {
  @AgentTool({ name: 'echo', description: 'Echo input' })
  echo(input: { text: string }): string {
    return input.text;
  }
}

describe('runAiGolden', () => {
  afterEach(() => {
    AIModule.register({});
  });

  it('runs fixture with expectedCalls and tool trajectory', async () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'budget-tool.golden.json');
    const dataset = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as AiGoldenDataset;

    const result = await runAiGolden({
      dataset,
      repliesForCase: (c) => {
        if (c.id === 'tool-loop') {
          return [
            {
              toolCalls: [{ name: 'echo', input: { text: 'hi' } }],
            },
            'done',
          ];
        }
        return ['hello there'];
      },
      caseRunner: async ({ input, fake, id }) => {
        const ai = new AIEnhancedService();
        ai.registerProvider(fake);
        if (id === 'tool-loop') {
          ai.registerTools(new EchoTools());
          const res = await ai.complete(
            { messages: [{ role: 'user', content: input }] },
            { provider: 'openai', tools: ['echo'], maxSteps: 3 }
          );
          return { output: res.content, toolCalls: ['echo'] };
        }
        const res = await ai.complete(
          { messages: [{ role: 'user', content: input }] },
          { provider: 'openai' }
        );
        return { output: res.content };
      },
      options: { minAverageScore: 0.5 },
    });

    expect(result.passed).toBe(true);
    expect(result.caseResults).toHaveLength(2);
  });

  it('fails when expectedCalls do not match', async () => {
    const result = await runAiGolden({
      dataset: {
        name: 'bad',
        version: '1',
        cases: [
          {
            id: '1',
            input: 'x',
            expectedOutput: 'y',
            metadata: {
              expectedCalls: [{ messageIncludes: 'NEVER' }],
            },
          },
        ],
      },
      repliesForCase: () => ['y'],
      caseRunner: async ({ input, fake }) => {
        const ai = new AIEnhancedService();
        ai.registerProvider(fake);
        const res = await ai.complete(
          { messages: [{ role: 'user', content: input }] },
          { provider: 'openai' }
        );
        return { output: res.content };
      },
      options: { minAverageScore: 0 },
    });
    expect(result.passed).toBe(false);
    expect(result.caseResults[0].error).toContain('expectedCalls mismatch');
  });
});
