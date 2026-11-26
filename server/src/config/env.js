const crypto = require('crypto');

let ephemeralDevSecret = null;

/**
 * Returns the JWT signing secret from environment variables.
 * Fails fast in production if JWT_SECRET is missing; generates an ephemeral
 * per-process secret in local dev/test when no .env secret is configured.
 */
function getJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0) {
    return process.env.JWT_SECRET.trim();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be configured in production');
  }

  if (!ephemeralDevSecret) {
    ephemeralDevSecret = crypto.randomBytes(32).toString('hex');
  }
  return ephemeralDevSecret;
}

module.exports = {
  getJwtSecret,
};
