import { Module } from '@nestjs/common';
import { ScoreController } from './score/score.controller';
import { ScoreService } from './score/score.service';

@Module({
  controllers: [ScoreController],
  providers: [ScoreService],
})
export class TrackiqModule {}
