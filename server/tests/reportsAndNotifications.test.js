const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/app');
const MentoringRelationship = require('../src/models/MentoringRelationship');
const Goal = require('../src/models/Goal');
const ActionItem = require('../src/models/ActionItem');

let mongod;

describe('MentorMinutes - Milestone 6 Reports, Timeline & Notifications', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('should compute accurate filtered analytics, chronological timeline, and idempotent due reminders', async () => {
    const [mentorRes, learnerRes, outsiderRes] = await Promise.all([
      request(app).post('/api/auth/register').send({
        name: 'Report Mentor',
        email: 'r.mentor@test.com',
        password: 'Password123!',
        role: 'mentor',
      }),
      request(app).post('/api/auth/register').send({
        name: 'Report Learner',
        email: 'r.learner@test.com',
        password: 'Password123!',
        role: 'learner',
      }),
      request(app).post('/api/auth/register').send({
        name: 'Report Outsider',
        email: 'r.outsider@test.com',
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
      topic: 'Analytics Mentorship',
    });

    // Create Session 1 (completed) with 1 overdue action item
    const sess1Res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ relationshipId: rel._id.toString(), title: 'Kickoff Analytics' });
    const sess1Id = sess1Res.body.session._id;

    await request(app)
      .put(`/api/sessions/${sess1Id}`)
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ status: 'completed', sharedSummary: 'Covered KPIs' });

    const pastDue = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await ActionItem.create({
      relationship: rel._id,
      session: sess1Id,
      title: 'Overdue Task',
      assignedTo: learnerRes.body.user._id,
      createdBy: mentorRes.body.user._id,
      priority: 'high',
      dueDate: pastDue,
      status: 'pending',
      originalSession: sess1Id,
    });

    // Create Session 2 (scheduled) -> automatically carries forward Overdue Task
    await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ relationshipId: rel._id.toString(), title: 'Follow-up Session' });

    // Create approaching goal (within 24h) + completed goal
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await Goal.create({
      relationship: rel._id,
      createdBy: mentorRes.body.user._id,
      title: 'Approaching Deadline Goal',
      category: 'technical',
      status: 'in-progress',
      progress: 50,
      targetDate: tomorrow,
    });
    await Goal.create({
      relationship: rel._id,
      createdBy: mentorRes.body.user._id,
      title: 'Finished Goal',
      category: 'career',
      status: 'completed',
      progress: 100,
      completedAt: new Date(),
    });

    // 1. Unfiltered dashboard stats
    const dashRes = await request(app)
      .get('/api/reports/dashboard')
      .set('Authorization', `Bearer ${mentorToken}`);
    assert.strictEqual(dashRes.statusCode, 200);
    assert.strictEqual(dashRes.body.stats.totalSessions, 2);
    assert.strictEqual(dashRes.body.stats.completedSessions, 1);
    assert.strictEqual(dashRes.body.stats.actions.carriedForward, 1);
    assert.strictEqual(dashRes.body.stats.goals.active, 1);
    assert.strictEqual(dashRes.body.stats.goals.completed, 1);

    // 2. Filtered dashboard stats (sessionStatus=completed, goalStatus=completed)
    const filteredRes = await request(app)
      .get(`/api/reports/dashboard?relationshipId=${rel._id}&sessionStatus=completed&goalStatus=completed`)
      .set('Authorization', `Bearer ${mentorToken}`);
    assert.strictEqual(filteredRes.statusCode, 200);
    assert.strictEqual(filteredRes.body.stats.totalSessions, 1);
    assert.strictEqual(filteredRes.body.stats.goals.total, 1);
    assert.strictEqual(filteredRes.body.stats.goals.completed, 1);

    // 3. Outsider cannot query reports for another relationship
    const forbiddenReport = await request(app)
      .get(`/api/reports/dashboard?relationshipId=${rel._id}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    assert.strictEqual(forbiddenReport.statusCode, 403);

    // 4. Timeline includes sessions, carry-forward, and goal events
    const timelineRes = await request(app)
      .get('/api/reports/timeline')
      .set('Authorization', `Bearer ${learnerToken}`);
    assert.strictEqual(timelineRes.statusCode, 200);
    const types = new Set(timelineRes.body.timeline.map((t) => t.type));
    assert.ok(types.has('session'));
    assert.ok(types.has('carry_forward'));
    assert.ok(types.has('goal_completed'));

    // 5. Notifications generate overdue action & approaching goal reminders without duplicates
    const notif1 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${learnerToken}`);
    assert.strictEqual(notif1.statusCode, 200);
    const titles1 = notif1.body.notifications.map((n) => n.title);
    assert.ok(titles1.includes('Overdue Action Item'));
    assert.ok(titles1.includes('Goal Deadline Approaching'));

    const initialCount = notif1.body.notifications.length;
    const notif2 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${learnerToken}`);
    assert.strictEqual(notif2.body.notifications.length, initialCount);

    // Mark all read
    const readAll = await request(app)
      .patch('/api/notifications/all/read')
      .set('Authorization', `Bearer ${learnerToken}`);
    assert.strictEqual(readAll.statusCode, 200);

    const notifAfterRead = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${learnerToken}`);
    assert.strictEqual(notifAfterRead.body.unreadCount, 0);
  });
});
