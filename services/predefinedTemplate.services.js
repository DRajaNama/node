const PredefinedTemplate = require('../models/predefinedTemplate.model');
const Template = require('../models/template.model');
const LandingPage = require('../models/landingPage.model');
const FormPopup = require('../models/formPopup.model');
const EntitlementService = require('./entitlement.services');
const {
  PREDEFINED_TEMPLATE_TYPES,
  PREDEFINED_TEMPLATE_STATUS,
  TYPE_TO_ENTITLEMENT_KEY,
} = require('../constants/predefinedTemplate.constants');
const { getBlankTemplate } = require('../utils/template.utils');
const { getBlankLandingPageHtml, getBlankFormPopupHtml } = require('../utils/landingPage.utils');

const paginate = async (filter, page = 1, limit = 20, sort = { displayOrder: 1, updatedAt: -1 }) => {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    PredefinedTemplate.find(filter).sort(sort).skip(skip).limit(limit),
    PredefinedTemplate.countDocuments(filter),
  ]);
  return { data, total };
};

const getBlankHtmlForType = (type) => {
  switch (type) {
    case PREDEFINED_TEMPLATE_TYPES.EMAIL:
      return getBlankTemplate({}).html;
    case PREDEFINED_TEMPLATE_TYPES.LANDING_PAGE:
      return getBlankLandingPageHtml();
    case PREDEFINED_TEMPLATE_TYPES.POPUP:
      return getBlankFormPopupHtml();
    default:
      return '';
  }
};

const PredefinedTemplateService = {
  async hasPredefinedAccess(userId, type) {
    const key = TYPE_TO_ENTITLEMENT_KEY[type];
    if (!key) return false;
    const ent = await EntitlementService.getPlanEntitlement(userId, key);
    if (!ent) return false;
    if (ent.type === 'boolean') return ent.enabled === true;
    return ent.enabled === true || ent.isUnlimited === true || (ent.limit ?? 0) > 0;
  },

  async listForCustomer(userId, query = {}) {
    const type = query.type;
    if (!type || !TYPE_TO_ENTITLEMENT_KEY[type]) {
      throw new Error('Valid template type is required');
    }
    const hasAccess = await this.hasPredefinedAccess(userId, type);
    if (!hasAccess) {
      return { data: [], total: 0 };
    }

    const filter = {
      type,
      status: PREDEFINED_TEMPLATE_STATUS.PUBLISHED,
      ownerType: 'system',
    };
    if (query.category) filter.category = query.category;
    if (query.featured === 'true') filter.isFeatured = true;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
        { tags: { $regex: query.search, $options: 'i' } },
      ];
    }
    if (query.tag) {
      filter.tags = query.tag;
    }

    const sortField = query.sort === 'name' ? 'name' : 'displayOrder';
    const sortDir = query.sortDir === 'desc' ? -1 : 1;
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 50;

    const result = await paginate(filter, page, limit, { [sortField]: sortDir, name: 1 });
    return result;
  },

  async getCategories(type) {
    const filter = { type, ownerType: 'system' };
    if (type) {
      return PredefinedTemplate.distinct('category', filter).then((cats) =>
        cats.filter((c) => c && c.trim()).sort()
      );
    }
    return [];
  },

  async getById(id) {
    return PredefinedTemplate.findById(id);
  },

  async listAdmin(filter = {}, page = 1, limit = 20) {
    return paginate(filter, page, limit);
  },

  async getStats() {
    const types = Object.values(PREDEFINED_TEMPLATE_TYPES);
    const stats = { total: 0, byType: {}, published: 0, draft: 0, archived: 0 };
    for (const type of types) {
      stats.byType[type] = await PredefinedTemplate.countDocuments({ type });
      stats.total += stats.byType[type];
    }
    stats.published = await PredefinedTemplate.countDocuments({ status: PREDEFINED_TEMPLATE_STATUS.PUBLISHED });
    stats.draft = await PredefinedTemplate.countDocuments({ status: PREDEFINED_TEMPLATE_STATUS.DRAFT });
    stats.archived = await PredefinedTemplate.countDocuments({ status: PREDEFINED_TEMPLATE_STATUS.ARCHIVED });
    return stats;
  },

  async create(data, adminUserId) {
    const html = data.html || getBlankHtmlForType(data.type);
    return PredefinedTemplate.create({
      ...data,
      html,
      ownerType: 'system',
      version: 1,
      createdBy: adminUserId,
      updatedBy: adminUserId,
    });
  },

  async update(id, data, adminUserId) {
    const existing = await PredefinedTemplate.findById(id);
    if (!existing) throw new Error('Template not found');

    const updates = { ...data, updatedBy: adminUserId };
    if (data.html && data.html !== existing.html) {
      updates.version = (existing.version || 1) + 1;
    }
    return PredefinedTemplate.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
  },

  async duplicate(id, adminUserId) {
    const source = await PredefinedTemplate.findById(id);
    if (!source) throw new Error('Template not found');
    const slug = `${source.slug}-copy-${Date.now()}`;
    return PredefinedTemplate.create({
      name: `${source.name} Copy`,
      slug,
      type: source.type,
      description: source.description,
      thumb: source.thumb,
      previewUrl: source.previewUrl,
      html: source.html,
      category: source.category,
      tags: source.tags,
      status: PREDEFINED_TEMPLATE_STATUS.DRAFT,
      displayOrder: source.displayOrder + 1,
      isFeatured: false,
      version: 1,
      ownerType: 'system',
      createdBy: adminUserId,
      updatedBy: adminUserId,
    });
  },

  async publish(id, adminUserId) {
    return PredefinedTemplate.findByIdAndUpdate(
      id,
      { $set: { status: PREDEFINED_TEMPLATE_STATUS.PUBLISHED, updatedBy: adminUserId } },
      { new: true }
    );
  },

  async unpublish(id, adminUserId) {
    return PredefinedTemplate.findByIdAndUpdate(
      id,
      { $set: { status: PREDEFINED_TEMPLATE_STATUS.UNPUBLISHED, updatedBy: adminUserId } },
      { new: true }
    );
  },

  async archive(id, adminUserId) {
    return PredefinedTemplate.findByIdAndUpdate(
      id,
      { $set: { status: PREDEFINED_TEMPLATE_STATUS.ARCHIVED, updatedBy: adminUserId } },
      { new: true }
    );
  },

  async delete(id) {
    const doc = await PredefinedTemplate.findById(id);
    if (!doc) throw new Error('Template not found');
    if (doc.useCount > 0) {
      throw new Error('Cannot delete template that has been used. Archive instead.');
    }
    return PredefinedTemplate.findByIdAndDelete(id);
  },

  async useTemplate(userId, predefinedId, payload = {}) {
    const predefined = await PredefinedTemplate.findById(predefinedId);
    if (!predefined) throw new Error('Predefined template not found');
    if (predefined.status !== PREDEFINED_TEMPLATE_STATUS.PUBLISHED) {
      throw new Error('Template is not available');
    }
    const hasAccess = await this.hasPredefinedAccess(userId, predefined.type);
    if (!hasAccess) {
      throw new Error('Your plan does not include access to this template library');
    }

    let created;
    const snapshotVersion = predefined.version || 1;

    switch (predefined.type) {
      case PREDEFINED_TEMPLATE_TYPES.EMAIL:
        created = await Template.create({
          userId,
          categoryId: payload.categoryId,
          title: payload.title || predefined.name,
          description: payload.description || predefined.description,
          html: predefined.html,
          thumb: predefined.thumb || 'template.png',
          status: 'draft',
          defaultTemplateId: predefined._id,
          predefinedTemplateVersion: snapshotVersion,
        });
        break;

      case PREDEFINED_TEMPLATE_TYPES.LANDING_PAGE:
        created = await LandingPage.create({
          userId,
          name: payload.name || predefined.name,
          slug: (payload.slug || predefined.slug).trim().toLowerCase(),
          description: payload.description || predefined.description,
          html: predefined.html,
          thumb: predefined.thumb || 'landing.png',
          status: 'draft',
          stats: { views: 0, leads: 0 },
          predefinedTemplateId: predefined._id,
          predefinedTemplateVersion: snapshotVersion,
        });
        break;

      case PREDEFINED_TEMPLATE_TYPES.POPUP:
        created = await FormPopup.create({
          userId,
          name: payload.name || predefined.name,
          description: payload.description || predefined.description,
          html: predefined.html,
          thumb: predefined.thumb || 'template.png',
          status: 'draft',
          predefinedTemplateId: predefined._id,
          predefinedTemplateVersion: snapshotVersion,
        });
        break;

      default:
        throw new Error('Unsupported template type');
    }

    await PredefinedTemplate.findByIdAndUpdate(predefined._id, { $inc: { useCount: 1 } });
    return { resource: created, type: predefined.type };
  },

  async seedDefaultTemplatesIfEmpty() {
    const count = await PredefinedTemplate.countDocuments();
    if (count > 0) return;

    const samples = [
      { name: 'Welcome Email', slug: 'welcome-email', type: PREDEFINED_TEMPLATE_TYPES.EMAIL, category: 'Welcome', description: 'Welcome new subscribers', html: getBlankTemplate({}).html, status: PREDEFINED_TEMPLATE_STATUS.PUBLISHED, displayOrder: 1, isFeatured: true },
      { name: 'Newsletter', slug: 'newsletter', type: PREDEFINED_TEMPLATE_TYPES.EMAIL, category: 'Newsletter', description: 'Monthly newsletter layout', html: getBlankTemplate({}).html, status: PREDEFINED_TEMPLATE_STATUS.PUBLISHED, displayOrder: 2 },
      { name: 'Lead Generation', slug: 'lead-generation', type: PREDEFINED_TEMPLATE_TYPES.LANDING_PAGE, category: 'Lead Generation', description: 'Capture leads with a focused layout', html: getBlankLandingPageHtml(), status: PREDEFINED_TEMPLATE_STATUS.PUBLISHED, displayOrder: 1, isFeatured: true },
      { name: 'Webinar Landing', slug: 'webinar-landing', type: PREDEFINED_TEMPLATE_TYPES.LANDING_PAGE, category: 'Webinar', description: 'Promote webinar registrations', html: getBlankLandingPageHtml(), status: PREDEFINED_TEMPLATE_STATUS.PUBLISHED, displayOrder: 2 },
      { name: 'Newsletter Signup', slug: 'newsletter-signup-popup', type: PREDEFINED_TEMPLATE_TYPES.POPUP, category: 'Newsletter', description: 'Simple newsletter popup', html: getBlankFormPopupHtml(), status: PREDEFINED_TEMPLATE_STATUS.PUBLISHED, displayOrder: 1 },
      { name: 'Discount Popup', slug: 'discount-popup', type: PREDEFINED_TEMPLATE_TYPES.POPUP, category: 'Discount', description: 'Offer a discount code', html: getBlankFormPopupHtml(), status: PREDEFINED_TEMPLATE_STATUS.PUBLISHED, displayOrder: 2, isFeatured: true },
    ];

    await PredefinedTemplate.insertMany(samples.map((s) => ({ ...s, ownerType: 'system', tags: [] })));
  },
};

module.exports = PredefinedTemplateService;
