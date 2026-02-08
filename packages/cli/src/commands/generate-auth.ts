import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { renderTemplate } from '../utils/generator';

const AUTH_MODULE_TEMPLATE = `import { HazelModule } from '@hazeljs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@HazelModule({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
`;

const AUTH_SERVICE_TEMPLATE = `import { Injectable, BadRequestError, UnauthorizedError } from '@hazeljs/core';
import { JwtService } from '@hazeljs/auth';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    // TODO: Check if user already exists in your database

    // TODO: Hash the password (e.g., with bcryptjs)
    // const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // TODO: Create the user in your database
    const user = {
      id: Date.now().toString(),
      name: registerDto.name,
      email: registerDto.email,
    };

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return { user, accessToken };
  }

  async login(loginDto: LoginDto) {
    // TODO: Find user by email in your database
    // TODO: Verify password with bcrypt.compare()

    const user = { id: '1', name: 'User', email: loginDto.email };

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return { user, accessToken };
  }
}
`;

const AUTH_CONTROLLER_TEMPLATE = `import { Controller, Post, Body } from '@hazeljs/core';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('/login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
`;

const JWT_GUARD_TEMPLATE = `import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedError } from '@hazeljs/core';
import { JwtService } from '@hazeljs/auth';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('Missing Authorization header');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedError('Invalid Authorization header');
    }

    try {
      const payload = this.jwtService.verify(token);
      (request as any).user = payload;
      return true;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}
`;

const REGISTER_DTO_TEMPLATE = `import { IsString, IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
`;

const LOGIN_DTO_TEMPLATE = `import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
`;

export function generateAuth(command: Command) {
  command
    .command('auth')
    .description('Generate an auth module with JWT guard, service, controller, and DTOs')
    .option('-p, --path <path>', 'Specify the path', 'src/auth')
    .option('--dry-run', 'Preview files without writing them')
    .action((options: { path?: string; dryRun?: boolean }) => {
      const basePath = path.join(process.cwd(), options.path || 'src/auth');
      const data = {};

      const files = [
        { file: 'auth.module.ts', template: AUTH_MODULE_TEMPLATE },
        { file: 'auth.service.ts', template: AUTH_SERVICE_TEMPLATE },
        { file: 'auth.controller.ts', template: AUTH_CONTROLLER_TEMPLATE },
        { file: 'jwt-auth.guard.ts', template: JWT_GUARD_TEMPLATE },
        { file: 'dto/register.dto.ts', template: REGISTER_DTO_TEMPLATE },
        { file: 'dto/login.dto.ts', template: LOGIN_DTO_TEMPLATE },
      ];

      try {
        for (const { file, template } of files) {
          const filePath = path.join(basePath, file);

          if (options.dryRun) {
            console.log(chalk.blue(`[dry-run] Would create ${filePath}`));
            continue;
          }

          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(filePath, renderTemplate(template, data));
          console.log(chalk.green(`\u2713 Generated ${filePath}`));
        }

        if (!options.dryRun) {
          console.log(chalk.blue('\n\uD83D\uDD10 Auth module generated successfully!'));
          console.log(chalk.gray('\nNext steps:'));
          console.log(chalk.gray('  1. Import AuthModule in your app module'));
          console.log(chalk.gray('  2. Configure JwtModule.forRoot() in your app module:'));
          console.log(chalk.gray('     JwtModule.forRoot({ secret: "your-secret", expiresIn: "1d" })'));
          console.log(chalk.gray('  3. Install bcryptjs: npm install bcryptjs @types/bcryptjs'));
          console.log(chalk.gray('  4. Implement database integration in AuthService'));
        }
      } catch (error) {
        console.error(chalk.red('Error generating auth module:'), error);
        process.exit(1);
      }
    });
}
