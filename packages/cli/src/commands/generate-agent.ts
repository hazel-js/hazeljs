import { Command } from 'commander';
import { Generator } from '../utils/generator';

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

export function generateAgent(program: Command): void {
  program
    .command('agent <name>')
    .description('Generate a new AI agent with @Agent and @Tool decorators')
    .option('-p, --path <path>', 'Path where the agent should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .action(async (name: string, options: { path?: string; dryRun?: boolean }) => {
      const generator = new AgentGenerator();
      await generator.generate({
        name,
        path: options.path,
        dryRun: options.dryRun,
        data: { description: `A ${name} agent` },
      });
    });
}
