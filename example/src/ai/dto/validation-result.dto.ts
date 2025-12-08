import { IsBoolean, IsArray, IsString } from 'class-validator';

export class ValidationResultDto {
  @IsBoolean()
  isValid!: boolean;

  @IsArray()
  @IsString({ each: true })
  issues!: string[];

  @IsArray()
  @IsString({ each: true })
  suggestions!: string[];
}
