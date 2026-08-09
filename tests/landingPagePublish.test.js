const test = require('node:test');
const assert = require('node:assert/strict');
const {
  landingPageScheduleValidation,
  landingPagePublishValidation,
  hasPublishableContent,
} = require('../validations/landingPage.validations');

test('hasPublishableContent rejects empty html', () => {
  assert.equal(hasPublishableContent(''), false);
  assert.equal(hasPublishableContent('<p></p>'), false);
  assert.equal(hasPublishableContent('<p>Hello</p>'), true);
});

test('landingPagePublishValidation requires slug and content', () => {
  const invalid = landingPagePublishValidation({ slug: '', html: '<p></p>' });
  assert.equal(invalid.isValid, false);

  const valid = landingPagePublishValidation({ slug: 'my-page', html: '<p>Content</p>' });
  assert.equal(valid.isValid, true);
});

test('landingPageScheduleValidation rejects past datetime', () => {
  const past = new Date(Date.now() - 60000).toISOString();
  const result = landingPageScheduleValidation({ scheduledPublishAt: past, timezone: 'Asia/Kolkata' });
  assert.equal(result.isValid, false);
});

test('landingPageScheduleValidation accepts future datetime', () => {
  const future = new Date(Date.now() + 3600000).toISOString();
  const result = landingPageScheduleValidation({ scheduledPublishAt: future, timezone: 'Asia/Kolkata' });
  assert.equal(result.isValid, true);
});
