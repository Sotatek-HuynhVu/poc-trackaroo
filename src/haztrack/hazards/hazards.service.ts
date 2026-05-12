import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class HazardsService {
  constructor(private prisma: PrismaService) {}

  private computeAgeBucket(fetchedAt: Date, ttlMinutes: number): 'gold' | 'grey' | 'muted' {
    const ageMs = Date.now() - fetchedAt.getTime();
    const ttlMs = ttlMinutes * 60 * 1000;
    if (ageMs < ttlMs / 2) return 'gold';
    if (ageMs < ttlMs) return 'grey';
    return 'muted';
  }

  async findAll() {
    const hazards = await this.prisma.hazardCache.findMany({ orderBy: { fetchedAt: 'desc' }, take: 200 });
    return hazards.map((h) => ({
      id: h.id,
      source: h.source,
      geom: h.geom,
      payload: h.payload,
      ageBucket: this.computeAgeBucket(h.fetchedAt, h.ttlMinutes),
      fetchedAt: h.fetchedAt,
    }));
  }

  async getSourcesStatus() {
    const runs = await this.prisma.ingestRun.findMany({ orderBy: { startedAt: 'desc' }, distinct: ['source'], take: 3 });
    return Object.fromEntries(runs.map((r) => [r.source, { status: r.status, startedAt: r.startedAt, itemsFetched: r.itemsFetched }]));
  }
}
