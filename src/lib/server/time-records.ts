import { prisma } from './prisma';

/**
 * Recalculates and stores the total spentTime (in minutes) on a Task
 * by summing all non-deleted TimeRecord.minutes for that task.
 * Call this after every TimeRecord create, update, or delete.
 */
export async function recalcTaskSpentTime(taskId: number): Promise<void> {
	const result = await prisma.timeRecord.aggregate({
		where: { taskId },
		_sum: { minutes: true }
	});

	await prisma.task.update({
		where: { id: taskId },
		data: { spentTime: result._sum.minutes ?? 0 }
	});
}

/**
 * Recalculates and stores the total spentTime (in minutes) on a Service
 * by summing all TimeRecord.minutes for that service.
 * Call this after every TimeRecord create, update, or delete.
 */
export async function recalcServiceSpentTime(serviceId: number): Promise<void> {
	const result = await prisma.timeRecord.aggregate({
		where: { serviceId },
		_sum: { minutes: true }
	});

	await prisma.service.update({
		where: { id: serviceId },
		data: { spentTime: result._sum.minutes ?? 0 }
	});
}

/**
 * Format minutes as "Xh Ym" for display.
 * Examples: 90 → "1h 30m", 60 → "1h 0m", 45 → "0h 45m"
 */
export function formatMinutes(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return `${h}h ${m}m`;
}
