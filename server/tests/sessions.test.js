const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/app');
const MentoringRelationship = require('../src/models/MentoringRelationship');

let mongod;

describe('MentorMinutes - Milestone 3 Session Management & Authorization', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('should support full Session CRUD, search, privacy stripping, and relationship isolation', async () => {
    const [m1, m2, l1] = await Promise.all([
      request(app).post('/api/auth/register').send({
        name: 'Mentor One',
        email: 'm1.sess@test.com',
        password: 'Password123!',
        role: 'mentor',
      }),
      request(app).post('/api/auth/register').send({
        name: 'Mentor Two',
        email: 'm2.sess@test.com',
        password: 'Password123!',
        role: 'mentor',
      }),
      request(app).post('/api/auth/register').send({
        name: 'Learner One',
        email: 'l1.sess@test.com',
        password: 'Password123!',
        role: 'learner',
      }),
    ]);

    const m1Token = m1.body.token;
    const m2Token = m2.body.token;
    const l1Token = l1.body.token;

    const rel = await MentoringRelationship.create({
      mentor: m1.body.user._id,
      learner: l1.body.user._id,
      topic: 'System Architecture',
    });

    // 1. Another mentor (m2) cannot create a session in m1's relationship
    const forbiddenCreate = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${m2Token}`)
      .send({ relationshipId: rel._id.toString(), title: 'Hijacked Session' });
    assert.strictEqual(forbiddenCreate.statusCode, 403);

    // 2. Outsider (m2) cannot list sessions or preview carry-forward for m1's relationship
    const forbiddenList = await request(app)
      .get(`/api/sessions?relationshipId=${rel._id}`)
      .set('Authorization', `Bearer ${m2Token}`);
    assert.strictEqual(forbiddenList.statusCode, 403);

    const forbiddenPreview = await request(app)
      .get(`/api/sessions/preview-carry-forward?relationshipId=${rel._id}`)
      .set('Authorization', `Bearer ${m2Token}`);
    assert.strictEqual(forbiddenPreview.statusCode, 403);

    // 3. Mentor 1 creates a session
    const createRes = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${m1Token}`)
      .send({
        relationshipId: rel._id.toString(),
        title: 'API Security Review',
        durationMinutes: 45,
        agenda: 'Review JWT & RBAC',
        mentorPrivateNotes: 'Private mentor evaluation note',
      });
    assert.strictEqual(createRes.statusCode, 201);
    const sessionId = createRes.body.session._id;

    // 4. Search sessions by keyword
    const searchHit = await request(app)
      .get('/api/sessions?q=Security')
      .set('Authorization', `Bearer ${l1Token}`);
    assert.strictEqual(searchHit.statusCode, 200);
    assert.strictEqual(searchHit.body.sessions.length, 1);
    assert.strictEqual(searchHit.body.sessions[0].mentorPrivateNotes, undefined);

    const searchMiss = await request(app)
      .get('/api/sessions?q=NonexistentKeyword')
      .set('Authorization', `Bearer ${l1Token}`);
    assert.strictEqual(searchMiss.statusCode, 200);
    assert.strictEqual(searchMiss.body.sessions.length, 0);

    // 5. Learner updates learnerFeedback; cannot overwrite sharedSummary or view mentorPrivateNotes
    const learnerUpdate = await request(app)
      .put(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${l1Token}`)
      .send({
        learnerFeedback: 'Great session, clear next steps!',
        sharedSummary: 'Attempted learner overwrite',
      });
    assert.strictEqual(learnerUpdate.statusCode, 200);
    assert.strictEqual(learnerUpdate.body.session.learnerFeedback, 'Great session, clear next steps!');
    assert.strictEqual(learnerUpdate.body.session.sharedSummary, '');
    assert.strictEqual(learnerUpdate.body.session.mentorPrivateNotes, undefined);

    // 6. Mentor completes session with sharedSummary
    const mentorComplete = await request(app)
      .put(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${m1Token}`)
      .send({
        status: 'completed',
        sharedSummary: 'Agreed on RBAC rules and validation tests.',
      });
    assert.strictEqual(mentorComplete.statusCode, 200);
    assert.strictEqual(mentorComplete.body.session.status, 'completed');

    // 7. Mentor deletes session
    const deleteRes = await request(app)
      .delete(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${m1Token}`);
    assert.strictEqual(deleteRes.statusCode, 200);

    const afterDelete = await request(app)
      .get(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${m1Token}`);
    assert.strictEqual(afterDelete.statusCode, 404);
  });
});
