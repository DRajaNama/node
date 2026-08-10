const PREDEFINED_TEMPLATE_TYPES = {
  EMAIL: 'email',
  LANDING_PAGE: 'landing_page',
  POPUP: 'popup',
};

const PREDEFINED_TEMPLATE_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
  ARCHIVED: 'archived',
};

const TYPE_TO_ENTITLEMENT_KEY = {
  [PREDEFINED_TEMPLATE_TYPES.EMAIL]: 'predefined_email_templates',
  [PREDEFINED_TEMPLATE_TYPES.LANDING_PAGE]: 'predefined_landing_pages',
  [PREDEFINED_TEMPLATE_TYPES.POPUP]: 'predefined_popup_templates',
};

const TYPE_TO_EDITOR = {
  [PREDEFINED_TEMPLATE_TYPES.EMAIL]: 'email',
  [PREDEFINED_TEMPLATE_TYPES.LANDING_PAGE]: 'landing',
  [PREDEFINED_TEMPLATE_TYPES.POPUP]: 'popup',
};

module.exports = {
  PREDEFINED_TEMPLATE_TYPES,
  PREDEFINED_TEMPLATE_STATUS,
  TYPE_TO_ENTITLEMENT_KEY,
  TYPE_TO_EDITOR,
};
