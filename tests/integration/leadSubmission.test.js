process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { connectTestDb, disconnectTestDb, clearCollections } = require('../helpers/setupDb');
const createApp = require('../../app');
const Contact = require('../../models/contacts.model');
const FormPopup = require('../../models/formPopup.model');
const Lead = require('../../models/lead.model');
const AutomationDispatchService = require('../../services/automationDispatch.services');

test.before(async () => {
  await connectTestDb();
});

test.afterEach(async () => {
  await clearCollections();
});

test.after(async () => {
  await disconnectTestDb();
});

test('form popup submission maps standard aliases and stores other fields as JSON', async () => {
  const userId = new mongoose.Types.ObjectId();
  const popup = await FormPopup.create({
    userId,
    name: 'Custom lead popup',
    html: '<form></form>',
    status: 'published',
  });
  const originalDispatch = AutomationDispatchService.dispatchLead;
  AutomationDispatchService.dispatchLead = async () => null;

  try {
    const response = await request(createApp())
      .post('/api/public/lead/submit')
      .send({
        formPopupId: popup._id.toString(),
        firstname: 'Ada',
        'Last Name': 'Lovelace',
        'Email Address': 'ADA@Example.com',
        mobile_number: '+44 1234',
        company: 'Analytical Engines',
        interests: ['mathematics', 'computing'],
        popupName: 'Custom lead popup',
        source: 'form-popup',
      });

    assert.equal(response.status, 200);

    const lead = await Lead.findById(response.body.data._id).lean();
    assert.equal(lead.firstName, 'Ada');
    assert.equal(lead.lastName, 'Lovelace');
    assert.equal(lead.email, 'ada@example.com');
    assert.equal(lead.phone, '+44 1234');
    assert.deepEqual(lead.fields, {
      company: 'Analytical Engines',
      interests: ['mathematics', 'computing'],
    });

    const contact = await Contact.findOne({ userId, email: 'ada@example.com' }).lean();
    assert.equal(contact.firstName, 'Ada');
    assert.equal(contact.lastName, 'Lovelace');
    assert.equal(contact.mobile, '+44 1234');
  } finally {
    AutomationDispatchService.dispatchLead = originalDispatch;
  }
});
