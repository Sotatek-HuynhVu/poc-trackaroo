import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { validate } from './common/config/env.schema';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './common/auth/auth.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppExceptionFilter } from './common/filters/app-exception.filter';
import { HealthController } from './health/health.controller';
import { OcsModule } from './ocs/ocs.module';
import { SyncModule } from './sync/sync.module';
import { HaztrackModule } from './haztrack/haztrack.module';
import { TrackiqModule } from './trackiq/trackiq.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    OcsModule,
    SyncModule,
    HaztrackModule,
    TrackiqModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})
export class AppModule {}
