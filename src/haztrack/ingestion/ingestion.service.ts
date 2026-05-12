import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import pRetry from 'p-retry';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FixtureFeedAdapter } from './adapters/fixture-adapter';
import { IHazardFeedAdapter } from './adapters/types';

const TTL_MAP = { bom: 15, afac: 30, ses: 60 } as const;

@Injectable()
export class IngestionService implements OnModuleInit {
  private readonly logger = new Logger(IngestionService.name);
  private bomAdapter = new FixtureFeedAdapter('bom');
  private afacAdapter = new FixtureFeedAdapter('afac');
  private sesAdapter = new FixtureFeedAdapter('ses');

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    void this.runIngest(this.bomAdapter);
    void this.runIngest(this.afacAdapter);
    void this.runIngest(this.sesAdapter);
  }

  @Cron('*/15 * * * *')
  async handleBom() { await this.runIngest(this.bomAdapter); }

  @Cron('*/30 * * * *')
  async handleAfac() { await this.runIngest(this.afacAdapter); }

  @Cron('0 * * * *')
  async handleSes() { await this.runIngest(this.sesAdapter); }

  private async runIngest(adapter: IHazardFeedAdapter): Promise<void> {
    const source = adapter.source;
    const ttlMinutes = TTL_MAP[source];
    const run = await this.prisma.ingestRun.create({ data: { source } });

    try {
      const hazards = await pRetry(() => adapter.fetch(), { retries: 3 });

      for (const h of hazards) {
        await this.prisma.hazardCache.upsert({
          where: { source_externalId: { source, externalId: h.externalId } },
          update: { geom: h.geom as any, payload: h.payload as any, fetchedAt: new Date(), ttlMinutes },
          create: { source, externalId: h.externalId, geom: h.geom as any, payload: h.payload as any, fetchedAt: new Date(), ttlMinutes },
        });
      }

      await this.prisma.ingestRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), status: 'ok', itemsFetched: hazards.length } });
      this.logger.log(`Ingest ${source}: ${hazards.length} items`);
    } catch (err: any) {
      await this.prisma.ingestRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), status: 'failed', error: err.message } });
      this.logger.error(`Ingest ${source} failed: ${err.message}`);
    }
  }
}
