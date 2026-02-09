import { error, redirect } from '@sveltejs/kit';
import { prisma } from './prisma';

export interface SessionUser {
	id: number;
	email: string;
	name: string;
	companyId?: number;
}

export interface Locals {
	user?: SessionUser | null;
	/** Pre-loaded permission strings for the current user (populated once per request in hooks). */
	permissions?: Set<string>;
}

// ── Permission loading (called once per request in hooks.server.ts) ──────────

/**
 * Load all permissions for a user from the database and return them as a Set
 * of "module.action" strings. Called once per request in the authorization hook.
 */
export async function loadUserPermissions(userId: number): Promise<Set<string>> {
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

	const permSet = new Set<string>();
	if (!userWithPermissions) return permSet;

	for (const ugu of userWithPermissions.userGroups) {
		for (const gp of ugu.userGroup.permissions) {
			permSet.add(`${gp.permission.module}.${gp.permission.action}`);
		}
	}

	return permSet;
}

// ── Permission checks (synchronous — read from pre-loaded Set) ───────────────

/**
 * Check whether the pre-loaded permission set satisfies a module + action.
 * Handles wildcard matching: `*.*` (global admin) and `module.*`.
 */
function matchPermission(permissions: Set<string>, module: string, action: string): boolean {
	if (permissions.has('*.*')) return true;
	if (permissions.has(`${module}.*`)) return true;
	if (permissions.has(`${module}.${action}`)) return true;
	return false;
}

/**
 * Check if the current user has a specific permission.
 * Reads from the pre-loaded permission Set — no database query.
 */
export function checkPermission(
	locals: Locals,
	module: string,
	action: string
): boolean {
	if (!locals.permissions) return false;
	return matchPermission(locals.permissions, module, action);
}

/**
 * Require a specific permission. Throws a redirect if the user is not
 * authenticated or does not have the permission.
 */
export function requirePermission(
	locals: Locals,
	module: string,
	action: string,
	url?: URL
): void {
	if (!locals.user) {
		const callbackUrl = url ? `?callbackUrl=${encodeURIComponent(url.pathname)}` : '';
		redirect(303, `/login${callbackUrl}`);
	}

	if (!checkPermission(locals, module, action)) {
		const callbackUrl = url ? `?callbackUrl=${encodeURIComponent(url.pathname)}&error=access_denied` : '?error=access_denied';
		redirect(303, `/login${callbackUrl}`);
	}
}

/**
 * Check if the current user is an admin (has wildcard `*.*` permission).
 */
export function isAdmin(locals: Locals): boolean {
	return checkPermission(locals, '*', '*');
}

/**
 * Check if user has any of the given permissions.
 */
export function hasAnyPermission(
	locals: Locals,
	permissions: Array<{ module: string; action: string }>
): boolean {
	for (const perm of permissions) {
		if (checkPermission(locals, perm.module, perm.action)) {
			return true;
		}
	}
	return false;
}

/**
 * Check if user has all of the given permissions.
 */
export function hasAllPermissions(
	locals: Locals,
	permissions: Array<{ module: string; action: string }>
): boolean {
	for (const perm of permissions) {
		if (!checkPermission(locals, perm.module, perm.action)) {
			return false;
		}
	}
	return true;
}

// ── Full permission list (for admin UI — still queries DB) ───────────────────

/**
 * Get all permissions for any user (used by admin pages to display/manage
 * another user's permissions). This still queries the DB.
 */
export async function getUserPermissions(userId: number): Promise<Array<{ id: number; module: string; action: string; description: string | null }>> {
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

	const permissionsMap = new Map<string, { id: number; module: string; action: string; description: string | null }>();

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

// ── Row-level access control ────────────────────────────────────────────────

/**
 * Check if the current user can access a specific project.
 * Access is granted if the user is:
 *   - An admin (wildcard permission)
 *   - The project manager
 *   - An assigned project member (via ProjectEmployee)
 */
export async function canAccessProject(locals: Locals, projectId: number): Promise<boolean> {
	if (isAdmin(locals)) return true;

	if (!locals.user) return false;

	const project = await prisma.project.findFirst({
		where: {
			id: projectId,
			OR: [
				{ projectManagerId: locals.user.id },
				{ assignedEmployees: { some: { userId: locals.user.id } } }
			]
		},
		select: { id: true }
	});

	return !!project;
}

/**
 * Check if the current user is the project manager for a given project.
 */
export async function isProjectManager(locals: Locals, projectId: number): Promise<boolean> {
	if (!locals.user) return false;

	const project = await prisma.project.findFirst({
		where: { id: projectId, projectManagerId: locals.user.id },
		select: { id: true }
	});

	return !!project;
}
