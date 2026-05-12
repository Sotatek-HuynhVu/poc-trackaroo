import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundError } from '../../common/errors/errors';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async findByUser(uid: string) {
    return this.prisma.group.findMany({
      where: { OR: [{ ownerUid: uid }, { members: { some: { userUid: uid } } }] },
      include: { members: true },
    });
  }

  async create(name: string, ownerUid: string) {
    return this.prisma.group.create({ data: { name, ownerUid } });
  }

  async addMember(groupId: string, userUid: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundError('Group not found');
    return this.prisma.groupMember.create({ data: { groupId, userUid } });
  }
}
