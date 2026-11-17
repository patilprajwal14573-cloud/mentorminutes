const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/app');
const User = require('../src/models/User');
const MentoringRelationship = require('../src/models/MentoringRelationship');
const Session = require('../src/models/Session');

let mongod;
let mentorToken;
let learnerToken;
let outsiderToken;
let testSessionId;

describe('MentorMinutes - Privacy & Security Restrictions', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    // 1. Mentor
    const mentorRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Mentor Priv',
        email: 'mentor.priv@test.com',
        password: 'Password123!',
        role: 'mentor',
      });
    mentorToken = mentorRes.body.token;
    const mentorId = mentorRes.body.user._id;

    // 2. Learner
    const learnerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Learner Priv',
        email: 'learner.priv@test.com',
        password: 'Password123!',
        role: 'learner',
      });
    learnerToken = learnerRes.body.token;
    const learnerId = learnerRes.body.user._id;

    // 3. Outsider User
    const outsiderRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Outsider User',
        email: 'outsider@test.com',
        password: 'Password123!',
        role: 'learner',
      });
    outsiderToken = outsiderRes.body.token;

    // Create relationship
    const relationship = await MentoringRelationship.create({
      mentor: mentorId,
      learner: learnerId,
      topic: 'Confidential Mentorship',
    });

    // Create session with private notes
    const session = await Session.create({
      relationship: relationship._id,
      sessionNumber: 1,
      title: 'Privacy Verification Session',
      scheduledDate: new Date(),
      status: 'scheduled',
      sharedSummary: 'This is visible to both mentor and learner',
      mentorPrivateNotes: 'CONFIDENTIAL: Mentor private note that learner must never see',
    });
    testSessionId = session._id.toString();
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('should allow mentor to view private notes', async () => {
    const res = await request(app)
      .get(`/api/sessions/${testSessionId}`)
      .set('Authorization', `Bearer ${mentorToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(
      res.body.session.mentorPrivateNotes,
      'CONFIDENTIAL: Mentor private note that learner must never see'
    );
  });

  it('must strictly strip private mentor notes when viewed by the learner', async () => {
    const res = await request(app)
      .get(`/api/sessions/${testSessionId}`)
      .set('Authorization', `Bearer ${learnerToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.session.mentorPrivateNotes, undefined);
    assert.strictEqual(
      res.body.session.sharedSummary,
      'This is visible to both mentor and learner'
    );
  });

  it('must forbid access to unrelated users not part of the mentoring relationship', async () => {
    const res = await request(app)
      .get(`/api/sessions/${testSessionId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.success, false);
  });
});
