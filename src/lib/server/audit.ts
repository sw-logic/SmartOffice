import { prisma } from './prisma';
import type { RequestEvent } from '@sveltejs/kit';

export type AuditAction =
	| 'created'
	| 'updated'
	| 'deleted'
	| 'restored'
	| 'exported'
	| 'login'
	| 'logout'
	| 'login_failed'
	| 'password_changed'
	| 'permission_changed';

export interface AuditLogParams {
	userId: string;
	action: AuditAction;
	module: string;
	entityId?: string;
	entityType?: string;
	oldValues?: Record<string, unknown>;
	newValues?: Record<string, unknown>;
	ipAddress?: string;
	userAgent?: string;
}

/**
 * Create an audit log entry
 * @param params - Audit log parameters
 */
export async function logAction(params: AuditLogParams): Promise<void> {
	try {
		await prisma.auditLog.create({
			data: {
				userId: params.userId,
				action: params.action,
				module: params.module,
				entityId: params.entityId,
				entityType: params.entityType,
				oldValues: params.oldValues as object | undefined,
				newValues: params.newValues as object | undefined,
				ipAddress: params.ipAddress,
				userAgent: params.userAgent
			}
		});
	} catch (error) {
		// Log to console but don't throw - audit logging should not break the main operation
		console.error('Failed to create audit log:', error);
	}
}

/**
 * Helper to extract client info from request
 * @param event - SvelteKit request event
 * @returns Object with ipAddress and userAgent
 */
export function getClientInfo(event: RequestEvent): {
	ipAddress: string | undefined;
	userAgent: string | undefined;
} {
	const ipAddress =
		event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		event.request.headers.get('x-real-ip') ||
		event.getClientAddress();

	const userAgent = event.request.headers.get('user-agent') || undefined;

	return { ipAddress, userAgent };
}

/**
 * Log a create action
 */
export async function logCreate(
	userId: string,
	module: string,
	entityId: string,
	entityType: string,
	newValues: Record<string, unknown>,
	event?: RequestEvent
): Promise<void> {
	const clientInfo = event ? getClientInfo(event) : {};
	await logAction({
		userId,
		action: 'created',
		module,
		entityId,
		entityType,
		newValues,
		...clientInfo
	});
}

/**
 * Log an update action
 */
export async function logUpdate(
	userId: string,
	module: string,
	entityId: string,
	entityType: string,
	oldValues: Record<string, unknown>,
	newValues: Record<string, unknown>,
	event?: RequestEvent
): Promise<void> {
	const clientInfo = event ? getClientInfo(event) : {};
	await logAction({
		userId,
		action: 'updated',
		module,
		entityId,
		entityType,
		oldValues,
		newValues,
		...clientInfo
	});
}

/**
 * Log a delete action
 */
export async function logDelete(
	userId: string,
	module: string,
	entityId: string,
	entityType: string,
	oldValues: Record<string, unknown>,
	event?: RequestEvent
): Promise<void> {
	const clientInfo = event ? getClientInfo(event) : {};
	await logAction({
		userId,
		action: 'deleted',
		module,
		entityId,
		entityType,
		oldValues,
		...clientInfo
	});
}

/**
 * Log a login action
 */
export async function logLogin(
	userId: string,
	success: boolean,
	event?: RequestEvent
): Promise<void> {
	const clientInfo = event ? getClientInfo(event) : {};
	await logAction({
		userId,
		action: success ? 'login' : 'login_failed',
		module: 'auth',
		...clientInfo
	});
}

/**
 * Log a logout action
 */
export async function logLogout(userId: string, event?: RequestEvent): Promise<void> {
	const clientInfo = event ? getClientInfo(event) : {};
	await logAction({
		userId,
		action: 'logout',
		module: 'auth',
		...clientInfo
	});
}

/**
 * Log an export action
 */
export async function logExport(
	userId: string,
	module: string,
	details: Record<string, unknown>,
	event?: RequestEvent
): Promise<void> {
	const clientInfo = event ? getClientInfo(event) : {};
	await logAction({
		userId,
		action: 'exported',
		module,
		newValues: details,
		...clientInfo
	});
}

/**
 * Get recent audit logs for an entity
 */
export async function getEntityAuditLogs(
	module: string,
	entityId: string,
	limit = 50
): Promise<
	Array<{
		id: number;
		action: string;
		oldValues: unknown;
		newValues: unknown;
		createdAt: Date;
		user: { name: string; email: string };
	}>
> {
	return prisma.auditLog.findMany({
		where: {
			module,
			entityId
		},
		orderBy: { createdAt: 'desc' },
		take: limit,
		select: {
			id: true,
			action: true,
			oldValues: true,
			newValues: true,
			createdAt: true,
			user: {
				select: {
					name: true,
					email: true
				}
			}
		}
	});
}

/**
 * Get recent audit logs for a user
 */
export async function getUserAuditLogs(
	userId: string,
	limit = 50
): Promise<
	Array<{
		id: number;
		action: string;
		module: string;
		entityType: string | null;
		createdAt: Date;
	}>
> {
	return prisma.auditLog.findMany({
		where: { userId },
		orderBy: { createdAt: 'desc' },
		take: limit,
		select: {
			id: true,
			action: true,
			module: true,
			entityType: true,
			createdAt: true
		}
	});
}
