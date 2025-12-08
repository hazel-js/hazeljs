import { Test } from '@hazeljs/core';
import { AuthService } from './auth/auth.service';
import { UserService } from './user/user.service';
import { UserRepository } from './user/user.repository';
import { PrismaService } from '@hazeljs/prisma';
import { JwtService } from '@hazeljs/auth';
import * as bcrypt from 'bcryptjs';

describe('Example Unit Tests', () => {
  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    password: '', // Will be set in beforeEach
    age: 25,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    // Hash password once for all tests
    mockUser.password = await bcrypt.hash('password123', 10);
  });

  describe('Auth Service', () => {
    it('should have AuthService defined', () => {
      expect(AuthService).toBeDefined();
    });

    it('should have JwtService defined', () => {
      expect(JwtService).toBeDefined();
    });
  });

  describe('User Service', () => {
    it('should have UserService defined', () => {
      expect(UserService).toBeDefined();
    });

    it('should have UserRepository defined', () => {
      expect(UserRepository).toBeDefined();
    });
  });
});
