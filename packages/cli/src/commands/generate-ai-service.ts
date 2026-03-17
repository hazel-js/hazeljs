import { Command } from 'commander';
import { Generator, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

const AI_SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';
import { AIService, AIFunction, AIPrompt } from '@hazeljs/ai';

@Service()
export class {{className}}AIService {
  constructor(private readonly aiService: AIService) {}

  @AIFunction({
    provider: 'openai',
    model: 'gpt-4',
    streaming: false,
  })
  async {{camelName}}Task(@AIPrompt() prompt: string): Promise<unknown> {
    const result = await this.aiService.complete({
      provider: 'openai',
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    return result;
  }
}
`;

class AIServiceGenerator extends Generator {
  protected suffix = 'ai-service';

  protected getDefaultTemplate(): string {
    return AI_SERVICE_TEMPLATE;
  }
}

export async function runAIService(name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const generator = new AIServiceGenerator();
  return generator.generate({ name, path: options.path, dryRun: options.dryRun });
}

export function generateAIService(program: Command): void {
  program
    .command('ai-service <name>')
    .description('Generate a new AI service with decorators')
    .alias('ai')
    .option('-p, --path <path>', 'Path where the AI service should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (name: string, options: GenerateCLIOptions) => {
      const result = await runAIService(name, options);
      printGenerateResult(result, { json: options.json });
    });
}
