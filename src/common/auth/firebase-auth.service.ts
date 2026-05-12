import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { AuthUser } from './current-user.decorator';

@Injectable()
export class FirebaseAuthService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAuthService.name);
  private app: admin.app.App | null = null;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const provider = this.config.get<string>('AUTH_PROVIDER');
    if (provider !== 'firebase') return;

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Firebase config incomplete: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY required');
    }

    this.app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });

    this.logger.log(`Firebase Admin initialized for project: ${projectId}`);
  }

  async verifyToken(idToken: string): Promise<AuthUser> {
    if (!this.app) {
      throw new Error('Firebase not initialized — set AUTH_PROVIDER=firebase with valid credentials');
    }

    const decoded = await admin.auth(this.app).verifyIdToken(idToken);

    // OCS users have custom claims: { role: 'project_director'|'operations'|'contributor', kind: 'ocs' }
    // Mobile users default to kind: 'mobile'
    const kind = (decoded.kind as 'ocs' | 'mobile') ?? 'mobile';
    const role = (decoded.role as string) ?? null;

    return { sub: decoded.uid, role, kind };
  }
}
