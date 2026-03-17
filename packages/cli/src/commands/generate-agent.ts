import { Command } from 'commander';
import { Generator, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

const AGENT_TEMPLATE = `import { Agent, Tool } from '@hazeljs/agent';

@Agent({
  name: '{{fileName}}',
  description: '{{description}}',
  systemPrompt: 'You are a helpful {{className}} agent.',
  enableMemory: true,
  enableRAG: true,
})
export class {{className}}Agent {
  @Tool({
    description: 'Example tool for {{fileName}}',
    parameters: [
      {
        name: 'input',
        type: 'string',
        description: 'Input parameter',
        required: true,
      },
    ],
  })
  async exampleTool(input: { input: string }): Promise<{ result: string }> {
    // Implement your tool logic here
    return {
      result: \`Processed: \${input.input}\`,
    };
  }
}
`;

class AgentGenerator extends Generator {
  protected suffix = 'agent';

  protected getDefaultTemplate(): string {
    return AGENT_TEMPLATE;
  }
}

export async function runAgent(name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const generator = new AgentGenerator();
  return generator.generate({
    name,
    path: options.path,
    dryRun: options.dryRun,
    data: { description: `A ${name} agent` },
  });
}

export function generateAgent(program: Command): void {
  program
    .command('agent <name>')
    .description('Generate a new AI agent with @Agent and @Tool decorators')
    .option('-p, --path <path>', 'Path where the agent should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (name: string, options: GenerateCLIOptions) => {
      const result = await runAgent(name, options);
      printGenerateResult(result, { json: options.json });
    });
}
