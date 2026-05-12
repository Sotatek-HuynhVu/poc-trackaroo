import { IsEnum, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScoreInputDto {
  @ApiProperty({ enum: ['vehicle', 'trail', 'foot'] })
  @IsEnum(['vehicle', 'trail', 'foot'])
  mode: 'vehicle' | 'trail' | 'foot';

  @ApiPropertyOptional() @IsNumber() @IsOptional() gradientPercent?: number;
  @ApiPropertyOptional() @IsNumber() @Min(1) @Max(5) @IsOptional() awtgsGrade?: number;
}
