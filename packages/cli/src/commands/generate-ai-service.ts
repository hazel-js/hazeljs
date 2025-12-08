import { Command } from 'commander';
import { Generator, GeneratorOptions } from '../utils/generator';

const AI_SERVICE_TEMPLATE = `import { Injectable } from '@hazeljs/core';
import { AIService } from '@hazeljs/ai';
import { AIFunction, AIPrompt } from '@hazeljs/ai';

@Injectable()
export class {{className}}AIService {
  constructor(private readonly aiService: AIService) {}

  @AIFunction({
    provider: 'openai',
    model: 'gpt-4',
    streaming: false,
  })
  async {{fileName}}Task(@AIPrompt() prompt: string): Promise<unknown> {
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
  protected getDefaultTemplate(): string {
    return AI_SERVICE_TEMPLATE;
  }
}

export function generateAIService(program: Command): void {
  program
    .command('ai-service <name>')
    .description('Generate a new AI service with decorators')
    .alias('ai')
    .option('-p, --path <path>', 'Path where the AI service should be generated')
    .action(async (name: string, options: { path?: string }) => {
      const generator = new AIServiceGenerator();
      const generatorOptions: Partial<GeneratorOptions> = {
        name,
        path: options.path,
      };

      const finalOptions = await generator.promptForOptions(generatorOptions);
      await generator.generate(finalOptions);
    });
}

