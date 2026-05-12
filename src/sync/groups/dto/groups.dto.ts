import { IsString, MaxLength, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupDto {
  @ApiProperty() @IsString() @MaxLength(100) name: string;
}

export class AddMemberDto {
  @ApiProperty() @IsString() userUid: string;
}

export class CreateMetadataDto {
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  @ApiPropertyOptional() @IsArray() @IsOptional() tags?: string[];
}
