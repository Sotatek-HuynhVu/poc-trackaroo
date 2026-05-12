import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMetadataDto } from '../groups/dto/groups.dto';

@Injectable()
export class PcrMetadataService {
  constructor(private prisma: PrismaService) {}

  async findByPcr(pcrId: string, userUid: string) {
    return this.prisma.pcrMetadata.findMany({ where: { pcrId, userUid } });
  }

  async create(pcrId: string, userUid: string, dto: CreateMetadataDto) {
    return this.prisma.pcrMetadata.create({ data: { pcrId, userUid, ...dto } });
  }
}
