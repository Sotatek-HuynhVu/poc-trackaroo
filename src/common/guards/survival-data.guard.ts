import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { SurvivalDataRejectedError } from '../errors/errors';

const FORBIDDEN_KEYS = /^(breadcrumbs?|sos|gps_fix|location_history)$/i;

@Injectable()
export class SurvivalDataGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const body = request.body;
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      for (const key of Object.keys(body)) {
        if (FORBIDDEN_KEYS.test(key)) {
          throw new SurvivalDataRejectedError();
        }
      }
    }
    return true;
  }
}
