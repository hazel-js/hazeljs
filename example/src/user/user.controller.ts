import { Controller, Get, Param } from '@hazeljs/core';
import { Swagger, ApiOperation } from '@hazeljs/swagger';
import { UserService } from './user.service';
import { User } from './user.model';
import { ParseIntPipe } from '@hazeljs/core';
import logger from '@hazeljs/core';

@Controller({ path: '/users' })
@Swagger({
  title: 'User API',
  description: 'API for user management',
  version: '1.0.0',
  tags: [{ name: 'users', description: 'User management operations' }],
})
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all users',
    description: 'Retrieves a list of all users',
    tags: ['users'],
    responses: {
      '200': {
        description: 'List of users',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'number',
                    example: 1,
                  },
                  name: {
                    type: 'string',
                    example: 'Admin User',
                  },
                  email: {
                    type: 'string',
                    example: 'admin@example.com',
                  },
                  age: {
                    type: 'number',
                    example: 30,
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  public async getAllUsers(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Get('/:id')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieves a user by their ID',
    tags: ['users'],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: {
          type: 'number',
          example: 1,
        },
      },
    ],
    responses: {
      '200': {
        description: 'User found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  example: 1,
                },
                name: {
                  type: 'string',
                  example: 'Admin User',
                },
                email: {
                  type: 'string',
                  example: 'admin@example.com',
                },
                age: {
                  type: 'number',
                  example: 30,
                },
              },
            },
          },
        },
      },
      '404': {
        description: 'User not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  public async getUserById(@Param('id', ParseIntPipe) id: number): Promise<User> {
    logger.debug('getUserById called with id:', id);
    return this.userService.findById(id);
  }
}
