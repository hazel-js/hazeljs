import { jest } from '@jest/globals';
import { JobService } from './job.service';
import { AIService } from '@hazeljs/ai';
import { AITaskConfig, AITaskResult } from '@hazeljs/ai';
import { Container } from '@hazeljs/core';

// Mock AIService
const mockExecuteTask = jest
  .fn()
  .mockImplementation((...args: unknown[]): Promise<AITaskResult> => {
    const taskConfig = args[0] as { name: string; stream: boolean };
    switch (taskConfig.name) {
      case 'enhanceJobDesc':
        return Promise.resolve({
          data: 'Enhanced: Looking for a senior developer',
        } as AITaskResult);
      case 'validateJobDesc':
        return Promise.resolve({
          data: {
            isValid: true,
            issues: ['No salary range specified'],
            suggestions: ['Add salary range', 'Include benefits'],
          },
        } as AITaskResult);
      case 'extractSkills':
        return Promise.resolve({
          data: {
            technicalSkills: ['Node.js', 'React'],
            softSkills: ['Communication', 'Time Management'],
            experience: ['5+ years development'],
          },
        } as AITaskResult);
      default:
        throw new Error(`Unknown task: ${taskConfig.name}`);
    }
  });

jest.mock('@hazeljs/ai', () => {
  const actual = jest.requireActual('@hazeljs/ai') as Record<string, unknown>;
  return {
    ...Object.fromEntries(Object.entries(actual)),
    AIService: jest.fn().mockImplementation(() => ({
      executeTask: mockExecuteTask,
    })),
  };
});

describe('JobService', () => {
  let container: Container;
  let jobService: JobService;
  let mockAIService: AIService;

  beforeEach(() => {
    container = Container.getInstance();
    container.clear();
    mockAIService = new AIService();
    (mockAIService.executeTask as jest.Mock) = mockExecuteTask;
    container.register(AIService, mockAIService);
    jobService = new JobService(mockAIService);
    container.register(JobService, jobService);
  });

  afterEach(() => {
    container.clear();
    jest.clearAllMocks();
  });

  it('should enhance job description', async () => {
    const result = await jobService.enhanceJobDescription('Looking for a senior developer');
    expect(result).toBe('Enhanced: Looking for a senior developer');
  });

  it('should validate job description', async () => {
    const result = await jobService.validateJobDescription('Looking for a senior developer');
    expect(result).toEqual({
      isValid: true,
      issues: ['No salary range specified'],
      suggestions: ['Add salary range', 'Include benefits'],
    });
  }, 10000);

  it('should extract skills from job description', async () => {
    const result = await jobService.extractSkills('Looking for a senior developer');
    expect(result).toEqual({
      technicalSkills: ['Node.js', 'React'],
      softSkills: ['Communication', 'Time Management'],
      experience: ['5+ years development'],
    });
  });
});
