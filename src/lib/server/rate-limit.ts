/**
 * In-memory sliding-window rate limiter.
 *
 * Each instance tracks request timestamps per key (typically client IP).
 * Old entries are pruned automatically on every check and via a periodic sweep.
 */

interface RateLimiterConfig {
	/** Maximum number of requests allowed within the window. */
	maxRequests: number;
	/** Time window in milliseconds. */
	windowMs: number;
}

interface RateLimitResult {
	/** Whether the request is allowed. */
	allowed: boolean;
	/** Remaining requests in the current window. */
	remaining: number;
	/** Seconds until the client can retry (0 if allowed). */
	retryAfterSeconds: number;
}

export class RateLimiter {
	private readonly maxRequests: number;
	private readonly windowMs: number;
	/** Map of key → sorted array of request timestamps. */
	private readonly hits = new Map<string, number[]>();
	private readonly cleanupInterval: ReturnType<typeof setInterval>;

	constructor(config: RateLimiterConfig) {
		this.maxRequests = config.maxRequests;
		this.windowMs = config.windowMs;

		// Sweep stale keys every 60 seconds to prevent memory leaks
		this.cleanupInterval = setInterval(() => this.sweep(), 60_000);
		// Allow Node to exit even if the interval is active
		if (this.cleanupInterval.unref) {
			this.cleanupInterval.unref();
		}
	}

	/**
	 * Check whether a request from `key` is allowed and record it.
	 */
	check(key: string): RateLimitResult {
		const now = Date.now();
		const windowStart = now - this.windowMs;

		let timestamps = this.hits.get(key);

		if (timestamps) {
			// Drop timestamps outside the current window
			timestamps = timestamps.filter((t) => t > windowStart);
		} else {
			timestamps = [];
		}

		if (timestamps.length >= this.maxRequests) {
			// Rate limit exceeded — calculate when the oldest relevant request expires
			const oldestInWindow = timestamps[0];
			const retryAfterMs = oldestInWindow + this.windowMs - now;
			this.hits.set(key, timestamps);

			return {
				allowed: false,
				remaining: 0,
				retryAfterSeconds: Math.ceil(retryAfterMs / 1000)
			};
		}

		// Record this request
		timestamps.push(now);
		this.hits.set(key, timestamps);

		return {
			allowed: true,
			remaining: this.maxRequests - timestamps.length,
			retryAfterSeconds: 0
		};
	}

	/**
	 * Remove keys whose timestamps have all expired.
	 */
	private sweep(): void {
		const windowStart = Date.now() - this.windowMs;
		for (const [key, timestamps] of this.hits) {
			const active = timestamps.filter((t) => t > windowStart);
			if (active.length === 0) {
				this.hits.delete(key);
			} else {
				this.hits.set(key, active);
			}
		}
	}
}

// ── Pre-configured instances ──────────────────────────────────────────────────

/** Login endpoint: 5 attempts per 60 seconds per IP. */
export const loginLimiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });

/** Mutating API requests (POST/PUT/PATCH/DELETE): 100 per 60 seconds per IP. */
export const apiMutationLimiter = new RateLimiter({ maxRequests: 100, windowMs: 60_000 });

/** General API reads (GET): 200 per 60 seconds per IP. */
export const apiReadLimiter = new RateLimiter({ maxRequests: 200, windowMs: 60_000 });
