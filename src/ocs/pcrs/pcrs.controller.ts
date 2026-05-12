import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequireKind, Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/current-user.decorator';
import { PcrsService } from './pcrs.service';
import { CreatePcrDto, SupersedePcrDto } from './dto/pcr.dto';

@ApiTags('OCS')
@ApiBearerAuth()
@Controller('v1/ocs/pcrs')
@RequireKind('ocs')
export class PcrsController {
  constructor(private pcrsService: PcrsService) {}

  @Get()
  @ApiOperation({ summary: 'List active PCRs' })
  async findAll(@Query('project_id') projectId?: string) {
    const data = await this.pcrsService.findActive(projectId);
    return { data };
  }

  @Post()
  @Roles('operations', 'contributor')
  @ApiOperation({ summary: 'Create PCR' })
  async create(@Body() dto: CreatePcrDto, @CurrentUser() user: AuthUser) {
    const data = await this.pcrsService.create(dto, user.sub);
    return { data };
  }

  @Post(':id/supersede')
  @Roles('operations', 'project_director')
  @ApiOperation({ summary: 'Supersede a PCR' })
  async supersede(@Param('id') id: string, @Body() dto: SupersedePcrDto, @CurrentUser() user: AuthUser) {
    const data = await this.pcrsService.supersede(id, dto, user.sub);
    return { data };
  }

  @Get('stale')
  @Roles('operations', 'project_director')
  @ApiOperation({ summary: 'List stale PCRs (>90 days)' })
  async findStale() {
    const data = await this.pcrsService.findStale();
    return { data };
  }
}
