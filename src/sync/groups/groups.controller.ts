import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RequireKind } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/current-user.decorator';
import { GroupsService } from './groups.service';
import { CreateGroupDto, AddMemberDto } from './dto/groups.dto';

@ApiTags('Sync')
@ApiBearerAuth()
@Controller('v1/sync/groups')
@RequireKind('mobile')
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Get()
  @ApiOperation({ summary: 'List user groups' })
  @ApiResponse({ status: 200, description: 'Groups found (may be empty array)' })
  async findAll(@CurrentUser() user: AuthUser) {
    const data = await this.groupsService.findByUser(user.sub);
    return { data };
  }

  @Post()
  @ApiOperation({ summary: 'Create group' })
  @ApiResponse({ status: 201, description: 'Group created' })
  async create(@Body() dto: CreateGroupDto, @CurrentUser() user: AuthUser) {
    const data = await this.groupsService.create(dto.name, user.sub);
    return { data };
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add member to group' })
  @ApiResponse({ status: 201, description: 'Member added' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async addMember(@Param('id') id: string, @Body() dto: AddMemberDto) {
    const data = await this.groupsService.addMember(id, dto.userUid);
    return { data };
  }
}
