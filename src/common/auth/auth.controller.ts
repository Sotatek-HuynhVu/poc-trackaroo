import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Public()
  @ApiOperation({
    summary: 'Mock login (POC only)',
    description:
      '**MOCK MODE ONLY** — This endpoint does NOT exist when AUTH_PROVIDER=firebase. ' +
      'In Firebase mode, mobile clients authenticate directly via Firebase Auth SDK and send ' +
      'the resulting ID Token as `Authorization: Bearer <token>` on every request.',
  })
  @ApiResponse({ status: 200, description: 'Returns JWT token + user info' })
  @ApiResponse({ status: 401, description: 'User not found' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto.email, dto.password);
    return { data: result };
  }
}
