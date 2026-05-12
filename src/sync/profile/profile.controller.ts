import { Controller, Get, Put, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequireKind } from '../../common/decorators/roles.decorator';
import { SurvivalDataGuard } from '../../common/guards/survival-data.guard';
import { CurrentUser, AuthUser } from '../../common/auth/current-user.decorator';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/profile.dto';

@ApiTags('Sync')
@ApiBearerAuth()
@Controller('v1/sync/profile')
@RequireKind('mobile')
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get mobile user profile' })
  async get(@CurrentUser() user: AuthUser) {
    const data = await this.profileService.get(user.sub);
    return { data };
  }

  @Put()
  @UseGuards(SurvivalDataGuard)
  @ApiOperation({ summary: 'Update mobile user profile' })
  async update(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    const data = await this.profileService.upsert(user.sub, dto);
    return { data };
  }
}
