import { lookup } from 'dns/promises';

const MAX_URL_COUNT = parseInt(process.env.SEO_AUDIT_MAX_URLS || '20');
const MAX_URL_LENGTH = 2048;

const PRIVATE_IP_RANGES = [
	/^127\./,
	/^10\./,
	/^172\.(1[6-9]|2\d|3[01])\./,
	/^192\.168\./,
	/^169\.254\./,
	/^0\./,
	/^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./  // CGNAT range
];

const BLOCKED_HOSTNAMES = ['localhost', '0.0.0.0', '[::1]'];

export interface UrlValidationResult {
	valid: boolean;
	urls: string[];
	errors: string[];
	warnings: string[];
}

function isPrivateIp(ip: string): boolean {
	if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;
	return PRIVATE_IP_RANGES.some(regex => regex.test(ip));
}

/**
 * Validate and sanitize a list of URLs for SEO auditing.
 * Checks for SSRF, deduplication, max count, format, etc.
 */
export async function validateUrls(rawInput: string): Promise<UrlValidationResult> {
	const errors: string[] = [];
	const warnings: string[] = [];

	const lines = rawInput
		.split(/[\n\r]+/)
		.map(line => line.trim())
		.filter(line => line.length > 0);

	if (lines.length === 0) {
		return { valid: false, urls: [], errors: ['No URLs provided'], warnings };
	}

	if (lines.length > MAX_URL_COUNT) {
		return {
			valid: false,
			urls: [],
			errors: [`Too many URLs. Maximum is ${MAX_URL_COUNT}, got ${lines.length}`],
			warnings
		};
	}

	const validUrls: string[] = [];
	const seen = new Set<string>();

	for (const line of lines) {
		// Auto-add https:// if no protocol
		let urlStr = line;
		if (!/^https?:\/\//i.test(urlStr)) {
			urlStr = `https://${urlStr}`;
		}

		// Check length
		if (urlStr.length > MAX_URL_LENGTH) {
			errors.push(`URL too long (${urlStr.length} chars): ${urlStr.substring(0, 80)}...`);
			continue;
		}

		// Parse URL
		let parsed: URL;
		try {
			parsed = new URL(urlStr);
		} catch {
			errors.push(`Invalid URL: ${line}`);
			continue;
		}

		// Protocol check
		if (!['http:', 'https:'].includes(parsed.protocol)) {
			errors.push(`Invalid protocol "${parsed.protocol}" for: ${line}`);
			continue;
		}

		// Blocked hostname check
		if (BLOCKED_HOSTNAMES.includes(parsed.hostname.toLowerCase())) {
			errors.push(`Blocked hostname: ${parsed.hostname}`);
			continue;
		}

		// Deduplicate
		const normalized = parsed.origin + parsed.pathname.replace(/\/+$/, '') + parsed.search;
		if (seen.has(normalized)) {
			warnings.push(`Duplicate URL removed: ${line}`);
			continue;
		}
		seen.add(normalized);

		// DNS resolution + private IP check
		try {
			const result = await lookup(parsed.hostname);
			if (isPrivateIp(result.address)) {
				errors.push(`URL resolves to private IP (${result.address}): ${parsed.hostname}`);
				continue;
			}
		} catch {
			errors.push(`Cannot resolve hostname: ${parsed.hostname}`);
			continue;
		}

		validUrls.push(parsed.href);
	}

	return {
		valid: validUrls.length > 0 && errors.length === 0,
		urls: validUrls,
		errors,
		warnings
	};
}
