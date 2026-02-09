// In-memory cache for user session validity.
// Avoids a DB query on every request just to check if the user still exists
// and isn't soft-deleted. Entries auto-expire after the configured TTL.

const USER_VALIDITY_TTL = 5 * 60 * 1000; // 5 minutes

const cache = new Map<string, { valid: boolean; expiresAt: number }>();

export function getCachedUserValidity(userId: string): boolean | null {
	const entry = cache.get(userId);
	if (!entry) return null;
	if (Date.now() > entry.expiresAt) {
		cache.delete(userId);
		return null;
	}
	return entry.valid;
}

export function setCachedUserValidity(userId: string, valid: boolean): void {
	cache.set(userId, { valid, expiresAt: Date.now() + USER_VALIDITY_TTL });
}

/** Evict a user's cache entry immediately (call on delete/restore). */
export function invalidateUserValidity(userId: string): void {
	cache.delete(userId);
}
