import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from './current-user.decorator';
import { FirebaseAuthService } from './firebase-auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private firebaseAuth: FirebaseAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('AUTH_JWT_SECRET')!,
      passReqToCallback: true,
    });
  }

  async authenticate(req: any, options?: any) {
    const provider = this.config.get<string>('AUTH_PROVIDER');
    if (provider === 'firebase') {
      const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      if (!token) {
        return this.fail({ message: 'Missing token' }, 401);
      }
      try {
        const user = await this.firebaseAuth.verifyToken(token);
        return this.success(user);
      } catch (e: any) {
        return this.error(new UnauthorizedException(e.message ?? 'Invalid Firebase token'));
      }
    }
    return super.authenticate(req, options);
  }

  async validate(req: any, payload: any): Promise<AuthUser> {
    const provider = this.config.get<string>('AUTH_PROVIDER');

    if (provider === 'firebase') {
      const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      if (!token) throw new UnauthorizedException('Missing token');
      return this.firebaseAuth.verifyToken(token);
    }

    return { sub: payload.sub, role: payload.role ?? null, kind: payload.kind };
  }
}
