import { AITaskConfig } from './ai.types';
import 'reflect-metadata';
import { AIService } from './ai.service';
import logger from '@hazeljs/core';

const AI_TASK_METADATA_KEY = 'hazel:ai-task';

export function AITask(config: AITaskConfig): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    // Store the AI task configuration in metadata
    Reflect.defineMetadata(AI_TASK_METADATA_KEY, config, target, propertyKey);

    // Replace the method with our AI-powered version
    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      try {
        // Get the AI task configuration from metadata
        const taskConfig = Reflect.getMetadata(AI_TASK_METADATA_KEY, target, propertyKey);
        if (!taskConfig) {
          throw new Error('AI task configuration not found');
        }

        // Get the AI service from the container
        const aiService = (this as { aiService: AIService }).aiService;
        if (!aiService) {
          throw new Error(
            'AI service not found. Make sure to inject AIService in the constructor.'
          );
        }

        logger.debug('Executing AI task with config:', {
          name: taskConfig.name,
          stream: taskConfig.stream,
        });
        // Execute the AI task
        const result = await aiService.executeTask(taskConfig, args[0]);

        // If streaming is enabled and a stream is returned, return the stream directly
        if (taskConfig.stream && result.stream) {
          logger.debug('Returning stream from AI task');
          return result.stream;
        }

        // If there's an error, throw it
        if (result.error) {
          logger.error('AI task error:', result.error);
          throw new Error(result.error);
        }

        // For non-streaming responses, return the data
        logger.debug('Returning data from AI task:', result.data);
        return result.data;
      } catch (error: unknown) {
        logger.error('AI task execution failed:', error);
        if (error instanceof Error) {
          throw new Error(`AI task execution failed: ${error.message}`);
        }
        throw new Error('AI task execution failed: Unknown error');
      }
    };

    return descriptor;
  };
}
