import { IsString, IsNotEmpty } from 'class-validator';

export class EnhancedJobResponseDto {
  @IsString()
  @IsNotEmpty()
  result!: string;
}
