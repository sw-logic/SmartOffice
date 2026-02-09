import { z } from 'zod';

// Common validation schemas

/**
 * Email validation
 */
export const emailSchema = z.string().email('Invalid email address').min(1, 'Email is required');

/**
 * Password validation with requirements
 */
export const passwordSchema = z
	.string()
	.min(8, 'Password must be at least 8 characters')
	.regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
	.regex(/[a-z]/, 'Password must contain at least one lowercase letter')
	.regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Simple password (less strict, for development)
 */
export const simplePasswordSchema = z.string().min(6, 'Password must be at least 6 characters');

/**
 * Phone number validation (basic)
 */
export const phoneSchema = z
	.string()
	.regex(/^[\d\s+\-().]+$/, 'Invalid phone number format')
	.optional()
	.or(z.literal(''));

/**
 * URL validation
 */
export const urlSchema = z.string().url('Invalid URL').optional().or(z.literal(''));

/**
 * Currency amount validation
 */
export const amountSchema = z
	.number()
	.positive('Amount must be positive')
	.multipleOf(0.01, 'Amount can have at most 2 decimal places');

/**
 * Amount as string (from form input)
 */
export const amountStringSchema = z
	.string()
	.refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
		message: 'Amount must be a positive number'
	})
	.transform(val => parseFloat(val));

/**
 * Tax rate validation (0-100)
 */
export const taxRateSchema = z
	.number()
	.min(0, 'Tax rate cannot be negative')
	.max(100, 'Tax rate cannot exceed 100%');

/**
 * Date string validation
 */
export const dateStringSchema = z.string().refine(
	val => {
		const date = new Date(val);
		return !isNaN(date.getTime());
	},
	{ message: 'Invalid date' }
);

/**
 * Required string (non-empty)
 */
export const requiredString = (fieldName: string) =>
	z.string().min(1, `${fieldName} is required`).trim();

/**
 * Optional string (empty string becomes undefined)
 */
export const optionalString = z
	.string()
	.trim()
	.transform(val => (val === '' ? undefined : val))
	.optional();

/**
 * Status enum for common entities
 */
export const statusSchema = z.enum(['active', 'inactive', 'archived']);

/**
 * Project status schema
 */
export const projectStatusSchema = z.enum([
	'planning',
	'active',
	'on_hold',
	'completed',
	'cancelled'
]);

/**
 * Priority schema
 */
export const prioritySchema = z.enum(['low', 'medium', 'high']);

/**
 * Payment method schema
 */
export const paymentMethodSchema = z.enum([
	'bank_transfer',
	'cash',
	'credit_card',
	'check',
	'other'
]);

/**
 * Payment status schema
 */
export const paymentStatusSchema = z.enum(['pending', 'completed', 'failed', 'cancelled']);


/**
 * Employment type schema
 */
export const employmentTypeSchema = z.enum(['full-time', 'part-time', 'contractor']);

/**
 * Currency code validation
 */
export const currencyCodeSchema = z
	.string()
	.length(3, 'Currency code must be 3 characters')
	.toUpperCase();

/**
 * VAT/Tax ID validation (basic)
 */
export const taxIdSchema = z
	.string()
	.regex(/^[A-Z0-9\-]+$/i, 'Invalid tax ID format')
	.optional()
	.or(z.literal(''));

// Utility functions

/**
 * Validate and return result without throwing
 */
export function safeValidate<T>(
	schema: z.ZodSchema<T>,
	data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
	const result = schema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, errors: result.error };
}

/**
 * Format Zod errors for display
 */
export function formatZodErrors(errors: z.ZodError): Record<string, string> {
	const formatted: Record<string, string> = {};
	for (const error of errors.issues) {
		const path = error.path.join('.');
		if (!formatted[path]) {
			formatted[path] = error.message;
		}
	}
	return formatted;
}

/**
 * Create a schema for pagination
 */
export const paginationSchema = z.object({
	page: z.number().int().positive().default(1),
	limit: z.number().int().positive().max(100).default(20),
	sortBy: z.string().optional(),
	sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export type PaginationParams = z.infer<typeof paginationSchema>;

/**
 * Create a search/filter schema
 */
export const searchSchema = z.object({
	query: z.string().optional(),
	status: z.string().optional(),
	dateFrom: z.string().optional(),
	dateTo: z.string().optional()
});

export type SearchParams = z.infer<typeof searchSchema>;
