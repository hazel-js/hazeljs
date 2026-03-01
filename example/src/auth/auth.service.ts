import { Injectable } from '@hazeljs/core';
import { JwtService } from '@hazeljs/auth';
import { UserService } from '../user/user.service';
import { User } from '../user/user.model';
import { RegisterDto } from './dto/register.dto';
import { UnauthorizedError, ConflictError } from '@hazeljs/core';
import * as bcrypt from 'bcryptjs';
import { RequestContext } from '@hazeljs/core';

export interface LoginDto {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userService.findByEmail(email);
    if (user && (await this.verifyPassword(password, user.password))) {
      return user;
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const user = await this.userService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const token = this.jwtService.sign(
      { sub: String(user.id), email: user.email },
      { expiresIn: '1h' }
    );
    return { access_token: token };
  }

  async register(registerDto: RegisterDto): Promise<User> {
    const existingUser = await this.userService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictError('User already exists');
    }
    return this.userService.create({
      ...registerDto,
      password: await this.hashPassword(registerDto.password),
    });
  }

  async getProfile(
    context: RequestContext
  ): Promise<{ id: number; name: string; email: string; age: number }> {
    if (!context.user) {
      throw new UnauthorizedError('User not authenticated');
    }
    const user = await this.userService.findById(Number(context.user.id));
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    const { ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
