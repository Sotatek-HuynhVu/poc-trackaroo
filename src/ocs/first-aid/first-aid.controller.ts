import { Controller, Get, Post, Body, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { RequireKind, Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/current-user.decorator';
import { ValidationError } from '../../common/errors/errors';
import { FirstAidService } from './first-aid.service';
import { CreateDraftDto } from './dto/first-aid.dto';

@ApiTags('OCS')
@ApiBearerAuth()
@Controller('v1/ocs/first-aid')
@RequireKind('ocs')
export class FirstAidController {
  constructor(private firstAidService: FirstAidService) {}

  @Get()
  @ApiOperation({ summary: 'List first aid content' })
  async findAll() {
    const data = await this.firstAidService.findAll();
    return { data };
  }

  @Post()
  @Roles('contributor', 'operations', 'project_director')
  @ApiOperation({ summary: 'Create first aid draft' })
  async createDraft(@Body() dto: CreateDraftDto, @CurrentUser() user: AuthUser) {
    const data = await this.firstAidService.createDraft(dto, user.sub);
    return { data };
  }

  @Post(':id/release')
  @Roles('project_director')
  @ApiOperation({ summary: 'Release first aid content (requires attestation PDF)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('attestation'))
  async release(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    if (!file) throw new ValidationError('Clinical attestation PDF required (field: attestation)');
    const pdfUrl = `uploads/attestations/${id}-${Date.now()}.pdf`;
    const data = await this.firstAidService.release(id, pdfUrl, user.sub);
    return { data };
  }
}
