import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async login(email: string, _password: string) {
    // Mock login: any password accepted for POC demo
    // In production, Firebase handles auth — this endpoint won't exist

    // Try OCS user first
    const ocsUser = await this.prisma.ocsUser.findUnique({ where: { email } });
    if (ocsUser) {
      const token = this.signToken({ sub: ocsUser.id, role: ocsUser.role, kind: 'ocs' });
      return { token, user: { id: ocsUser.id, email: ocsUser.email, displayName: ocsUser.displayName, role: ocsUser.role, kind: 'ocs' } };
    }

    // Try mobile user (lookup by displayName as email proxy for POC)
    const mobileUser = await this.prisma.mobileUser.findFirst({
      where: { OR: [{ firebaseUid: email }, { displayName: email }] },
    });
    if (mobileUser) {
      const token = this.signToken({ sub: mobileUser.firebaseUid, role: null, kind: 'mobile' });
      return { token, user: { id: mobileUser.firebaseUid, displayName: mobileUser.displayName, archetype: mobileUser.archetype, kind: 'mobile' } };
    }

    throw new UnauthorizedException('User not found');
  }

  private signToken(payload: { sub: string; role: string | null; kind: string }): string {
    const secret = this.config.get<string>('AUTH_JWT_SECRET')!;
    return jwt.sign(payload, secret, { expiresIn: '30d' });
  }
}
