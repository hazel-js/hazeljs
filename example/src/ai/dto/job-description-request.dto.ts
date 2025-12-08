import { IsString, IsNotEmpty } from 'class-validator';
import { Expose } from 'class-transformer';

export class JobDescriptionRequestDto {
  @Expose()
  @IsString()
  @IsNotEmpty()
  description!: string;
}
