import {
  Controller,
  Post,
  Body,
  UsePipes,
  UseGuards,
  Res,
  HazelResponse,
  ValidationPipe,
  logger,
} from '@hazeljs/core';
import { JobService } from './job.service';
import { Swagger, ApiOperation } from '@hazeljs/swagger';
import { JobDescriptionRequestDto, ValidationResponseDto, SkillsResponseDto } from './job.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Swagger({
  title: 'Job API',
  description: 'API for job description processing using AI',
  version: '1.0.0',
  tags: [
    {
      name: 'jobs',
      description: 'Job description operations',
    },
  ],
})
@Controller({
  path: 'jobs',
})
@UseGuards(JwtAuthGuard)
export class JobController {
  constructor(private jobService: JobService) {}

  @Post('/enhance')
  @ApiOperation({
    summary: 'Enhance job description using AI',
    description: 'Uses AI to enhance and improve a job description',
    tags: ['jobs'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['description'],
            properties: {
              description: {
                type: 'string',
                example:
                  'Looking for a Senior Software Engineer with 5+ years of experience in Node.js and React.',
              },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Streaming enhanced job description',
        content: {
          'text/plain': {
            schema: {
              type: 'string',
              example:
                'Enhanced job description with more detailed requirements and responsibilities.',
            },
          },
        },
      },
      '400': {
        description: 'Invalid request body',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: {
                  type: 'string',
                  example: 'Invalid request body: description is required',
                },
              },
            },
          },
        },
      },
      '500': {
        description: 'Error enhancing job description',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: {
                  type: 'string',
                  example: 'Failed to enhance job description',
                },
              },
            },
          },
        },
      },
    },
  })
  @UsePipes(ValidationPipe)
  async enhanceJobDescription(
    @Body(JobDescriptionRequestDto) request: JobDescriptionRequestDto,
    @Res() res: HazelResponse
  ): Promise<void> {
    try {
      logger.debug('Starting enhanceJobDescription with request:', request);

      if (!request || !request.description) {
        logger.error('Invalid request body:', request);
        res.status(400).json({ error: 'Invalid request body: description is required' });
        return;
      }

      logger.debug(
        'Calling jobService.enhanceJobDescription with description:',
        request.description
      );
      const stream = await this.jobService.enhanceJobDescription(request.description);

      if (!stream) {
        logger.error('No stream returned from jobService');
        res.status(500).json({ error: 'Failed to create stream' });
        return;
      }

      logger.debug('Stream received from jobService, setting up response headers');
      // Set headers for streaming
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Transfer-Encoding', 'chunked');

      // Stream the response
      logger.debug('Starting to stream response');
      for await (const chunk of stream) {
        logger.debug('Writing chunk to response:', { chunk });
        res.write(chunk);
      }

      logger.debug('Finished streaming response');
      res.end();
    } catch (error) {
      logger.error('Error in enhanceJobDescription:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to enhance job description',
      });
    }
  }

  @Post('/validate')
  @ApiOperation({
    summary: 'Validate job description',
    description: 'Uses AI to validate a job description for best practices and bias',
    tags: ['jobs'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['description'],
            properties: {
              description: {
                type: 'string',
                example:
                  'Looking for a Senior Software Engineer with 5+ years of experience in Node.js and React.',
              },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Validation results',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                result: {
                  type: 'object',
                  properties: {
                    isValid: {
                      type: 'boolean',
                      example: true,
                    },
                    issues: {
                      type: 'array',
                      items: {
                        type: 'string',
                        example: 'Consider adding more details about company culture',
                      },
                    },
                    suggestions: {
                      type: 'array',
                      items: {
                        type: 'string',
                        example: 'Add information about remote work policy',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '400': {
        description: 'Invalid request body',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: {
                  type: 'string',
                  example: 'Invalid request body: description is required',
                },
              },
            },
          },
        },
      },
    },
  })
  @UsePipes(ValidationPipe)
  async validateJobDescription(
    @Body(JobDescriptionRequestDto) body: JobDescriptionRequestDto
  ): Promise<ValidationResponseDto> {
    logger.debug('Received request body:', body);
    const result = await this.jobService.validateJobDescription(body.description);
    return { result };
  }

  @Post('/skills')
  @ApiOperation({
    summary: 'Extract skills from job description',
    description: 'Uses AI to extract required skills and experience from a job description',
    tags: ['jobs'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['description'],
            properties: {
              description: {
                type: 'string',
                example:
                  'Looking for a Senior Software Engineer with 5+ years of experience in Node.js and React. Must have strong communication skills and experience with agile methodologies.',
              },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Extracted skills and experience',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                result: {
                  type: 'object',
                  properties: {
                    technicalSkills: {
                      type: 'array',
                      items: {
                        type: 'string',
                        example: 'Node.js',
                      },
                    },
                    softSkills: {
                      type: 'array',
                      items: {
                        type: 'string',
                        example: 'Communication',
                      },
                    },
                    experience: {
                      type: 'array',
                      items: {
                        type: 'string',
                        example: '5+ years of experience',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '400': {
        description: 'Invalid request body',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: {
                  type: 'string',
                  example: 'Invalid request body: description is required',
                },
              },
            },
          },
        },
      },
    },
  })
  @UsePipes(ValidationPipe)
  async extractSkills(
    @Body(JobDescriptionRequestDto) body: JobDescriptionRequestDto
  ): Promise<SkillsResponseDto> {
    logger.debug('Received request body:', body);
    const result = await this.jobService.extractSkills(body.description);
    return { result };
  }
}
