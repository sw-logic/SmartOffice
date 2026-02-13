import { prisma } from './prisma';

export interface EnumOption {
	value: string;
	label: string;
	description?: string | null;
	isDefault: boolean;
	color?: string | null;
	metadata?: Record<string, unknown> | null;
}

export interface EnumType {
	id: number;
	code: string;
	name: string;
	description: string | null;
	isSystem: boolean;
}

export const ALL_ENUM_CODES = [
	'currency', 'priority', 'entity_status', 'note_priority',
	'income_category', 'income_status', 'expense_category', 'expense_status',
	'payment_method', 'payment_status', 'payment_terms', 'recurring_period',
	'client_industry', 'vendor_category',
	'department', 'employment_type', 'employee_status',
	'project_status', 'task_status', 'task_type', 'task_category',
	'time_record_type', 'time_record_category',
	'offer_status', 'unit_of_measure', 'pricelist_category',
	'lead_source'
] as const;

// Cache for enum values with TTL
const enumCache = new Map<string, { values: EnumOption[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get enum values for a specific type code
 * Results are cached for performance
 */
export async function getEnumValues(typeCode: string): Promise<EnumOption[]> {
	// Check cache
	const cached = enumCache.get(typeCode);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.values;
	}

	// Fetch from database
	const enumType = await prisma.enumType.findUnique({
		where: { code: typeCode },
		include: {
			values: {
				where: { isActive: true },
				orderBy: { sortOrder: 'asc' }
			}
		}
	});

	if (!enumType) {
		console.warn(`Enum type not found: ${typeCode}`);
		return [];
	}

	const values: EnumOption[] = enumType.values.map((v) => ({
		value: v.value,
		label: v.label,
		description: v.description,
		isDefault: v.isDefault,
		color: v.color,
		metadata: v.metadata as Record<string, unknown> | null
	}));

	// Update cache
	enumCache.set(typeCode, { values, timestamp: Date.now() });

	return values;
}

/**
 * Get enum values for multiple type codes in a single query
 * More efficient than calling getEnumValues multiple times
 */
export async function getEnumValuesBatch(
	typeCodes: string[]
): Promise<Record<string, EnumOption[]>> {
	const result: Record<string, EnumOption[]> = {};
	const uncachedCodes: string[] = [];

	// Check cache for each code
	for (const code of typeCodes) {
		const cached = enumCache.get(code);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			result[code] = cached.values;
		} else {
			uncachedCodes.push(code);
		}
	}

	// Fetch uncached codes from database
	if (uncachedCodes.length > 0) {
		const enumTypes = await prisma.enumType.findMany({
			where: {
				code: { in: uncachedCodes }
			},
			include: {
				values: {
					where: { isActive: true },
					orderBy: { sortOrder: 'asc' }
				}
			}
		});

		for (const enumType of enumTypes) {
			const values: EnumOption[] = enumType.values.map((v) => ({
				value: v.value,
				label: v.label,
				description: v.description,
				isDefault: v.isDefault,
				color: v.color,
				metadata: v.metadata as Record<string, unknown> | null
			}));

			result[enumType.code] = values;
			enumCache.set(enumType.code, { values, timestamp: Date.now() });
		}

		// Set empty arrays for codes that weren't found
		for (const code of uncachedCodes) {
			if (!result[code]) {
				console.warn(`Enum type not found: ${code}`);
				result[code] = [];
			}
		}
	}

	return result;
}

/**
 * Clear the enum cache for a specific type or all types
 */
export function clearEnumCache(typeCode?: string): void {
	if (typeCode) {
		enumCache.delete(typeCode);
	} else {
		enumCache.clear();
	}
}

/**
 * Get all enum types (for admin UI)
 */
export async function getAllEnumTypes(): Promise<EnumType[]> {
	const types = await prisma.enumType.findMany({
		orderBy: { name: 'asc' }
	});

	return types.map((t) => ({
		id: t.id,
		code: t.code,
		name: t.name,
		description: t.description,
		isSystem: t.isSystem
	}));
}

/**
 * Get the default value for an enum type
 */
export async function getEnumDefaultValue(typeCode: string): Promise<string | null> {
	const values = await getEnumValues(typeCode);
	const defaultValue = values.find((v) => v.isDefault);
	return defaultValue?.value ?? values[0]?.value ?? null;
}

/**
 * Get enum label for a value
 */
export async function getEnumLabel(typeCode: string, value: string): Promise<string> {
	const values = await getEnumValues(typeCode);
	const found = values.find((v) => v.value === value);
	return found?.label ?? value;
}
