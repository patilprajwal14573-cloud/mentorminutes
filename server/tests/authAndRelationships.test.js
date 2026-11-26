const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/app');
const { createRateLimiter } = require('../src/middleware/rateLimiter');

let mongod;

describe('MentorMinutes - Milestone 2 Auth, Users & Relationships', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('should handle registration, login, invalid credentials, protected routes, and invite workflows', async () => {
    // 1. Register mentor
    const mentorRes = await request(app).post('/api/auth/register').send({
      name: 'Dr. Mentor Two',
      email: 'mentor2@test.com',
      password: 'Password123!',
      role: 'mentor',
      title: 'Staff Engineer',
    });
    assert.strictEqual(mentorRes.statusCode, 201);
    assert.ok(mentorRes.body.token);
    assert.ok(mentorRes.body.user.inviteCode);
    const mentorToken = mentorRes.body.token;
    const inviteCode = mentorRes.body.user.inviteCode;

    // 2. Duplicate registration blocked
    const dupRes = await request(app).post('/api/auth/register').send({
      name: 'Dup Mentor',
      email: 'mentor2@test.com',
      password: 'Password123!',
      role: 'mentor',
    });
    assert.strictEqual(dupRes.statusCode, 400);

    // 3. Invalid login rejected
    const badLogin = await request(app).post('/api/auth/login').send({
      email: 'mentor2@test.com',
      password: 'WrongPassword!',
    });
    assert.strictEqual(badLogin.statusCode, 401);

    // 4. Valid login works
    const goodLogin = await request(app).post('/api/auth/login').send({
      email: 'mentor2@test.com',
      password: 'Password123!',
    });
    assert.strictEqual(goodLogin.statusCode, 200);
    assert.ok(goodLogin.body.token);

    // 5. Protected /api/users/me rejects unauthenticated and allows authenticated
    const unauthMe = await request(app).get('/api/users/me');
    assert.strictEqual(unauthMe.statusCode, 401);

    const authMe = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${mentorToken}`);
    assert.strictEqual(authMe.statusCode, 200);
    assert.strictEqual(authMe.body.user.email, 'mentor2@test.com');

    // 6. Invite preview works without leaking password or private data
    const previewRes = await request(app).get(`/api/users/invite-preview/${inviteCode}`);
    assert.strictEqual(previewRes.statusCode, 200);
    assert.strictEqual(previewRes.body.mentor.name, 'Dr. Mentor Two');
    assert.strictEqual(previewRes.body.mentor.password, undefined);

    // 7. Register learner & outsider
    const learnerRes = await request(app).post('/api/auth/register').send({
      name: 'Learner Two',
      email: 'learner2@test.com',
      password: 'Password123!',
      role: 'learner',
    });
    assert.strictEqual(learnerRes.statusCode, 201);
    const learnerToken = learnerRes.body.token;

    const outsiderRes = await request(app).post('/api/auth/register').send({
      name: 'Outsider Two',
      email: 'outsider2@test.com',
      password: 'Password123!',
      role: 'learner',
    });
    const outsiderToken = outsiderRes.body.token;

    // 8. Role restriction: learner cannot directly POST /api/relationships
    const learnerCreateRel = await request(app)
      .post('/api/relationships')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ learnerEmail: 'outsider2@test.com', topic: 'Forbidden' });
    assert.strictEqual(learnerCreateRel.statusCode, 403);

    // 9. Learner joins via mentor invite code
    const joinRes = await request(app)
      .post('/api/relationships/join-by-code')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ inviteCode, topic: 'React & Backend Architecture' });
    assert.strictEqual(joinRes.statusCode, 201);
    const relId = joinRes.body.relationship._id;

    // 10. Outsider cannot access relationship or progress
    const outsiderRel = await request(app)
      .get(`/api/relationships/${relId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    assert.strictEqual(outsiderRel.statusCode, 403);

    const outsiderProg = await request(app)
      .get(`/api/relationships/${relId}/progress`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    assert.strictEqual(outsiderProg.statusCode, 403);

    // 11. Learner cannot change relationship status; mentor can
    const learnerUpdate = await request(app)
      .put(`/api/relationships/${relId}`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ status: 'completed' });
    assert.strictEqual(learnerUpdate.statusCode, 403);

    const mentorUpdate = await request(app)
      .put(`/api/relationships/${relId}`)
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ status: 'paused', meetingFrequency: 'Bi-weekly' });
    assert.strictEqual(mentorUpdate.statusCode, 200);
    assert.strictEqual(mentorUpdate.body.relationship.status, 'paused');

    // 12. Mentor can regenerate invite code
    const regenRes = await request(app)
      .post('/api/relationships/regenerate-invite')
      .set('Authorization', `Bearer ${mentorToken}`);
    assert.strictEqual(regenRes.statusCode, 200);
    assert.notStrictEqual(regenRes.body.inviteCode, inviteCode);
  });

  it('should enforce rate limiting when threshold is exceeded', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 2 });
    const makeRes = () => {
      const headers = {};
      return {
        statusCode: 200,
        body: null,
        setHeader: (k, v) => { headers[k] = v; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
      };
    };

    let nextCalls = 0;
    const req = { ip: '127.0.0.1', headers: {} };
    limiter(req, makeRes(), () => { nextCalls += 1; });
    limiter(req, makeRes(), () => { nextCalls += 1; });
    const thirdRes = makeRes();
    limiter(req, thirdRes, () => { nextCalls += 1; });

    assert.strictEqual(nextCalls, 2);
    assert.strictEqual(thirdRes.statusCode, 429);
    assert.strictEqual(thirdRes.body.success, false);
  });
});
