import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class HealthController {
  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check' })
  check() {
    return { status: 'ok' };
  }
}
