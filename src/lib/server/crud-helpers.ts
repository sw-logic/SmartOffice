import { error, fail } from '@sveltejs/kit';
import type { ActionFailure } from '@sveltejs/kit';
import { prisma } from './prisma';
import { logDelete } from './audit';
import { requirePermission } from './access-control';

// ---------------------------------------------------------------------------
// 1. parseListParams — Parse search/sort/page/limit from URL search params
// ---------------------------------------------------------------------------
// Usage:
//   const { search, sortBy, sortOrder, page, limit } = parseListParams(url, {
//       sortBy: 'name', sortOrder: 'asc', limit: 10
//   });

interface ListParamDefaults {
	sortBy?: string;
	sortOrder?: 'asc' | 'desc';
	limit?: number;
}

interface ListParams {
	search: string;
	sortBy: string;
	sortOrder: 'asc' | 'desc';
	page: number;
	limit: number;
}

export function parseListParams(url: URL, defaults?: ListParamDefaults): ListParams {
	const search = url.searchParams.get('search') || '';
	const sortBy = url.searchParams.get('sortBy') || defaults?.sortBy || 'name';
	const sortOrder = (url.searchParams.get('sortOrder') || defaults?.sortOrder || 'asc') as 'asc' | 'desc';
	const page = parseInt(url.searchParams.get('page') || '1') || 1;
	const limit = parseInt(url.searchParams.get('limit') || String(defaults?.limit || 10)) || (defaults?.limit || 10);
	return { search, sortBy, sortOrder, page, limit };
}

// ---------------------------------------------------------------------------
// 2. buildPagination — Build pagination object from page/limit/total
// ---------------------------------------------------------------------------
// Usage:
//   const pagination = buildPagination(page, limit, total);

export interface Pagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export function buildPagination(page: number, limit: number, total: number): Pagination {
	return {
		page,
		limit,
		total,
		totalPages: Math.ceil(total / limit)
	};
}

// ---------------------------------------------------------------------------
// 3. parseId — Parse int ID from route params, throw error(400) if invalid
// ---------------------------------------------------------------------------
// Usage (in load functions):
//   const clientId = parseId(params.id, 'client');

export function parseId(value: string, entityName: string): number {
	const id = parseInt(value);
	if (isNaN(id)) {
		error(400, `Invalid ${entityName} ID`);
	}
	return id;
}

// ---------------------------------------------------------------------------
// 4. parseFormId — Parse int ID from FormData, return fail(400) if invalid
// ---------------------------------------------------------------------------
// Usage (in form actions):
//   const result = parseFormId(formData, 'id', 'Client');
//   if ('error' in result) return result.error;
//   const { id } = result;

type ParseFormIdResult = { id: number } | { error: ActionFailure<{ error: string }> };

export function parseFormId(
	formData: FormData,
	field: string,
	entityName: string
): ParseFormIdResult {
	const idStr = formData.get(field) as string;
	if (!idStr) {
		return { error: fail(400, { error: `${entityName} ID is required` }) };
	}
	const id = parseInt(idStr);
	if (isNaN(id)) {
		return { error: fail(400, { error: `Invalid ${entityName} ID` }) };
	}
	return { id };
}

// ---------------------------------------------------------------------------
// 5. parseDateRange — Parse year/period → { year, period, startDate, endDate }
// ---------------------------------------------------------------------------
// Usage (in income/expenses list load):
//   const { year, period, startDate, endDate } = parseDateRange(url);

interface DateRange {
	year: number;
	period: string;
	startDate: Date;
	endDate: Date;
}

export function parseDateRange(url: URL): DateRange {
	const now = new Date();
	const year = parseInt(url.searchParams.get('year') || String(now.getFullYear()));
	const period = url.searchParams.get('period') || String(now.getMonth() + 1);

	let startDate: Date;
	let endDate: Date;

	if (period === 'q1') {
		startDate = new Date(year, 0, 1);
		endDate = new Date(year, 3, 0, 23, 59, 59, 999);
	} else if (period === 'q2') {
		startDate = new Date(year, 3, 1);
		endDate = new Date(year, 6, 0, 23, 59, 59, 999);
	} else if (period === 'q3') {
		startDate = new Date(year, 6, 1);
		endDate = new Date(year, 9, 0, 23, 59, 59, 999);
	} else if (period === 'q4') {
		startDate = new Date(year, 9, 1);
		endDate = new Date(year, 12, 0, 23, 59, 59, 999);
	} else if (period === 'year') {
		startDate = new Date(year, 0, 1);
		endDate = new Date(year, 12, 0, 23, 59, 59, 999);
	} else {
		const month = parseInt(period) || (now.getMonth() + 1);
		startDate = new Date(year, month - 1, 1);
		endDate = new Date(year, month, 0, 23, 59, 59, 999);
	}

	return { year, period, startDate, endDate };
}

// ---------------------------------------------------------------------------
// 6. serializeDecimals — Convert Prisma Decimal fields to Number
// ---------------------------------------------------------------------------
// Usage:
//   const serialized = serializeDecimals(income, ['amount', 'tax', 'tax_value']);

export function serializeDecimals<T extends Record<string, unknown>>(
	record: T,
	fields: (keyof T)[]
): T {
	const result = { ...record };
	for (const field of fields) {
		if (result[field] != null) {
			(result as Record<string, unknown>)[field as string] = Number(result[field]);
		}
	}
	return result;
}

// ---------------------------------------------------------------------------
// 7. calculateDueDate — date + paymentTermDays, or null
// ---------------------------------------------------------------------------
// Usage:
//   const dueDate = calculateDueDate(new Date(date), paymentTermDays);

export function calculateDueDate(date: Date | null, paymentTermDays: number | null): Date | null {
	if (!date || !paymentTermDays) return null;
	return new Date(date.getTime() + paymentTermDays * 86400000);
}

// ---------------------------------------------------------------------------
// 8. fetchDenormalizedName — Fetch entity name for denormalization
// ---------------------------------------------------------------------------
// Usage:
//   const clientName = await fetchDenormalizedName('client', parsedClientId);
//   const vendorName = await fetchDenormalizedName('vendor', parsedVendorId);

export async function fetchDenormalizedName(
	model: 'client' | 'vendor',
	id: number | null
): Promise<string | null> {
	if (!id) return null;
	const record = await (prisma[model] as any).findUnique({
		where: { id },
		select: { name: true }
	});
	return record?.name ?? null;
}

// ---------------------------------------------------------------------------
// 9. createDeleteAction — Factory for single-delete form actions
// ---------------------------------------------------------------------------
// Usage:
//   export const actions: Actions = {
//       delete: createDeleteAction({
//           permission: ['clients', 'delete'],
//           module: 'clients',
//           entityType: 'Client',
//           model: 'client',
//           findSelect: { id: true, name: true, companyName: true },
//           auditValues: (record) => ({ name: record.name, companyName: record.companyName }),
//       }),
//   };

interface DeleteActionConfig {
	permission: [string, string];
	module: string;
	entityType: string;
	model: string;
	findSelect: Record<string, boolean>;
	auditValues: (record: any) => Record<string, unknown>;
	validate?: (record: any, locals: any) => ActionFailure<{ error: string }> | null;
	beforeDelete?: (record: any) => Promise<void>;
	afterDelete?: (record: any) => void | Promise<void>;
}

export function createDeleteAction(config: DeleteActionConfig) {
	return async ({ locals, request }: { locals: any; request: Request }) => {
		await requirePermission(locals, config.permission[0], config.permission[1]);

		const formData = await request.formData();
		const result = parseFormId(formData, 'id', config.entityType);
		if ('error' in result) return result.error;
		const { id } = result;

		const record = await (prisma as any)[config.model].findUnique({
			where: { id },
			select: config.findSelect
		});

		if (!record) {
			return fail(404, { error: `${config.entityType} not found` });
		}

		if (config.validate) {
			const validationError = config.validate(record, locals);
			if (validationError) return validationError;
		}

		await logDelete(
			locals.user!.id,
			config.module,
			String(id),
			config.entityType,
			config.auditValues(record)
		);

		if (config.beforeDelete) {
			await config.beforeDelete(record);
		}

		await (prisma as any)[config.model].delete({ where: { id } });

		if (config.afterDelete) {
			await config.afterDelete(record);
		}

		return { success: true };
	};
}

// ---------------------------------------------------------------------------
// 10. createBulkDeleteAction — Factory for bulk-delete form actions
// ---------------------------------------------------------------------------
// Usage:
//   bulkDelete: createBulkDeleteAction({
//       permission: ['finances.income', 'delete'],
//       module: 'finances.income',
//       entityType: 'Income',
//       model: 'income',
//       findSelect: { id: true, amount: true, description: true },
//       auditValues: (record) => ({ amount: record.amount, description: record.description }),
//       beforeDelete: async (records) => {
//           // Delete projected children for recurring parents
//       },
//   }),

interface BulkDeleteActionConfig {
	permission: [string, string];
	module: string;
	entityType: string;
	model: string;
	findSelect: Record<string, boolean>;
	auditValues: (record: any) => Record<string, unknown>;
	validate?: (records: any[], locals: any) => ActionFailure<{ error: string }> | null;
	beforeDelete?: (records: any[]) => Promise<void>;
	afterDelete?: (records: any[]) => void | Promise<void>;
}

export function createBulkDeleteAction(config: BulkDeleteActionConfig) {
	return async ({ locals, request }: { locals: any; request: Request }) => {
		await requirePermission(locals, config.permission[0], config.permission[1]);

		const formData = await request.formData();
		const idsStr = formData.get('ids') as string;

		if (!idsStr) {
			return fail(400, { error: `${config.entityType} IDs are required` });
		}

		const ids = idsStr.split(',').map(Number).filter((id) => !isNaN(id));
		if (ids.length === 0) {
			return fail(400, { error: `No valid ${config.entityType} IDs provided` });
		}

		const records = await (prisma as any)[config.model].findMany({
			where: { id: { in: ids } },
			select: config.findSelect
		});

		if (records.length === 0) {
			return fail(404, { error: `No ${config.entityType.toLowerCase()} records found` });
		}

		if (config.validate) {
			const validationError = config.validate(records, locals);
			if (validationError) return validationError;
		}

		for (const record of records) {
			await logDelete(
				locals.user!.id,
				config.module,
				String(record.id),
				config.entityType,
				config.auditValues(record)
			);
		}

		if (config.beforeDelete) {
			await config.beforeDelete(records);
		}

		await (prisma as any)[config.model].deleteMany({
			where: { id: { in: records.map((r: any) => r.id) } }
		});

		if (config.afterDelete) {
			await config.afterDelete(records);
		}

		return { success: true, count: records.length };
	};
}
