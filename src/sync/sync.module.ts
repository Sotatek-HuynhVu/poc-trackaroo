import { Module } from '@nestjs/common';
import { ProfileController } from './profile/profile.controller';
import { ProfileService } from './profile/profile.service';
import { GroupsController } from './groups/groups.controller';
import { GroupsService } from './groups/groups.service';
import { PcrMetadataController } from './pcr-metadata/pcr-metadata.controller';
import { PcrMetadataService } from './pcr-metadata/pcr-metadata.service';

@Module({
  controllers: [ProfileController, GroupsController, PcrMetadataController],
  providers: [ProfileService, GroupsService, PcrMetadataService],
})
export class SyncModule {}
