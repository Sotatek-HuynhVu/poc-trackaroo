import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async append(data: {
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    previousState: any;
    newState: any;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: data.actorUserId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        previousState: data.previousState === null ? Prisma.JsonNull : data.previousState,
        newState: data.newState,
      },
    });
  }

  async query(filters: {
    entityType?: string;
    entityId?: string;
    actorUserId?: string;
    from?: string;
    to?: string;
  }) {
    const where: any = {};
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.actorUserId) where.actorUserId = filters.actorUserId;
    if (filters.from || filters.to) {
      where.at = {};
      if (filters.from) where.at.gte = new Date(filters.from);
      if (filters.to) where.at.lte = new Date(filters.to);
    }
    return this.prisma.auditLog.findMany({ where, orderBy: { at: 'desc' }, take: 100 });
  }
}
