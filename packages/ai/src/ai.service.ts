import { Injectable } from '@hazeljs/core';
import { AITaskConfig, AITaskContext, AITaskResult } from './ai.types';
import logger from '@hazeljs/core';
import OpenAI from 'openai';

interface OllamaResponse {
  response: string;
}

interface AIProvider {
  execute: (config: AITaskConfig, input: unknown) => Promise<AITaskResult>;
}

@Injectable()
export class AIService {
  private providers: Map<string, AIProvider> = new Map();

  constructor() {
    // Initialize providers
    this.initializeProviders();
  }

  private initializeProviders(): void {
    logger.debug('Initializing AI providers');
    // OpenAI provider
    this.providers.set('openai', {
      execute: async (config: AITaskConfig, input: unknown): Promise<AITaskResult> => {
        logger.debug('OpenAI provider execute called with config:', {
          name: config.name,
          model: config.model,
          stream: config.stream,
          provider: config.provider,
        });

        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        logger.debug('OpenAI client initialized');

        if (config.stream) {
          try {
            logger.debug('Creating OpenAI stream with config:', {
              model: config.model,
              temperature: config.temperature,
              prompt: this.formatPrompt(config, input),
            });

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

            logger.debug('OpenAI stream created successfully');
            return {
              // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
              stream: (async function* () {
                try {
                  logger.debug('Starting to iterate over stream chunks');
                  for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content;
                    if (content) {
                      logger.debug('Yielding chunk:', { content });
                      yield content;
                    }
                  }
                  logger.debug('Finished iterating over stream chunks');
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

    // Ollama provider
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
            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
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
                      // Skip invalid JSON lines
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

    // Custom provider
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

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private formatPrompt(config: AITaskConfig, input: unknown): string {
    const context: AITaskContext = {
      taskName: config.name,
      description: config.prompt,
      inputExample: 'JSON object with input data',
      outputExample: `Expected ${config.outputType} output`,
      input: input,
    };

    return config.prompt.replace(/{{(\w+)}}/g, (_: string, key: string): string => {
      return String(context[key as keyof AITaskContext] || '');
    });
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
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
      logger.debug('Executing AI task:', {
        task: config.name,
        provider: config.provider,
        stream: config.stream,
        model: config.model,
      });

      const provider = this.providers.get(config.provider);
      if (!provider) {
        logger.error('Provider not found:', config.provider);
        throw new Error(`Provider ${config.provider} not supported`);
      }

      logger.debug('Found provider, executing task');
      const result = await provider.execute(config, input);
      logger.debug('AI task completed:', {
        task: config.name,
        hasStream: !!result.stream,
        hasError: !!result.error,
      });

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('AI task failed:', {
        task: config.name,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { error: errorMessage };
    }
  }
}
