/**
 * @hazeljs/auth - Authentication module for HazelJS
 */

export { AuthGuard, Auth } from './auth.guard';
export { AuthService } from './auth.service';
export type { AuthUser } from './auth.service';
export { JwtModule } from './jwt/jwt.module';
export { JwtService } from './jwt/jwt.service';
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { RoleGuard } from './guards/role.guard';
export type { RoleGuardOptions } from './guards/role.guard';
export { TenantGuard } from './guards/tenant.guard';
export type { TenantGuardOptions } from './guards/tenant.guard';
export { TenantContext } from './tenant/tenant-context';
export { RoleHierarchy, DEFAULT_ROLE_HIERARCHY } from './utils/role-hierarchy';
export type { RoleHierarchyMap } from './utils/role-hierarchy';
export { CurrentUser } from './decorators/current-user.decorator';
