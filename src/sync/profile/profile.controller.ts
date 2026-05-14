import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
  @ApiOperation({
    summary: 'Get mobile user profile',
    description:
      'Returns the profile for the currently authenticated mobile user. ' +
      '**Important:** For first-time Firebase users, this returns 404 until ' +
      '`PUT /v1/sync/profile` is called to create the profile.',
  })
  @ApiResponse({ status: 200, description: 'Profile found' })
  @ApiResponse({ status: 404, description: 'Profile not found — call PUT to create' })
  async get(@CurrentUser() user: AuthUser) {
    const data = await this.profileService.get(user.sub);
    return { data };
  }

  @Put()
  @UseGuards(SurvivalDataGuard)
  @ApiOperation({
    summary: 'Update or create mobile user profile',
    description:
      'Upserts the mobile user profile. **Required for first-time users** ' +
      'immediately after Firebase login to provision the record in the database.',
  })
  @ApiResponse({ status: 200, description: 'Profile updated/created' })
  async update(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    const data = await this.profileService.upsert(user.sub, dto);
    return { data };
  }
}
