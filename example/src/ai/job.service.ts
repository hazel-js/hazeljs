import { Injectable } from '@hazeljs/core';
import { AIService, AITask } from '@hazeljs/ai';
import logger from '@hazeljs/core';

@Injectable()
export class JobService {
  constructor(private aiService: AIService) {
    logger.debug('JobService initialized with AIService:', {
      hasAiService: !!aiService,
      aiServiceType: aiService?.constructor?.name,
    });
  }

  @AITask({
    name: 'enhanceJobDesc',
    prompt: `You are a job description enhancer. Make the following job description more concise, clear, and appealing for a senior candidate.

Job Description:
{{input}}

Improved Version:`,
    provider: 'openai',
    model: 'gpt-4',
    outputType: 'string',
    temperature: 0.7,
    stream: true,
  })
  async enhanceJobDescription(_jobDesc: string): Promise<string> {
    // The decorator will handle the AI task execution
    return _jobDesc;
  }

  @AITask({
    name: 'validateJobDesc',
    prompt: `You are a job description validator. Check if the following job description meets best practices and is free of bias.

Job Description:
{{input}}

Please provide your analysis in the following JSON format:
{
  "isValid": boolean,
  "issues": string[],
  "suggestions": string[]
}

Analysis:`,
    provider: 'openai',
    model: 'gpt-4',
    outputType: 'json',
    temperature: 0.3,
  })
  async validateJobDescription(_jobDesc: string): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    // The decorator will handle the AI task execution
    return {
      isValid: false,
      issues: [],
      suggestions: [],
    };
  }

  @AITask({
    name: 'extractSkills',
    prompt: `You are a job description analyzer. Extract required skills and experience from the following job description.

Job Description:
{{input}}

You must respond with a valid JSON object in the following format:
{
  "technicalSkills": ["JavaScript", "Node.js", "React"],
  "softSkills": ["Communication", "Leadership", "Problem Solving"],
  "experience": ["5+ years of software development", "Experience with agile methodologies"]
}

Do not include any text before or after the JSON object. The response must be a valid JSON object that can be parsed directly.`,
    provider: 'openai',
    model: 'gpt-4',
    outputType: 'json',
    temperature: 0.3,
  })
  async extractSkills(_jobDesc: string): Promise<{
    technicalSkills: string[];
    softSkills: string[];
    experience: string[];
  }> {
    // The decorator will handle the AI task execution
    return {
      technicalSkills: [],
      softSkills: [],
      experience: [],
    };
  }
}
