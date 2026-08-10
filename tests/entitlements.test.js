const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const PlanService = require('../services/plan.services');
const QuotaExceededError = require('../helpers/quotaError');
const { getRegistryEntry, RESOURCE_KEYS } = require('../config/entitlements.registry');

describe('PlanService.validatePlanData', () => {
  it('requires plan name and slug', () => {
    const errors = PlanService.validatePlanData({ monthlyPrice: 0, yearlyPrice: 0 });
    assert.ok(errors.some((e) => e.includes('Plan name')));
    assert.ok(errors.some((e) => e.includes('Slug')));
  });

  it('rejects negative prices', () => {
    const errors = PlanService.validatePlanData({
      name: 'Test',
      slug: 'test',
      monthlyPrice: -1,
      yearlyPrice: 0,
    });
    assert.ok(errors.some((e) => e.includes('Monthly price')));
  });

  it('rejects unknown entitlement keys', () => {
    const errors = PlanService.validatePlanData({
      name: 'Test',
      slug: 'test',
      entitlements: [{ key: 'invalid_key', type: 'limit' }],
    });
    assert.ok(errors.some((e) => e.includes('Unknown entitlement')));
  });
});

describe('QuotaExceededError', () => {
  it('sets code and details', () => {
    const err = new QuotaExceededError('limit reached', {
      resourceKey: RESOURCE_KEYS.CONTACTS,
      usage: 1000,
      limit: 1000,
    });
    assert.equal(err.code, 'QUOTA_EXCEEDED');
    assert.equal(err.details.resourceKey, RESOURCE_KEYS.CONTACTS);
  });
});

describe('entitlements registry', () => {
  it('includes contacts resource', () => {
    const entry = getRegistryEntry(RESOURCE_KEYS.CONTACTS);
    assert.ok(entry);
    assert.equal(entry.enforceOnCreate, true);
  });
});
