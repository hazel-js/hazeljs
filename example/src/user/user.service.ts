import { Injectable } from '@hazeljs/core';
import { User } from './user.model';
import { UserRepository } from './user.repository';
import { CreateUserDto, UpdateUserDto } from './user.dto';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.findMany();
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({ id });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    return this.userRepository.create(createUserDto);
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    return this.userRepository.update({ id }, updateUserDto);
  }

  async delete(id: number): Promise<User> {
    return this.userRepository.delete({ id });
  }

  async findAdults(): Promise<User[]> {
    return this.userRepository.findAdults();
  }

  async count(): Promise<number> {
    return this.userRepository.count();
  }
}
