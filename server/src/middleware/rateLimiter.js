/**
 * Lightweight in-memory rate limiter factory for protecting authentication endpoints.
 * @param {object} options
 * @param {number} [options.windowMs=900000] Time window in milliseconds (default 15 minutes)
 * @param {number} [options.max=30] Maximum requests allowed per key per window
 * @param {string} [options.message] Error message returned when limit is exceeded
 */
function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 30,
  message = 'Too many requests, please try again later.',
} = {}) {
  const hits = new Map();

  // Periodically prune expired entries to prevent unbounded memory growth
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (now >= entry.resetAt) {
        hits.delete(key);
      }
    }
  }, Math.min(windowMs, 60 * 1000));
  if (typeof cleanup.unref === 'function') {
    cleanup.unref();
  }

  const middleware = (req, res, next) => {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        message,
      });
    }

    return next();
  };

  middleware.reset = () => hits.clear();
  return middleware;
}

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 200 : 30,
  message: 'Too many authentication attempts. Please wait a few minutes and try again.',
});

module.exports = {
  createRateLimiter,
  authRateLimiter,
};
