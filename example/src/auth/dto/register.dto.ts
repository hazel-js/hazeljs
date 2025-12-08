import { IsString, IsEmail, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Expose } from 'class-transformer';

export class RegisterDto {
  @Expose()
  @IsString()
  @IsNotEmpty()
  name: string;

  @Expose()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @Expose()
  @IsString()
  @IsNotEmpty()
  password: string;

  @Expose()
  @IsNumber()
  @Min(0)
  age: number;
}
