// Simple currency utilities without dinero.js dependency
// Using native JavaScript for money calculations with proper rounding

/**
 * Format a number as currency
 * @param amount - Amount to format
 * @param currencyCode - ISO currency code
 * @param locale - Locale for formatting (default: en-US)
 */
export function formatCurrency(amount: number, currencyCode = 'USD', locale = 'en-US'): string {
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: currencyCode,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);
}

/**
 * Calculate total from an array of items with quantity and price
 */
export function calculateTotal(
	items: Array<{ quantity: number; price: number }>
): number {
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
 * @param value - String value like "$1,234.56"
 * @returns Numeric value or 0 if invalid
 */
export function parseCurrency(value: string): number {
	// Remove currency symbols and thousands separators
	const cleaned = value.replace(/[^0-9.-]/g, '');
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
 * Convert cents to dollars
 */
export function centsToDollars(cents: number): number {
	return roundMoney(cents / 100);
}

/**
 * Convert dollars to cents
 */
export function dollarsToCents(dollars: number): number {
	return Math.round(dollars * 100);
}

/**
 * Format compact currency (e.g., $1.2K, $5.3M)
 */
export function formatCompactCurrency(amount: number, currencyCode = 'USD', locale = 'en-US'): string {
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: currencyCode,
		notation: 'compact',
		maximumFractionDigits: 1
	}).format(amount);
}
