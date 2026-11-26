const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/app');
const MentoringRelationship = require('../src/models/MentoringRelationship');
const Notification = require('../src/models/Notification');

let mongod;

describe('MentorMinutes - Milestone 4 Goals, Milestones & Action Items', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('should manage goals, milestones, progress recalculation, action items, and cross-user isolation', async () => {
    const [mentorRes, learnerRes, outsiderRes] = await Promise.all([
      request(app).post('/api/auth/register').send({
        name: 'Goal Mentor',
        email: 'g.mentor@test.com',
        password: 'Password123!',
        role: 'mentor',
      }),
      request(app).post('/api/auth/register').send({
        name: 'Goal Learner',
        email: 'g.learner@test.com',
        password: 'Password123!',
        role: 'learner',
      }),
      request(app).post('/api/auth/register').send({
        name: 'Goal Outsider',
        email: 'g.outsider@test.com',
        password: 'Password123!',
        role: 'mentor',
      }),
    ]);

    const mentorToken = mentorRes.body.token;
    const learnerToken = learnerRes.body.token;
    const outsiderToken = outsiderRes.body.token;

    const rel = await MentoringRelationship.create({
      mentor: mentorRes.body.user._id,
      learner: learnerRes.body.user._id,
      topic: 'Backend Mastery',
    });

    // 1. Create goal with 2 milestones
    const goalRes = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({
        relationshipId: rel._id.toString(),
        title: 'Ship Production API',
        category: 'technical',
        priority: 'high',
        milestones: ['Design Mongoose models', 'Add integration tests'],
      });
    assert.strictEqual(goalRes.statusCode, 201);
    const goalId = goalRes.body.goal._id;
    const ms1Id = goalRes.body.goal.milestones[0]._id;
    const ms2Id = goalRes.body.goal.milestones[1]._id;
    assert.strictEqual(goalRes.body.goal.progress, 0);

    // 2. Toggle milestone 1 -> progress becomes 50%
    const toggle1 = await request(app)
      .patch(`/api/milestones/${goalId}/${ms1Id}`)
      .set('Authorization', `Bearer ${learnerToken}`);
    assert.strictEqual(toggle1.statusCode, 200);
    assert.strictEqual(toggle1.body.goal.progress, 50);

    // 3. Toggle milestone 2 -> progress becomes 100%, status completed, mentor notified
    const toggle2 = await request(app)
      .patch(`/api/milestones/${goalId}/${ms2Id}`)
      .set('Authorization', `Bearer ${learnerToken}`);
    assert.strictEqual(toggle2.statusCode, 200);
    assert.strictEqual(toggle2.body.goal.progress, 100);
    assert.strictEqual(toggle2.body.goal.status, 'completed');

    const goalCompleteNotif = await Notification.findOne({
      recipient: mentorRes.body.user._id,
      type: 'goal',
      title: 'Goal Completed!',
    });
    assert.ok(goalCompleteNotif);

    // 4. Outsider cannot view, update, add milestone, or delete goal
    assert.strictEqual(
      (await request(app).get(`/api/goals/${goalId}`).set('Authorization', `Bearer ${outsiderToken}`)).statusCode,
      403
    );
    assert.strictEqual(
      (
        await request(app)
          .put(`/api/goals/${goalId}`)
          .set('Authorization', `Bearer ${outsiderToken}`)
          .send({ title: 'Hacked' })
      ).statusCode,
      403
    );
    assert.strictEqual(
      (
        await request(app)
          .post(`/api/milestones/${goalId}`)
          .set('Authorization', `Bearer ${outsiderToken}`)
          .send({ title: 'Hacked MS' })
      ).statusCode,
      403
    );
    assert.strictEqual(
      (await request(app).delete(`/api/goals/${goalId}`).set('Authorization', `Bearer ${outsiderToken}`)).statusCode,
      403
    );

    // 5. Create session & action item
    const sessRes = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ relationshipId: rel._id.toString(), title: 'Kickoff' });
    const sessionId = sessRes.body.session._id;

    const pastDue = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const actionRes = await request(app)
      .post('/api/actions')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({
        relationshipId: rel._id.toString(),
        sessionId,
        title: 'Write unit tests',
        priority: 'high',
        dueDate: pastDue,
      });
    assert.strictEqual(actionRes.statusCode, 201);
    const actionId = actionRes.body.action._id;

    // 6. Overdue filter returns this action
    const overdueRes = await request(app)
      .get('/api/actions?overdue=true')
      .set('Authorization', `Bearer ${learnerToken}`);
    assert.strictEqual(overdueRes.statusCode, 200);
    assert.strictEqual(overdueRes.body.actions.length, 1);

    // 7. Outsider cannot view, update status, edit, or delete action item
    assert.strictEqual(
      (await request(app).get(`/api/actions/${actionId}`).set('Authorization', `Bearer ${outsiderToken}`)).statusCode,
      403
    );
    assert.strictEqual(
      (
        await request(app)
          .patch(`/api/actions/${actionId}/status`)
          .set('Authorization', `Bearer ${outsiderToken}`)
          .send({ status: 'completed' })
      ).statusCode,
      403
    );
    assert.strictEqual(
      (await request(app).delete(`/api/actions/${actionId}`).set('Authorization', `Bearer ${outsiderToken}`)).statusCode,
      403
    );

    // 8. Learner completes action item
    const completeAction = await request(app)
      .patch(`/api/actions/${actionId}/status`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ status: 'completed' });
    assert.strictEqual(completeAction.statusCode, 200);
    assert.strictEqual(completeAction.body.action.status, 'completed');
  });
});
