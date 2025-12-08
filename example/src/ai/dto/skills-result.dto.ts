import { IsArray, IsString } from 'class-validator';

export class SkillsResultDto {
  @IsArray()
  @IsString({ each: true })
  technicalSkills!: string[];

  @IsArray()
  @IsString({ each: true })
  softSkills!: string[];

  @IsArray()
  @IsString({ each: true })
  experience!: string[];
}
