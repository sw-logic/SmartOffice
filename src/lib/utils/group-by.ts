export type GroupByField = 'none' | 'category' | 'status';

export interface GroupedSection<T> {
	key: string;
	label: string;
	color?: string | null;
	items: T[];
	subtotals: { amount: number; taxValue: number; count: number };
}

interface EnumOption {
	value: string;
	label: string;
	color?: string | null;
}

interface FinanceRecord {
	amount: number;
	tax_value: number;
	category: string;
	status: string;
}

export function groupFinanceRecords<T extends FinanceRecord>(
	items: T[],
	groupBy: GroupByField,
	enumOptions: EnumOption[]
): GroupedSection<T>[] {
	if (groupBy === 'none') {
		return [
			{
				key: '_all',
				label: 'All',
				items,
				subtotals: computeSubtotals(items)
			}
		];
	}

	const groups = new Map<string, T[]>();

	for (const item of items) {
		const key = item[groupBy] || '_unknown';
		const list = groups.get(key);
		if (list) {
			list.push(item);
		} else {
			groups.set(key, [item]);
		}
	}

	const enumMap = new Map(enumOptions.map((e) => [e.value, e]));

	const sections: GroupedSection<T>[] = [];
	for (const [key, groupItems] of groups) {
		const matched = enumMap.get(key);
		sections.push({
			key,
			label: matched?.label ?? key,
			color: matched?.color ?? null,
			items: groupItems,
			subtotals: computeSubtotals(groupItems)
		});
	}

	return sections;
}

function computeSubtotals<T extends FinanceRecord>(items: T[]): GroupedSection<T>['subtotals'] {
	let amount = 0;
	let taxValue = 0;
	for (const item of items) {
		amount += Number(item.amount);
		taxValue += Number(item.tax_value);
	}
	return { amount, taxValue, count: items.length };
}
