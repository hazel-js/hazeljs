import { IsNotEmpty } from 'class-validator';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

export class LoginDto {
  @Expose()
  @IsString()
  @IsNotEmpty()
  email: string;

  @Expose()
  @IsString()
  @IsNotEmpty()
  password: string;
}
