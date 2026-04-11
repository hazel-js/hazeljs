import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import {
  renderTemplate,
  GenerateResult,
  GenerateCLIOptions,
  printGenerateResult,
} from '../utils/generator';

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

const AUTH_SERVICE_TEMPLATE = `import { Service, BadRequestError, UnauthorizedError } from '@hazeljs/core';
import { JwtService } from '@hazeljs/auth';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/** Replace with your DB / Prisma / TypeORM repository */
const users = new Map<string, { id: string; name: string; email: string; passwordHash: string }>();

@Service()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const email = registerDto.email.toLowerCase();
    if (users.has(email)) {
      throw new BadRequestError('User already exists');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);
    const user = {
      id: Date.now().toString(),
      name: registerDto.name,
      email,
      passwordHash,
    };
    users.set(email, user);

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      user: { id: user.id, name: user.name, email: user.email },
      accessToken,
    };
  }

  async login(loginDto: LoginDto) {
    const email = loginDto.email.toLowerCase();
    const row = users.get(email);
    if (!row) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const ok = await bcrypt.compare(loginDto.password, row.passwordHash);
    if (!ok) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const accessToken = this.jwtService.sign({
      sub: row.id,
      email: row.email,
    });

    return {
      user: { id: row.id, name: row.name, email: row.email },
      accessToken,
    };
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

/**
 * Generate a complete auth module (6 files: module, service, controller, JWT guard, 2 DTOs).
 *
 * @param _name   - Unused (auth generator doesn't need a custom name)
 * @param options - Standard CLI options (--path, --dry-run, --json)
 * @returns GenerateResult with paths of all created files and setup next-steps
 */
export async function runAuth(_name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const basePath = path.join(process.cwd(), options.path || 'src/auth');
  const data: Record<string, string> = {};

  const files = [
    { file: 'auth.module.ts', template: AUTH_MODULE_TEMPLATE },
    { file: 'auth.service.ts', template: AUTH_SERVICE_TEMPLATE },
    { file: 'auth.controller.ts', template: AUTH_CONTROLLER_TEMPLATE },
    { file: 'jwt-auth.guard.ts', template: JWT_GUARD_TEMPLATE },
    { file: 'dto/register.dto.ts', template: REGISTER_DTO_TEMPLATE },
    { file: 'dto/login.dto.ts', template: LOGIN_DTO_TEMPLATE },
  ];

  const created: string[] = [];
  for (const { file, template } of files) {
    const filePath = path.join(basePath, file);
    created.push(filePath);
    if (options.dryRun) continue;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, renderTemplate(template, data));
  }
  return {
    ok: true,
    created,
    dryRun: options.dryRun,
    nextSteps: [
      'Import AuthModule in your app module',
      'Configure JwtModule.forRoot() in your app module: JwtModule.forRoot({ secret: "your-secret", expiresIn: "1d" })',
      'Install bcryptjs: npm install bcryptjs @types/bcryptjs',
      'Implement database integration in AuthService',
    ],
  };
}

/**
 * Register `hazel g auth` as a sub-command of the generate command.
 *
 * @param command - The Commander `generate` parent command
 */
export function generateAuth(command: Command) {
  command
    .command('auth')
    .description('Generate an auth module with JWT guard, service, controller, and DTOs')
    .option('-p, --path <path>', 'Specify the path', 'src/auth')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (options: GenerateCLIOptions) => {
      const result = await runAuth('auth', options);
      printGenerateResult(result, { json: options.json });
    });
}
