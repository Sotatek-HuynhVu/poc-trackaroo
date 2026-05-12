import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HazardsService } from './hazards.service';

@ApiTags('HazTrack')
@Controller('v1/haztrack')
@Public()
export class HazardsController {
  constructor(private hazardsService: HazardsService) {}

  @Get('hazards')
  @ApiOperation({ summary: 'List hazards with age bucket' })
  async findAll() {
    const data = await this.hazardsService.findAll();
    return { data };
  }

  @Get('sources/status')
  @ApiOperation({ summary: 'Ingestion source status' })
  async sourcesStatus() {
    const data = await this.hazardsService.getSourcesStatus();
    return { data };
  }
}
