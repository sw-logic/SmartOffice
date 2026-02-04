import { error } from '@sveltejs/kit';
import { prisma } from './prisma';

export interface SessionUser {
	id: string;
	email: string;
	name: string;
	companyId?: string;
}

export interface Locals {
	user: SessionUser | null;
}

/**
 * Check if a user has a specific permission
 * @param userId - The user's ID
 * @param module - The module name (e.g., "clients", "finances.income")
 * @param action - The action (e.g., "read", "create", "update", "delete")
 * @returns True if user has the permission
 */
export async function checkPermission(
	userId: string,
	module: string,
	action: string
): Promise<boolean> {
	// Get all user's groups and their permissions
	const userWithPermissions = await prisma.user.findUnique({
		where: { id: userId },
		include: {
			userGroups: {
				include: {
					userGroup: {
						include: {
							permissions: {
								include: {
									permission: true
								}
							}
						}
					}
				}
			}
		}
	});

	if (!userWithPermissions) {
		return false;
	}

	// Check if any of the user's groups have the required permission
	for (const userGroup of userWithPermissions.userGroups) {
		for (const groupPermission of userGroup.userGroup.permissions) {
			const perm = groupPermission.permission;
			if (perm.module === module && perm.action === action) {
				return true;
			}
			// Check for wildcard permissions (e.g., "clients.*" or "*.*")
			if (perm.module === '*' && perm.action === '*') {
				return true;
			}
			if (perm.module === module && perm.action === '*') {
				return true;
			}
		}
	}

	return false;
}

/**
 * Require a specific permission, throw 403 if not authorized
 * @param locals - The SvelteKit locals object containing user info
 * @param module - The module name
 * @param action - The action
 * @throws 401 if not authenticated, 403 if not authorized
 */
export async function requirePermission(
	locals: Locals,
	module: string,
	action: string
): Promise<void> {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	const hasPermission = await checkPermission(locals.user.id, module, action);

	if (!hasPermission) {
		throw error(403, `Not authorized to ${action} ${module}`);
	}
}

/**
 * Get all permissions for a user
 * @param userId - The user's ID
 * @returns Array of permission objects
 */
export async function getUserPermissions(userId: string): Promise<Array<{ id: string; module: string; action: string; description: string | null }>> {
	const userWithPermissions = await prisma.user.findUnique({
		where: { id: userId },
		include: {
			userGroups: {
				include: {
					userGroup: {
						include: {
							permissions: {
								include: {
									permission: true
								}
							}
						}
					}
				}
			}
		}
	});

	if (!userWithPermissions) {
		return [];
	}

	// Collect all unique permissions
	const permissionsMap = new Map<string, { id: string; module: string; action: string; description: string | null }>();

	for (const userGroup of userWithPermissions.userGroups) {
		for (const groupPermission of userGroup.userGroup.permissions) {
			const perm = groupPermission.permission;
			const key = `${perm.module}.${perm.action}`;
			if (!permissionsMap.has(key)) {
				permissionsMap.set(key, perm);
			}
		}
	}

	return Array.from(permissionsMap.values());
}

/**
 * Check if user has any of the given permissions
 * @param userId - The user's ID
 * @param permissions - Array of {module, action} to check
 * @returns True if user has any of the permissions
 */
export async function hasAnyPermission(
	userId: string,
	permissions: Array<{ module: string; action: string }>
): Promise<boolean> {
	for (const perm of permissions) {
		if (await checkPermission(userId, perm.module, perm.action)) {
			return true;
		}
	}
	return false;
}

/**
 * Check if user has all of the given permissions
 * @param userId - The user's ID
 * @param permissions - Array of {module, action} to check
 * @returns True if user has all permissions
 */
export async function hasAllPermissions(
	userId: string,
	permissions: Array<{ module: string; action: string }>
): Promise<boolean> {
	for (const perm of permissions) {
		if (!(await checkPermission(userId, perm.module, perm.action))) {
			return false;
		}
	}
	return true;
}
