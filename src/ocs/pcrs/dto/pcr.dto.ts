import { IsString, IsNumber, Min, Max, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePcrDto {
  @ApiProperty() @IsUUID() projectId: string;
  @ApiProperty() @IsNumber() @Min(-90) @Max(90) lat: number;
  @ApiProperty() @IsNumber() @Min(-180) @Max(180) lng: number;
  @ApiProperty() @IsString() category: string;
}

export class SupersedePcrDto {
  @ApiProperty() @IsNumber() @Min(-90) @Max(90) lat: number;
  @ApiProperty() @IsNumber() @Min(-180) @Max(180) lng: number;
  @ApiProperty() @IsString() category: string;
}
