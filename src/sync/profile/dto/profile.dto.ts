import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsString() @IsOptional() displayName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() archetype?: string;
  @ApiPropertyOptional() @IsObject() @IsOptional() preferences?: Record<string, unknown>;
}
