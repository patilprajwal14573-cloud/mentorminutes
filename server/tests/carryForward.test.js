const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../src/models/User');
const MentoringRelationship = require('../src/models/MentoringRelationship');
const Session = require('../src/models/Session');
const ActionItem = require('../src/models/ActionItem');
const {
  previewCarryForward,
  executeCarryForward,
} = require('../src/services/carryForwardService');

let mongod;

describe('MentorMinutes - Automatic Action Carry-Forward Service', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('should carry forward unfinished items and prevent duplication', async () => {
    // 1. Create mentor and learner
    const mentor = await User.create({
      name: 'Test Mentor',
      email: 'mentor@test.com',
      password: 'Password123!',
      role: 'mentor',
    });

    const learner = await User.create({
      name: 'Test Learner',
      email: 'learner@test.com',
      password: 'Password123!',
      role: 'learner',
    });

    // 2. Create relationship
    const relationship = await MentoringRelationship.create({
      mentor: mentor._id,
      learner: learner._id,
      topic: 'Test Mentorship',
    });

    // 3. Create Session 1
    const session1 = await Session.create({
      relationship: relationship._id,
      sessionNumber: 1,
      title: 'Session 1',
      scheduledDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      status: 'completed',
    });

    // 4. Create 3 actions in Session 1:
    // a) Pending item (should carry forward)
    const pendingItem = await ActionItem.create({
      relationship: relationship._id,
      session: session1._id,
      title: 'Read chapter 4',
      assignedTo: learner._id,
      createdBy: mentor._id,
      status: 'pending',
      originalSession: session1._id,
      carryCount: 0,
    });

    // b) In-progress item (should carry forward)
    const inProgressItem = await ActionItem.create({
      relationship: relationship._id,
      session: session1._id,
      title: 'Write draft PR',
      assignedTo: learner._id,
      createdBy: mentor._id,
      status: 'in-progress',
      originalSession: session1._id,
      carryCount: 0,
    });

    // c) Completed item (should NOT carry forward)
    await ActionItem.create({
      relationship: relationship._id,
      session: session1._id,
      title: 'Setup repository',
      assignedTo: learner._id,
      createdBy: mentor._id,
      status: 'completed',
      completedAt: new Date(),
      originalSession: session1._id,
      carryCount: 0,
    });

    // 5. Test previewCarryForward before Session 2
    const preview = await previewCarryForward(relationship._id);
    assert.strictEqual(preview.hasPreviousSession, true);
    assert.strictEqual(preview.eligibleActions.length, 2);
    assert.strictEqual(preview.nextSessionNumber, 2);

    // 6. Create Session 2 and execute carry forward
    const session2 = await Session.create({
      relationship: relationship._id,
      sessionNumber: 2,
      title: 'Session 2',
      scheduledDate: new Date(),
      status: 'scheduled',
    });

    const carried = await executeCarryForward(relationship._id, session2._id);
    assert.strictEqual(carried.length, 2);

    // 7. Verify original items marked carried: true
    const reloadedPending = await ActionItem.findById(pendingItem._id);
    const reloadedInProgress = await ActionItem.findById(inProgressItem._id);
    assert.strictEqual(reloadedPending.carried, true);
    assert.strictEqual(reloadedInProgress.carried, true);

    // 8. Verify new carried items in Session 2
    const session2Actions = await ActionItem.find({ session: session2._id });
    assert.strictEqual(session2Actions.length, 2);

    for (const a of session2Actions) {
      assert.strictEqual(a.carryCount, 1);
      assert.strictEqual(a.carried, false);
      assert.strictEqual(a.originalSession.toString(), session1._id.toString());
      assert.strictEqual(a.carryHistory.length, 1);
      assert.strictEqual(a.carryHistory[0].fromSession.toString(), session1._id.toString());
      assert.strictEqual(a.carryHistory[0].toSession.toString(), session2._id.toString());
    }

    // 9. Idempotency test: Re-executing carry forward must NOT duplicate!
    const reCarried = await executeCarryForward(relationship._id, session2._id);
    assert.strictEqual(reCarried.length, 0);

    const session2ActionsAfterDuplicateCheck = await ActionItem.find({ session: session2._id });
    assert.strictEqual(session2ActionsAfterDuplicateCheck.length, 2);
  });
});
