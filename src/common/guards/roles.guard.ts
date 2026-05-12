import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, KIND_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredKind = this.reflector.getAllAndOverride<string>(KIND_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredKind && !requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    if (requiredKind && user.kind !== requiredKind) {
      throw new ForbiddenException(`Requires ${requiredKind} token`);
    }

    if (requiredRoles && requiredRoles.length > 0) {
      if (!user.role || !requiredRoles.includes(user.role)) {
        throw new ForbiddenException(`Requires role: ${requiredRoles.join(' | ')}`);
      }
    }

    return true;
  }
}
