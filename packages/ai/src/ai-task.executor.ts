import { AITaskConfig, AITaskContext, AITaskResult } from './ai.types';
import logger from '@hazeljs/core';
import OpenAI from 'openai';
import { PromptTemplate } from '@hazeljs/prompts';
import './prompts/task.prompt';
import { AI_TASK_FORMAT_KEY } from './prompts/task.prompt';

interface OllamaResponse {
  response: string;
}

interface AIProvider {
  execute: (config: AITaskConfig, input: unknown) => Promise<AITaskResult>;
}

/**
 * Executes legacy @AITask configurations using provider-specific adapters.
 */
export class AITaskExecutor {
  private providers: Map<string, AIProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    logger.debug('Initializing AI task providers');
    this.providers.set('openai', {
      execute: async (config: AITaskConfig, input: unknown): Promise<AITaskResult> => {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        if (config.stream) {
          try {
            const stream = await openai.chat.completions.create({
              model: config.model,
              messages: [
                {
                  role: 'system',
                  content: this.formatPrompt(config, input),
                },
              ],
              temperature: config.temperature || 0.7,
              max_tokens: config.maxTokens,
              stream: true,
            });

            return {
              stream: (async function* () {
                try {
                  for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content;
                    if (content) {
                      yield content;
                    }
                  }
                } catch (error) {
                  logger.error('Error in OpenAI stream:', error);
                  throw error;
                }
              })(),
            };
          } catch (error) {
            logger.error('Error creating OpenAI stream:', error);
            return { error: error instanceof Error ? error.message : 'Failed to create stream' };
          }
        }

        try {
          const response = await openai.chat.completions.create({
            model: config.model,
            messages: [
              {
                role: 'system',
                content: this.formatPrompt(config, input),
              },
            ],
            temperature: config.temperature || 0.7,
            max_tokens: config.maxTokens,
          });

          return this.parseResponse(response.choices[0].message.content, config.outputType);
        } catch (error) {
          logger.error('Error in OpenAI request:', error);
          return { error: error instanceof Error ? error.message : 'Failed to get response' };
        }
      },
    });

    this.providers.set('ollama', {
      execute: async (config: AITaskConfig, input: unknown): Promise<AITaskResult> => {
        if (config.stream) {
          const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: config.model,
              prompt: this.formatPrompt(config, input),
              temperature: config.temperature || 0.7,
              max_tokens: config.maxTokens,
              stream: true,
            }),
          });

          if (!response.body) {
            throw new Error('No response body available for streaming');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          return {
            stream: (async function* () {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const chunk = decoder.decode(value);
                  const lines = chunk.split('\n').filter(Boolean);

                  for (const line of lines) {
                    try {
                      const data = JSON.parse(line);
                      if (data.response) {
                        yield data.response;
                      }
                    } catch {
                      continue;
                    }
                  }
                }
              } finally {
                reader.releaseLock();
              }
            })(),
          };
        }

        const response = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model,
            prompt: this.formatPrompt(config, input),
            temperature: config.temperature || 0.7,
            max_tokens: config.maxTokens,
          }),
        });

        const data = (await response.json()) as OllamaResponse;
        return this.parseResponse(data.response, config.outputType);
      },
    });

    this.providers.set('custom', {
      execute: async (config: AITaskConfig, input: unknown): Promise<AITaskResult> => {
        if (!config.customProvider) {
          throw new Error('Custom provider configuration is required');
        }

        const { url, headers, transformRequest, transformResponse } = config.customProvider;

        const requestBody = transformRequest ? transformRequest(input) : input;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();
        const transformedData = transformResponse ? transformResponse(data) : data;
        return this.parseResponse(transformedData, config.outputType);
      },
    });
  }

  private formatPrompt(config: AITaskConfig, input: unknown): string {
    const context: AITaskContext = {
      taskName: config.name,
      description: config.prompt,
      inputExample: 'JSON object with input data',
      outputExample: `Expected ${config.outputType} output`,
      input: input,
    };

    const normalizedTemplate = config.prompt.replace(/\{\{(\w+)\}\}/g, '{$1}');
    const tpl = new PromptTemplate<Record<string, unknown>>(normalizedTemplate, {
      name: AI_TASK_FORMAT_KEY,
    });

    return tpl.render(context as unknown as Record<string, unknown>);
  }

  private parseResponse(response: unknown, outputType: string): AITaskResult {
    try {
      switch (outputType) {
        case 'json':
          return { data: JSON.parse(response as string) };
        case 'number':
          return { data: Number(response) };
        case 'boolean':
          return { data: (response as string).toLowerCase() === 'true' };
        default:
          return { data: response };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { error: `Failed to parse response: ${errorMessage}` };
    }
  }

  async executeTask(config: AITaskConfig, input: unknown): Promise<AITaskResult> {
    try {
      const provider = this.providers.get(config.provider);
      if (!provider) {
        throw new Error(`Provider ${config.provider} not supported`);
      }

      return await provider.execute(config, input);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('AI task failed:', { task: config.name, error: errorMessage });
      return { error: errorMessage };
    }
  }
}
