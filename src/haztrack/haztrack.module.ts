import { Module } from '@nestjs/common';
import { HazardsController } from './hazards/hazards.controller';
import { HazardsService } from './hazards/hazards.service';
import { IngestionService } from './ingestion/ingestion.service';

@Module({
  controllers: [HazardsController],
  providers: [HazardsService, IngestionService],
})
export class HaztrackModule {}
