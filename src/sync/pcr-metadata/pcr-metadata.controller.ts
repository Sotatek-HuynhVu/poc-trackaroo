import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequireKind } from '../../common/decorators/roles.decorator';
import { SurvivalDataGuard } from '../../common/guards/survival-data.guard';
import { CurrentUser, AuthUser } from '../../common/auth/current-user.decorator';
import { PcrMetadataService } from './pcr-metadata.service';
import { CreateMetadataDto } from '../groups/dto/groups.dto';

@ApiTags('Sync')
@ApiBearerAuth()
@Controller('v1/sync/pcr-metadata')
@RequireKind('mobile')
export class PcrMetadataController {
  constructor(private pcrMetadataService: PcrMetadataService) {}

  @Get(':pcrId')
  @ApiOperation({ summary: 'Get PCR metadata' })
  async get(@Param('pcrId') pcrId: string, @CurrentUser() user: AuthUser) {
    const data = await this.pcrMetadataService.findByPcr(pcrId, user.sub);
    return { data };
  }

  @Post(':pcrId')
  @UseGuards(SurvivalDataGuard)
  @ApiOperation({ summary: 'Create PCR metadata' })
  async create(@Param('pcrId') pcrId: string, @Body() dto: CreateMetadataDto, @CurrentUser() user: AuthUser) {
    const data = await this.pcrMetadataService.create(pcrId, user.sub, dto);
    return { data };
  }
}
