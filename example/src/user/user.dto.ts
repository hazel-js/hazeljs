export type CreateUserDto = {
  name: string;
  email: string;
  age: number;
  password: string;
};

export type UpdateUserDto = Partial<CreateUserDto>;
