// Currency formatting utilities driven by enum metadata
// Each currency enum value has metadata: { symbol, code, decimals, locale }

/**
 * Shape of a currency enum option (subset of EnumOption used client-side).
 * Type-only import keeps server code out of client bundles.
 */
interface CurrencyEnumOption {
	value: string;
	label: string;
	isDefault: boolean;
	metadata?: Record<string, unknown> | null;
}

interface CurrencyConfig {
	locale: string;
	decimals: number;
	currencyCode: string;
}

/** Built-in fallbacks when enum metadata is missing */
const BUILTIN_DEFAULTS: Record<string, CurrencyConfig> = {
	HUF: { locale: 'hu-HU', decimals: 0, currencyCode: 'HUF' },
	USD: { locale: 'en-US', decimals: 2, currencyCode: 'USD' },
	EUR: { locale: 'de-DE', decimals: 2, currencyCode: 'EUR' },
	GBP: { locale: 'en-GB', decimals: 2, currencyCode: 'GBP' }
};

const DEFAULT_CONFIG: CurrencyConfig = { locale: 'hu-HU', decimals: 0, currencyCode: 'HUF' };

/** Intl.NumberFormat cache keyed by "locale|currency|decimals" */
const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, currency: string, decimals: number): Intl.NumberFormat {
	const key = `${locale}|${currency}|${decimals}`;
	let fmt = formatterCache.get(key);
	if (!fmt) {
		fmt = new Intl.NumberFormat(locale, {
			style: 'currency',
			currency,
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
		formatterCache.set(key, fmt);
	}
	return fmt;
}

/**
 * Resolve currency config from enum metadata, falling back to built-in defaults.
 */
function resolveConfig(
	currencyCode: string | undefined | null,
	currencyEnums?: CurrencyEnumOption[]
): CurrencyConfig {
	const code = currencyCode || 'HUF';

	if (currencyEnums) {
		const enumEntry = currencyEnums.find((e) => e.value === code);
		if (enumEntry?.metadata) {
			const m = enumEntry.metadata;
			return {
				locale: (m.locale as string) || BUILTIN_DEFAULTS[code]?.locale || DEFAULT_CONFIG.locale,
				decimals:
					typeof m.decimals === 'number'
						? m.decimals
						: (BUILTIN_DEFAULTS[code]?.decimals ?? DEFAULT_CONFIG.decimals),
				currencyCode: code
			};
		}
	}

	return BUILTIN_DEFAULTS[code] || { ...DEFAULT_CONFIG, currencyCode: code };
}

/**
 * Format a number as currency (plain text).
 * Returns '-' for null/undefined amounts.
 */
export function formatCurrency(
	amount: number | null | undefined,
	currencyCode?: string,
	currencyEnums?: CurrencyEnumOption[]
): string {
	if (amount === null || amount === undefined) return '-';
	const cfg = resolveConfig(currencyCode, currencyEnums);
	return getFormatter(cfg.locale, cfg.currencyCode, cfg.decimals).format(amount);
}

/**
 * Format currency with the symbol wrapped in a styled span (smaller + half opacity).
 * Returns '-' for null/undefined amounts.
 */
export function formatCurrencyHtml(
	amount: number | null | undefined,
	currencyCode?: string,
	currencyEnums?: CurrencyEnumOption[]
): string {
	if (amount === null || amount === undefined) return '-';
	const cfg = resolveConfig(currencyCode, currencyEnums);
	const parts = getFormatter(cfg.locale, cfg.currencyCode, cfg.decimals).formatToParts(amount);
	return parts
		.map((p) =>
			p.type === 'currency'
				? `<span class="text-[0.85em] opacity-50">${p.value}</span>`
				: p.value
		)
		.join('');
}

/**
 * Create a formatter bound to specific currency enums + optional default currency code.
 * Useful in components that access enums via `data.enums.currency`.
 *
 * Usage:
 *   const fmt = createCurrencyFormatter(data.enums.currency);
 *   fmt.format(10000)          // "10 000 Ft" (uses default currency from enums)
 *   fmt.format(100, 'USD')     // "$100.00"
 *   fmt.formatHtml(10000)      // "10 000 <span ...>Ft</span>"
 */
export function createCurrencyFormatter(currencyEnums: CurrencyEnumOption[], defaultCode?: string) {
	const defCode = defaultCode || currencyEnums.find((c) => c.isDefault)?.value || 'HUF';

	return {
		format(amount: number | null | undefined, currencyCode?: string): string {
			return formatCurrency(amount, currencyCode || defCode, currencyEnums);
		},
		formatHtml(amount: number | null | undefined, currencyCode?: string): string {
			return formatCurrencyHtml(amount, currencyCode || defCode, currencyEnums);
		}
	};
}

// ============================================================================
// Money math utilities (unchanged)
// ============================================================================

/**
 * Calculate total from an array of items with quantity and price
 */
export function calculateTotal(items: Array<{ quantity: number; price: number }>): number {
	let total = 0;
	for (const item of items) {
		total += roundMoney(item.quantity * item.price);
	}
	return roundMoney(total);
}

/**
 * Calculate tax amount
 */
export function calculateTax(amount: number, taxRate: number): number {
	return roundMoney(amount * (taxRate / 100));
}

/**
 * Parse a currency string to a number
 * @param value - String value like "$1,234.56" or "10 000 Ft"
 * @returns Numeric value or 0 if invalid
 */
export function parseCurrency(value: string): number {
	const cleaned = value.replace(/[^0-9.\-]/g, '');
	const parsed = parseFloat(cleaned);
	return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format a number as a percentage
 */
export function formatPercent(value: number, decimals = 2): string {
	return `${value.toFixed(decimals)}%`;
}

/**
 * Round a number to specified decimal places (default 2 for money)
 */
export function roundMoney(amount: number, decimals = 2): number {
	const factor = Math.pow(10, decimals);
	return Math.round(amount * factor) / factor;
}

/**
 * Add two amounts together with proper rounding
 */
export function addMoney(a: number, b: number): number {
	return roundMoney(a + b);
}

/**
 * Subtract two amounts with proper rounding
 */
export function subtractMoney(a: number, b: number): number {
	return roundMoney(a - b);
}

/**
 * Multiply an amount by a factor with proper rounding
 */
export function multiplyMoney(amount: number, factor: number): number {
	return roundMoney(amount * factor);
}

/**
 * Format compact currency (e.g., 1,2K Ft, $5.3M)
 */
export function formatCompactCurrency(
	amount: number,
	currencyCode?: string,
	currencyEnums?: CurrencyEnumOption[]
): string {
	const cfg = resolveConfig(currencyCode, currencyEnums);
	return new Intl.NumberFormat(cfg.locale, {
		style: 'currency',
		currency: cfg.currencyCode,
		notation: 'compact',
		maximumFractionDigits: 1
	}).format(amount);
}
