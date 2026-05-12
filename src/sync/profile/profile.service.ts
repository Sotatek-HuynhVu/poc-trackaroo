import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundError } from '../../common/errors/errors';
import { UpdateProfileDto } from './dto/profile.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async get(uid: string) {
    const user = await this.prisma.mobileUser.findUnique({ where: { firebaseUid: uid } });
    if (!user) throw new NotFoundError('Profile not found');
    return user;
  }

  async upsert(uid: string, dto: UpdateProfileDto) {
    const { preferences, ...rest } = dto;
    const updateData: any = { ...rest };
    if (preferences !== undefined) updateData.preferences = preferences as Prisma.InputJsonValue;
    return this.prisma.mobileUser.upsert({
      where: { firebaseUid: uid },
      update: updateData,
      create: { firebaseUid: uid, displayName: dto.displayName ?? 'User', archetype: dto.archetype, preferences: (preferences ?? {}) as Prisma.InputJsonValue },
    });
  }
}
