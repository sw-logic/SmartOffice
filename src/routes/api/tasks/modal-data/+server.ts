import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';

/**
 * Returns the reference data needed by TaskDetailModal:
 * projects (with boards/columns/swimlanes), active employees, and task tags.
 * Lazy-loaded by pages that host the modal so the board/task list page
 * doesn't pay the cost on every initial load.
 */
export const GET: RequestHandler = async ({ locals }) => {
	await requirePermission(locals, 'projects', 'read');

	const [projects, employees, taskTagsEnumType] = await Promise.all([
		prisma.project.findMany({
			select: {
				id: true,
				name: true,
				client: { select: { id: true, name: true } },
				kanbanBoards: {
					select: {
						id: true,
						name: true,
						columns: {
							orderBy: { order: 'asc' },
							select: { id: true, name: true }
						},
						swimlanes: {
							orderBy: { order: 'asc' },
							select: { id: true, name: true }
						}
					}
				}
			},
			orderBy: { name: 'asc' }
		}),
		prisma.user.findMany({
			where: { employeeStatus: 'active' },
			select: { id: true, firstName: true, lastName: true },
			orderBy: { firstName: 'asc' }
		}),
		prisma.enumType.findUnique({
			where: { code: 'task_tags' },
			include: {
				values: {
					where: { isActive: true },
					orderBy: { sortOrder: 'asc' },
					select: { id: true, value: true, label: true, color: true }
				}
			}
		})
	]);

	return json({
		projects,
		employees,
		availableTags: taskTagsEnumType?.values || []
	});
};
