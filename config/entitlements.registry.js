/**
 * Central registry for plan entitlements.
 * Add new keys here — no plan-name branching in business logic.
 */

const ENTITLEMENT_TYPES = {
  BOOLEAN: 'boolean',
  LIMIT: 'limit',
  PERIOD_LIMIT: 'period_limit',
};

const RESOURCE_KEYS = {
  CONTACTS: 'contacts',
  LISTS: 'lists',
  EMAIL_SENDS: 'email_sends',
  CUSTOM_EMAIL_TEMPLATES: 'custom_email_templates',
  PREDEFINED_EMAIL_TEMPLATES: 'predefined_email_templates',
  CUSTOM_LANDING_PAGES: 'custom_landing_pages',
  PREDEFINED_LANDING_PAGES: 'predefined_landing_pages',
  PREDEFINED_POPUP_TEMPLATES: 'predefined_popup_templates',
  LEAD_CAPTURE_FORMS: 'lead_capture_forms',
  TEAM_MEMBERS: 'team_members',
  AUTOMATION_WORKFLOWS: 'automation_workflows',
};

const FEATURE_KEYS = {
  MARKETING_AUTOMATION: 'marketing_automation',
  AB_TESTING: 'ab_testing',
  ADVANCED_REPORTING: 'advanced_reporting',
  WEB_EVENT_TRACKING: 'web_event_tracking',
  AI_SEND_TIME_OPTIMIZATION: 'ai_send_time_optimization',
  CONTACT_SCORING: 'contact_scoring',
  AI_SEGMENTATION: 'ai_segmentation',
  MULTI_USER_ACCESS: 'multi_user_access',
  ADDITIONAL_CHANNELS: 'additional_channels',
  MULTI_ACCOUNT: 'multi_account',
  CUSTOM_OBJECTS: 'custom_objects',
};

const REGISTRY = [
  { key: RESOURCE_KEYS.CONTACTS, label: 'Contacts', category: 'resource', type: ENTITLEMENT_TYPES.LIMIT, enforceOnCreate: true },
  { key: RESOURCE_KEYS.LISTS, label: 'Lists', category: 'resource', type: ENTITLEMENT_TYPES.LIMIT, enforceOnCreate: true },
  { key: RESOURCE_KEYS.EMAIL_SENDS, label: 'Emails / Month', category: 'resource', type: ENTITLEMENT_TYPES.PERIOD_LIMIT, period: 'monthly', enforceOnCreate: true },
  { key: RESOURCE_KEYS.CUSTOM_EMAIL_TEMPLATES, label: 'Custom Email Templates', category: 'resource', type: ENTITLEMENT_TYPES.LIMIT, enforceOnCreate: true },
  { key: RESOURCE_KEYS.PREDEFINED_EMAIL_TEMPLATES, label: 'Predefined Email Templates', category: 'resource', type: ENTITLEMENT_TYPES.LIMIT, enforceOnCreate: false },
  { key: RESOURCE_KEYS.CUSTOM_LANDING_PAGES, label: 'Custom Landing Pages', category: 'resource', type: ENTITLEMENT_TYPES.LIMIT, enforceOnCreate: true },
  { key: RESOURCE_KEYS.PREDEFINED_LANDING_PAGES, label: 'Predefined Landing Pages', category: 'resource', type: ENTITLEMENT_TYPES.LIMIT, enforceOnCreate: false },
  { key: RESOURCE_KEYS.PREDEFINED_POPUP_TEMPLATES, label: 'Predefined Popup Templates', category: 'resource', type: ENTITLEMENT_TYPES.LIMIT, enforceOnCreate: false },
  { key: RESOURCE_KEYS.LEAD_CAPTURE_FORMS, label: 'Lead Capture Forms', category: 'resource', type: ENTITLEMENT_TYPES.LIMIT, enforceOnCreate: true },
  { key: RESOURCE_KEYS.TEAM_MEMBERS, label: 'Team Members', category: 'resource', type: ENTITLEMENT_TYPES.LIMIT, enforceOnCreate: false },
  { key: RESOURCE_KEYS.AUTOMATION_WORKFLOWS, label: 'Automation Workflows', category: 'resource', type: ENTITLEMENT_TYPES.LIMIT, enforceOnCreate: true },
  { key: FEATURE_KEYS.MARKETING_AUTOMATION, label: 'Marketing Automation', category: 'feature', type: ENTITLEMENT_TYPES.BOOLEAN },
  { key: FEATURE_KEYS.AB_TESTING, label: 'A/B Testing', category: 'feature', type: ENTITLEMENT_TYPES.BOOLEAN },
  { key: FEATURE_KEYS.ADVANCED_REPORTING, label: 'Advanced Reporting', category: 'feature', type: ENTITLEMENT_TYPES.BOOLEAN },
  { key: FEATURE_KEYS.WEB_EVENT_TRACKING, label: 'Web/Event Tracking', category: 'feature', type: ENTITLEMENT_TYPES.BOOLEAN },
  { key: FEATURE_KEYS.AI_SEND_TIME_OPTIMIZATION, label: 'AI Send-Time Optimization', category: 'feature', type: ENTITLEMENT_TYPES.BOOLEAN },
  { key: FEATURE_KEYS.CONTACT_SCORING, label: 'Contact Scoring', category: 'feature', type: ENTITLEMENT_TYPES.BOOLEAN },
  { key: FEATURE_KEYS.AI_SEGMENTATION, label: 'AI Segmentation', category: 'feature', type: ENTITLEMENT_TYPES.BOOLEAN },
  { key: FEATURE_KEYS.MULTI_USER_ACCESS, label: 'Multi-user Access', category: 'feature', type: ENTITLEMENT_TYPES.BOOLEAN },
  { key: FEATURE_KEYS.ADDITIONAL_CHANNELS, label: 'Additional Channels', category: 'feature', type: ENTITLEMENT_TYPES.BOOLEAN },
  { key: FEATURE_KEYS.MULTI_ACCOUNT, label: 'Multi-account', category: 'feature', type: ENTITLEMENT_TYPES.BOOLEAN },
  { key: FEATURE_KEYS.CUSTOM_OBJECTS, label: 'Custom Objects', category: 'feature', type: ENTITLEMENT_TYPES.BOOLEAN },
];

const getRegistryEntry = (key) => REGISTRY.find((r) => r.key === key);

const getDefaultEntitlement = (entry) => {
  if (!entry) return null;
  if (entry.type === ENTITLEMENT_TYPES.BOOLEAN) {
    return { key: entry.key, type: entry.type, enabled: false };
  }
  return {
    key: entry.key,
    type: entry.type,
    enabled: true,
    limit: 0,
    isUnlimited: false,
    period: entry.period || null,
  };
};

module.exports = {
  ENTITLEMENT_TYPES,
  RESOURCE_KEYS,
  FEATURE_KEYS,
  REGISTRY,
  getRegistryEntry,
  getDefaultEntitlement,
};
