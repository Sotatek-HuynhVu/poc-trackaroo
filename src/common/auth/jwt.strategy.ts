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
