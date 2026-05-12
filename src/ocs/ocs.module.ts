import { Module } from '@nestjs/common';
import { PcrsController } from './pcrs/pcrs.controller';
import { PcrsService } from './pcrs/pcrs.service';
import { FirstAidController } from './first-aid/first-aid.controller';
import { FirstAidService } from './first-aid/first-aid.service';
import { AuditLogController } from './audit-log/audit-log.controller';
import { AuditLogService } from './audit-log/audit-log.service';

@Module({
  controllers: [PcrsController, FirstAidController, AuditLogController],
  providers: [PcrsService, FirstAidService, AuditLogService],
  exports: [AuditLogService],
})
export class OcsModule {}
