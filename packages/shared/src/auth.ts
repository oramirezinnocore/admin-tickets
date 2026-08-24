import { UserRole } from './enums';

/**
 * Check if a role can perform operational admin tasks
 * (tickets, clients, technicians, map)
 */
export function isOperationalAdmin(role: UserRole | string): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

/**
 * Check if a role can manage administrators
 * (create, edit, activate/deactivate other admins)
 */
export function canManageAdministrators(role: UserRole | string): boolean {
  return role === UserRole.SUPER_ADMIN;
}

/**
 * Check if a role is super admin
 */
export function isSuperAdmin(role: UserRole | string): boolean {
  return role === UserRole.SUPER_ADMIN;
}

/**
 * Check if a role is any kind of admin (ADMIN or SUPER_ADMIN)
 */
export function isAnyAdmin(role: UserRole | string): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}
