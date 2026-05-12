import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'director@trackaroo.dev', description: 'Email (OCS) or UID (mobile)' })
  @IsString()
  email: string;

  @ApiProperty({ example: 'demo', description: 'Any value accepted in mock mode' })
  @IsString()
  password: string;
}
