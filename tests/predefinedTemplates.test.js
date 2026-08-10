const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { PREDEFINED_TEMPLATE_TYPES, TYPE_TO_ENTITLEMENT_KEY } = require('../constants/predefinedTemplate.constants');

describe('predefined template constants', () => {
  it('maps email type to entitlement key', () => {
    assert.equal(TYPE_TO_ENTITLEMENT_KEY[PREDEFINED_TEMPLATE_TYPES.EMAIL], 'predefined_email_templates');
  });

  it('maps landing page type to entitlement key', () => {
    assert.equal(TYPE_TO_ENTITLEMENT_KEY[PREDEFINED_TEMPLATE_TYPES.LANDING_PAGE], 'predefined_landing_pages');
  });

  it('maps popup type to entitlement key', () => {
    assert.equal(TYPE_TO_ENTITLEMENT_KEY[PREDEFINED_TEMPLATE_TYPES.POPUP], 'predefined_popup_templates');
  });
});
