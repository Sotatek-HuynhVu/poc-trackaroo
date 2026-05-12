import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { FirebaseAuthService } from './firebase-auth.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [JwtStrategy, FirebaseAuthService, AuthService],
  exports: [PassportModule, FirebaseAuthService],
})
export class AuthModule {}
