const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/app');
const { getJwtSecret } = require('../src/config/env');

let mongod;

describe('MentorMinutes - Milestone 1 Foundation & Health', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('should return healthy status and connected DB on GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.service, 'MentorMinutes API');
    assert.strictEqual(res.body.status, 'healthy');
    assert.strictEqual(res.body.database.connected, true);
    assert.strictEqual(res.body.database.status, 'connected');
  });

  it('should return structured 404 JSON for unknown API routes', async () => {
    const res = await request(app).get('/api/unknown-endpoint');
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
  });

  it('should require JWT_SECRET in production and provide ephemeral secret in test', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;

    try {
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'test';
      const devSecret = getJwtSecret();
      assert.ok(typeof devSecret === 'string' && devSecret.length >= 32);

      process.env.NODE_ENV = 'production';
      assert.throws(() => getJwtSecret(), /JWT_SECRET environment variable must be configured/);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevSecret !== undefined) {
        process.env.JWT_SECRET = prevSecret;
      } else {
        delete process.env.JWT_SECRET;
      }
    }
  });
});
