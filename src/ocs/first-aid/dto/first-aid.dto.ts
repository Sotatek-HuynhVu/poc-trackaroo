import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDraftDto {
  @ApiProperty() @IsString() @MaxLength(100) slug: string;
  @ApiProperty() @IsString() body: string;
}
