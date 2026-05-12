import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ScoreService } from './score.service';
import { ScoreInputDto } from './dto/score.dto';

@ApiTags('TrackIQ')
@ApiBearerAuth()
@Controller('v1/trackiq')
export class ScoreController {
  constructor(private scoreService: ScoreService) {}

  @Post('score')
  @ApiOperation({ summary: 'Compute deterministic TrackIQ score' })
  score(@Body() dto: ScoreInputDto) {
    const data = this.scoreService.score(dto);
    return { data };
  }
}
