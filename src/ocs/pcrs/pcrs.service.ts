import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundError, ValidationError } from '../../common/errors/errors';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreatePcrDto, SupersedePcrDto } from './dto/pcr.dto';

@Injectable()
export class PcrsService {
  constructor(private prisma: PrismaService, private auditLog: AuditLogService) {}

  async findActive(projectId?: string) {
    const where: any = { status: 'active' };
    if (projectId) where.projectId = projectId;
    return this.prisma.pcr.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async create(dto: CreatePcrDto, actorId: string) {
    const pcr = await this.prisma.pcr.create({ data: { ...dto, createdBy: actorId } });
    await this.auditLog.append({
      actorUserId: actorId,
      action: 'pcr.create',
      entityType: 'pcr',
      entityId: pcr.id,
      previousState: null,
      newState: pcr,
    });
    return pcr;
  }

  async supersede(id: string, dto: SupersedePcrDto, actorId: string) {
    const existing = await this.prisma.pcr.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('PCR not found');
    if (existing.status === 'superseded') throw new ValidationError('PCR already superseded');

    const [newPcr] = await this.prisma.$transaction([
      this.prisma.pcr.create({
        data: { projectId: existing.projectId, ...dto, createdBy: actorId },
      }),
      this.prisma.pcr.update({ where: { id }, data: { status: 'superseded' } }),
    ]);

    await this.prisma.pcr.update({ where: { id }, data: { supersededBy: newPcr.id } });
    await this.auditLog.append({
      actorUserId: actorId,
      action: 'pcr.supersede',
      entityType: 'pcr',
      entityId: id,
      previousState: existing,
      newState: { supersededBy: newPcr.id },
    });
    return newPcr;
  }

  async findStale() {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    return this.prisma.pcr.findMany({
      where: { status: 'active', createdAt: { lt: ninetyDaysAgo } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
