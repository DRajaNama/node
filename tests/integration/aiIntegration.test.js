process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ai-integration-test-secret';
process.env.AUTOMATION_ENCRYPTION_KEY = process.env.AUTOMATION_ENCRYPTION_KEY || 'ai-integration-test-encryption-key';

const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../../app');
const AIIntegration = require('../../models/aiIntegration.model');
const AIIntegrationService = require('../../services/aiIntegration.service');
const { encryptSecrets } = require('../../utils/automationSecrets.utils');
const { connectTestDb, disconnectTestDb, clearCollections } = require('../helpers/setupDb');
const { seedUsers, signToken } = require('../helpers/seed');
const { authHeader } = require('../helpers/auth');

describe('user OpenAI integrations', () => {
  let app;
  let users;
  let userAToken;
  let userBToken;
  const userAKey = 'sk-test-user-a-secret';
  const userBKey = 'sk-test-user-b-secret';

  before(async () => {
    await connectTestDb();
    app = createApp();
    users = await seedUsers();
    userAToken = signToken(users.customer);
    userBToken = signToken(users.admin);
  });

  after(async () => { await disconnectTestDb(); });

  it('keeps keys encrypted, private, owner-scoped, and independently disconnectable', async () => {
    await clearCollections();
    await AIIntegration.create([
      { userId: users.customer._id, apiKeyEncrypted: encryptSecrets({ apiKey: userAKey }), lastVerifiedAt: new Date() },
      { userId: users.admin._id, apiKeyEncrypted: encryptSecrets({ apiKey: userBKey }), lastVerifiedAt: new Date() },
    ]);

    const [statusA, statusB] = await Promise.all([
      request(app).get('/api/ai/integration').set(authHeader(userAToken)),
      request(app).get('/api/ai/integration').set(authHeader(userBToken)),
    ]);
    assert.equal(statusA.status, 200);
    assert.equal(statusB.status, 200);
    assert.equal(statusA.body.data.connected, true);
    assert.equal(statusB.body.data.connected, true);
    assert.equal(JSON.stringify(statusA.body).includes(userAKey), false);
    assert.equal(JSON.stringify(statusB.body).includes(userBKey), false);
    assert.notEqual((await AIIntegration.findOne({ userId: users.customer._id }).select('+apiKeyEncrypted')).apiKeyEncrypted, userAKey);

    assert.equal(await AIIntegrationService.getApiKey(users.customer._id), userAKey);
    assert.equal(await AIIntegrationService.getApiKey(users.admin._id), userBKey);
    await AIIntegrationService.disconnect(users.customer._id);
    await assert.rejects(AIIntegrationService.getApiKey(users.customer._id), /Please connect your ChatGPT\/OpenAI API key/);
    assert.equal(await AIIntegrationService.getApiKey(users.admin._id), userBKey);
  });
});
