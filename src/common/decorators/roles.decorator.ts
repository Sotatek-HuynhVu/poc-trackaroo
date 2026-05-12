import { SetMetadata } from '@nestjs/common';

export type UserKind = 'ocs' | 'mobile';
export type OcsRoleName = 'project_director' | 'operations' | 'contributor';

export const ROLES_KEY = 'roles';
export const KIND_KEY = 'userKind';

export const Roles = (...roles: OcsRoleName[]) => SetMetadata(ROLES_KEY, roles);
export const RequireKind = (kind: UserKind) => SetMetadata(KIND_KEY, kind);
