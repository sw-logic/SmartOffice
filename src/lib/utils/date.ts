import {
	format,
	formatDistance,
	formatRelative,
	parseISO,
	isValid,
	startOfDay,
	endOfDay,
	startOfWeek,
	endOfWeek,
	startOfMonth,
	endOfMonth,
	startOfYear,
	endOfYear,
	addDays,
	addWeeks,
	addMonths,
	addYears,
	subDays,
	subWeeks,
	subMonths,
	subYears,
	differenceInDays,
	differenceInWeeks,
	differenceInMonths,
	differenceInYears,
	isBefore,
	isAfter,
	isWithinInterval
} from 'date-fns';

// Default date format
const DEFAULT_DATE_FORMAT = 'yyyy.MM.dd';
const DEFAULT_DATETIME_FORMAT = 'yyyy.MM.dd HH:mm';
const DEFAULT_TIME_FORMAT = 'h:mm a';
const ISO_DATE_FORMAT = 'yyyy-MM-dd';

/**
 * Parse a date string or Date object
 */
export function parseDate(date: string | Date | null | undefined): Date | null {
	if (!date) return null;
	if (date instanceof Date) return isValid(date) ? date : null;
	const parsed = parseISO(date);
	return isValid(parsed) ? parsed : null;
}

/**
 * Format a date for display
 */
export function formatDate(
	date: string | Date | null | undefined,
	formatStr = DEFAULT_DATE_FORMAT
): string {
	const parsed = parseDate(date);
	if (!parsed) return '';
	return format(parsed, formatStr);
}

/**
 * Format a date with time
 */
export function formatDateTime(
	date: string | Date | null | undefined,
	formatStr = DEFAULT_DATETIME_FORMAT
): string {
	const parsed = parseDate(date);
	if (!parsed) return '';
	return format(parsed, formatStr);
}

/**
 * Format time only
 */
export function formatTime(
	date: string | Date | null | undefined,
	formatStr = DEFAULT_TIME_FORMAT
): string {
	const parsed = parseDate(date);
	if (!parsed) return '';
	return format(parsed, formatStr);
}

/**
 * Format date as ISO string (for form inputs)
 */
export function toISODate(date: string | Date | null | undefined): string {
	const parsed = parseDate(date);
	if (!parsed) return '';
	return format(parsed, ISO_DATE_FORMAT);
}

/**
 * Format as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(
	date: string | Date | null | undefined,
	baseDate: Date = new Date()
): string {
	const parsed = parseDate(date);
	if (!parsed) return '';
	return formatDistance(parsed, baseDate, { addSuffix: true });
}

/**
 * Format as relative date (e.g., "yesterday at 5:00 PM")
 */
export function formatRelativeDate(
	date: string | Date | null | undefined,
	baseDate: Date = new Date()
): string {
	const parsed = parseDate(date);
	if (!parsed) return '';
	return formatRelative(parsed, baseDate);
}

/**
 * Get date range boundaries
 */
export const dateRanges = {
	today: () => ({
		start: startOfDay(new Date()),
		end: endOfDay(new Date())
	}),
	yesterday: () => ({
		start: startOfDay(subDays(new Date(), 1)),
		end: endOfDay(subDays(new Date(), 1))
	}),
	thisWeek: () => ({
		start: startOfWeek(new Date()),
		end: endOfWeek(new Date())
	}),
	lastWeek: () => ({
		start: startOfWeek(subWeeks(new Date(), 1)),
		end: endOfWeek(subWeeks(new Date(), 1))
	}),
	thisMonth: () => ({
		start: startOfMonth(new Date()),
		end: endOfMonth(new Date())
	}),
	lastMonth: () => ({
		start: startOfMonth(subMonths(new Date(), 1)),
		end: endOfMonth(subMonths(new Date(), 1))
	}),
	thisYear: () => ({
		start: startOfYear(new Date()),
		end: endOfYear(new Date())
	}),
	lastYear: () => ({
		start: startOfYear(subYears(new Date(), 1)),
		end: endOfYear(subYears(new Date(), 1))
	}),
	last7Days: () => ({
		start: startOfDay(subDays(new Date(), 6)),
		end: endOfDay(new Date())
	}),
	last30Days: () => ({
		start: startOfDay(subDays(new Date(), 29)),
		end: endOfDay(new Date())
	}),
	last90Days: () => ({
		start: startOfDay(subDays(new Date(), 89)),
		end: endOfDay(new Date())
	}),
	last12Months: () => ({
		start: startOfDay(subMonths(new Date(), 12)),
		end: endOfDay(new Date())
	})
};

/**
 * Check if a date is within a range
 */
export function isDateInRange(
	date: string | Date | null | undefined,
	start: Date,
	end: Date
): boolean {
	const parsed = parseDate(date);
	if (!parsed) return false;
	return isWithinInterval(parsed, { start, end });
}

/**
 * Check if a date is in the past
 */
export function isPast(date: string | Date | null | undefined): boolean {
	const parsed = parseDate(date);
	if (!parsed) return false;
	return isBefore(parsed, new Date());
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: string | Date | null | undefined): boolean {
	const parsed = parseDate(date);
	if (!parsed) return false;
	return isAfter(parsed, new Date());
}

/**
 * Calculate the difference between two dates
 */
export function dateDifference(
	start: string | Date,
	end: string | Date,
	unit: 'days' | 'weeks' | 'months' | 'years' = 'days'
): number {
	const startDate = parseDate(start);
	const endDate = parseDate(end);
	if (!startDate || !endDate) return 0;

	switch (unit) {
		case 'days':
			return differenceInDays(endDate, startDate);
		case 'weeks':
			return differenceInWeeks(endDate, startDate);
		case 'months':
			return differenceInMonths(endDate, startDate);
		case 'years':
			return differenceInYears(endDate, startDate);
	}
}

/**
 * Add time to a date
 */
export function addToDate(
	date: string | Date,
	amount: number,
	unit: 'days' | 'weeks' | 'months' | 'years' = 'days'
): Date {
	const parsed = parseDate(date) || new Date();

	switch (unit) {
		case 'days':
			return addDays(parsed, amount);
		case 'weeks':
			return addWeeks(parsed, amount);
		case 'months':
			return addMonths(parsed, amount);
		case 'years':
			return addYears(parsed, amount);
	}
}

/**
 * Get due date status for payment terms
 */
export function getDueDateStatus(
	date: string | Date | null | undefined,
	paymentTerms: number
): 'overdue' | 'due_soon' | 'ok' {
	const parsed = parseDate(date);
	if (!parsed) return 'ok';

	const dueDate = addDays(parsed, paymentTerms);
	const today = new Date();

	if (isBefore(dueDate, today)) {
		return 'overdue';
	}

	const daysUntilDue = differenceInDays(dueDate, today);
	if (daysUntilDue <= 7) {
		return 'due_soon';
	}

	return 'ok';
}
