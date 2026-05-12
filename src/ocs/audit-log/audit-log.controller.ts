import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequireKind, Roles } from '../../common/decorators/roles.decorator';
import { AuditLogService } from './audit-log.service';

@ApiTags('OCS')
@ApiBearerAuth()
@Controller('v1/ocs/audit-log')
@RequireKind('ocs')
@Roles('project_director')
export class AuditLogController {
  constructor(private auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'Query audit log (PD only)' })
  async query(
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
    @Query('actor_user_id') actorUserId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const logs = await this.auditLogService.query({ entityType, entityId, actorUserId, from, to });
    return { data: logs, meta: { count: logs.length } };
  }
}
