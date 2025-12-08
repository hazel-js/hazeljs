import { jest } from '@jest/globals';
import { UserRepository } from './user.repository';
import { PrismaService } from '@hazeljs/prisma';
import { CreateUserDto } from './user.dto';

interface User {
  id: number;
  email: string;
  password: string;
  name: string;
  age: number;
  createdAt: Date;
  updatedAt: Date;
}

type MockFunction<T> = jest.Mock & {
  mockResolvedValue: (value: T) => jest.Mock;
  mockRejectedValue: (value: unknown) => jest.Mock;
};

interface MockPrismaService {
  user: {
    create: MockFunction<User>;
    findUnique: MockFunction<User | null>;
    findFirst: MockFunction<User | null>;
    update: MockFunction<User>;
    delete: MockFunction<User>;
  };
}

describe('UserRepository', () => {
  let repository: UserRepository;
  let prismaService: MockPrismaService;

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    password: 'hashedPassword',
    name: 'Test User',
    age: 25,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prismaService = {
      user: {
        create: jest.fn() as MockFunction<User>,
        findUnique: jest.fn() as MockFunction<User | null>,
        findFirst: jest.fn() as MockFunction<User | null>,
        update: jest.fn() as MockFunction<User>,
        delete: jest.fn() as MockFunction<User>,
      },
    };

    repository = new UserRepository(prismaService as unknown as PrismaService);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create a user', async () => {
      const userData: CreateUserDto = {
        email: 'test@example.com',
        password: 'hashedPassword',
        name: 'Test User',
        age: 25,
      };
      prismaService.user.create.mockResolvedValue(mockUser);

      const result = await repository.create(userData);
      expect(result).toStrictEqual(mockUser);
      expect(prismaService.user.create).toHaveBeenCalledWith({ data: userData });
    });
  });

  describe('findByEmail', () => {
    it('should find a user by email', async () => {
      const email = 'test@example.com';
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findByEmail(email);
      expect(result).toStrictEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
    });

    it('should return null if user not found', async () => {
      const email = 'nonexistent@example.com';
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail(email);
      expect(result).toBeNull();
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
    });
  });

  describe('findOne', () => {
    it('should find a user by id', async () => {
      const id = 1;
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findOne({ id });
      expect(result).toStrictEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id },
      });
    });

    it('should throw an error if user not found', async () => {
      const id = 999;
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(repository.findOne({ id })).rejects.toThrow('User not found');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id },
      });
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const id = 1;
      const updateData = { name: 'Updated Name' };
      const updatedUser = { ...mockUser, ...updateData };
      prismaService.user.update.mockResolvedValue(updatedUser);

      const result = await repository.update({ id }, updateData);
      expect(result).toStrictEqual(updatedUser);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id },
        data: updateData,
      });
    });
  });

  describe('delete', () => {
    it('should delete a user', async () => {
      const id = 1;
      prismaService.user.delete.mockResolvedValue(mockUser);

      const result = await repository.delete({ id });
      expect(result).toStrictEqual(mockUser);
      expect(prismaService.user.delete).toHaveBeenCalledWith({
        where: { id },
      });
    });
  });
});
