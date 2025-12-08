import { Injectable } from '@hazeljs/core';
import { BadRequestError, NotFoundError } from '@hazeljs/core';
import { BaseRepository } from '@hazeljs/prisma';
import { PrismaService } from '@hazeljs/prisma';
import { User } from './user.model';

export type CreateUserDto = {
  name: string;
  age: number;
  email: string;
  password: string;
};

export type WhereUniqueInput =
  | {
      id: number;
    }
  | {
      email: string;
    };

export type UpdateInput = Partial<CreateUserDto>;

@Injectable()
export class UserRepository extends BaseRepository<User> {
  protected readonly model = 'user';

  constructor(protected readonly prisma: PrismaService) {
    super(prisma, 'user');
  }

  protected get prismaClient(): PrismaService {
    return this.prisma;
  }

  async findMany(): Promise<User[]> {
    const users = await this.prismaClient.user.findMany();
    return users.map((user) => ({
      ...user,
      password: undefined,
    }));
  }

  async findOne(where: WhereUniqueInput): Promise<User | null> {
    if ('id' in where) {
      if (!where.id) {
        throw new Error('User ID must be provided');
      }
    } else if ('email' in where) {
      if (!where.email) {
        throw new Error('User email must be provided');
      }
    } else {
      throw new Error('Either id or email must be provided to find a user');
    }

    const user = await this.prismaClient.user.findUnique({ where });
    if (!user) throw new NotFoundError('User not found');
    return user as User;
  }

  async create(data: CreateUserDto): Promise<User> {
    try {
      const user = await this.prismaClient.user.create({ data });
      return user as User;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new BadRequestError('User with this email already exists');
      }
      throw error;
    }
  }

  async update(where: WhereUniqueInput, data: UpdateInput): Promise<User> {
    const user = await this.prismaClient.user.update({ where, data });
    return user as User;
  }

  async delete(where: WhereUniqueInput): Promise<User> {
    const user = await this.prismaClient.user.delete({ where });
    return user as User;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prismaClient.user.findUnique({ where: { email } });
    if (!user) return null;
    return user as User;
  }

  async findAdults(): Promise<User[]> {
    const users = await this.prismaClient.user.findMany({
      where: {
        age: {
          gte: 18,
        },
      },
    });
    return users.map((user) => ({
      ...user,
      password: undefined,
    }));
  }

  async count(): Promise<number> {
    return this.prismaClient.user.count();
  }
}
