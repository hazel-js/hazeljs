import { Controller, Post, Get, Body, UseGuards } from '@hazeljs/core';
import { Swagger, ApiOperation } from '@hazeljs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RequestContext } from '@hazeljs/core';

@Controller({ path: '/auth' })
@Swagger({
  title: 'Authentication API',
  description: 'API for user authentication and registration',
  version: '1.0.0',
  tags: [{ name: 'auth', description: 'Authentication operations' }],
})
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/login')
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticates a user and returns a JWT token',
    tags: ['auth'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: {
                type: 'string',
                format: 'email',
                example: 'admin@example.com',
              },
              password: {
                type: 'string',
                format: 'password',
                example: 'password123',
              },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Login successful',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                access_token: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
              },
            },
          },
        },
      },
      '400': {
        description: 'Invalid input',
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
      '401': {
        description: 'Unauthorized',
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
  public async login(@Body(LoginDto) loginDto: LoginDto): Promise<{ access_token: string }> {
    return this.authService.login(loginDto);
  }

  @Post('/register')
  @ApiOperation({
    summary: 'User registration',
    description: 'Registers a new user',
    tags: ['auth'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name', 'email', 'password', 'age'],
            properties: {
              name: {
                type: 'string',
                example: 'John Doe',
              },
              email: {
                type: 'string',
                format: 'email',
                example: 'john@example.com',
              },
              password: {
                type: 'string',
                format: 'password',
                example: 'password123',
              },
              age: {
                type: 'number',
                example: 25,
              },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Registration successful',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  example: 3,
                },
                name: {
                  type: 'string',
                  example: 'John Doe',
                },
                email: {
                  type: 'string',
                  example: 'john@example.com',
                },
                age: {
                  type: 'number',
                  example: 25,
                },
              },
            },
          },
        },
      },
      '400': {
        description: 'Invalid input',
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
  public async register(
    @Body(RegisterDto) registerDto: RegisterDto
  ): Promise<{ id: number; name: string; email: string; age: number }> {
    return this.authService.register(registerDto);
  }

  @Get('/profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get user profile',
    description: 'Retrieves the profile of the authenticated user',
    tags: ['auth'],
    responses: {
      '200': {
        description: 'Profile retrieved successfully',
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
      '401': {
        description: 'Unauthorized',
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
  public async getProfile(
    context: RequestContext
  ): Promise<{ id: number; name: string; email: string; age: number }> {
    return this.authService.getProfile(context);
  }
}
