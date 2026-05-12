import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundError, ValidationError } from '../../common/errors/errors';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateDraftDto } from './dto/first-aid.dto';

@Injectable()
export class FirstAidService {
  constructor(private prisma: PrismaService, private auditLog: AuditLogService) {}

  async findAll() {
    return this.prisma.firstAidContent.findMany({ orderBy: { slug: 'asc' } });
  }

  async createDraft(dto: CreateDraftDto, actorId: string) {
    const content = await this.prisma.firstAidContent.create({ data: dto });
    await this.auditLog.append({
      actorUserId: actorId,
      action: 'first_aid.create_draft',
      entityType: 'first_aid_content',
      entityId: content.id,
      previousState: null,
      newState: content,
    });
    return content;
  }

  async release(id: string, pdfUrl: string, actorId: string) {
    const existing = await this.prisma.firstAidContent.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('First aid content not found');
    if (existing.status === 'released') throw new ValidationError('Already released');

    const [updated] = await this.prisma.$transaction([
      this.prisma.firstAidContent.update({
        where: { id },
        data: { status: 'released', clinicalAttestationPdfUrl: pdfUrl, releasedBy: actorId, releasedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'first_aid.release',
          entityType: 'first_aid_content',
          entityId: id,
          previousState: existing as any,
          newState: { status: 'released', clinicalAttestationPdfUrl: pdfUrl } as any,
        },
      }),
    ]);
    return updated;
  }
}
