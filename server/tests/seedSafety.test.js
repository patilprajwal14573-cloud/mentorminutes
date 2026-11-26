const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../src/models/User');
const seedDatabase = require('../src/seed');
const { resetDemoData, DEMO_EMAILS } = require('../src/seed');

let mongod;

describe('MentorMinutes - Milestone 7 Safe Demo Seeding & Reset', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('should seed demo data and reset ONLY demo records without deleting real users', async () => {
    // 1. Create a non-demo user
    const realUser = await User.create({
      name: 'Real Production User',
      email: 'real.user@company.com',
      password: 'Password123!',
      role: 'mentor',
    });

    // 2. Run demo seeding
    await seedDatabase(false);
    const demoCount = await User.countDocuments({ email: { $in: DEMO_EMAILS } });
    assert.strictEqual(demoCount, 6);

    // Real user must still exist
    const realStillExists = await User.findById(realUser._id);
    assert.ok(realStillExists);

    // 3. Reset ONLY demo data
    await resetDemoData(false);
    const demoCountAfterReset = await User.countDocuments({ email: { $in: DEMO_EMAILS } });
    assert.strictEqual(demoCountAfterReset, 0);

    // Real user must STILL exist after demo reset
    const realAfterReset = await User.findById(realUser._id);
    assert.ok(realAfterReset);
    assert.strictEqual(realAfterReset.email, 'real.user@company.com');
  });
});
