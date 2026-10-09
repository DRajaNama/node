const SupportCategory = require('../models/supportCategory.model');
const SupportArticle = require('../models/supportArticle.model');
const SupportSettings = require('../models/supportSettings.model');
let seedingDefaults;

const DEFAULT_CATEGORIES = [
  { slug: 'account-workspace', name: 'Account & Workspace', description: 'Sign-in, profile, team access, and workspace settings.', sortOrder: 10 },
  { slug: 'campaigns-email', name: 'Campaigns & Email', description: 'Campaign setup, sending, deliverability, and unsubscribes.', sortOrder: 20 },
  { slug: 'templates-content', name: 'Templates & Content', description: 'Email templates, landing pages, and AI-assisted content.', sortOrder: 30 },
  { slug: 'integrations-api', name: 'Integrations & API', description: 'Provider connections, API keys, and integration troubleshooting.', sortOrder: 40 },
  { slug: 'leads-automations', name: 'Lead Capture & Automations', description: 'Capture forms, landing pages, workflow triggers, and actions.', sortOrder: 45 },
  { slug: 'billing-subscriptions', name: 'Billing & Subscriptions', description: 'Plans, invoices, payment methods, and subscription questions.', sortOrder: 50 },
  { slug: 'privacy-data', name: 'Privacy & Data', description: 'Personal information, account data, exports, and deletion requests.', sortOrder: 60 },
  { slug: 'legal-compliance', name: 'Legal & Compliance', description: 'Platform terms, responsible use, consent, and compliance guidance.', sortOrder: 70 },
  { slug: 'troubleshooting', name: 'Troubleshooting', description: 'Common errors and steps to resolve them.', sortOrder: 80 },
];

const DEFAULT_ARTICLES = [
  {
    slug: 'getting-started-with-your-workspace', title: 'Getting started with your workspace', kind: 'article', category: 'account-workspace', sortOrder: 10,
    body: 'Start by reviewing your workspace profile and settings. Add or import contacts, organize them into lists, and confirm the addresses and consent status before sending. You can then create an email template, prepare a campaign, choose its audience, and review the send details before launch.\n\nIf a feature is unavailable, check your subscription plan or contact your workspace administrator.',
  },
  {
    slug: 'create-and-review-an-email-campaign', title: 'Create and review an email campaign', kind: 'article', category: 'campaigns-email', sortOrder: 20,
    body: 'Create a campaign from the Campaigns area. Add a clear subject and sender, select the intended contact list, and choose a saved template or create your content. Preview the message and check links, personalization, and mobile layout before scheduling or sending.\n\nConfirm that an email provider is connected and tested in Integrations. Review the campaign status and delivery results after sending.',
  },
  {
    slug: 'email-consent-and-unsubscribe-responsibilities', title: 'Email consent and unsubscribe responsibilities', kind: 'faq', category: 'legal-compliance', sortOrder: 10,
    body: 'Send campaigns only to people you are permitted to contact. Keep consent and source records, identify your organization clearly, and honor unsubscribe requests promptly. Do not re-add opted-out contacts without a valid basis and renewed permission.\n\nEmail marketing rules vary by country and message type. This product guide is general operational information, not legal advice. Confirm the requirements that apply to your organization with qualified counsel.',
  },
  {
    slug: 'unsubscribe-and-suppression-basics', title: 'How unsubscribes affect campaign contacts', kind: 'faq', category: 'campaigns-email', sortOrder: 30,
    body: 'The contact and campaign tools expose unsubscribe status so opted-out contacts can be excluded from future sends. Review audience filters and contact status before launching each campaign. If an unsubscribe is missing or a contact is still receiving messages, pause the campaign and contact support with the campaign and contact details. Do not include passwords or API keys in the request.',
  },
  {
    slug: 'connect-openai-and-protect-your-api-key', title: 'Connect OpenAI and protect your API key', kind: 'article', category: 'integrations-api', sortOrder: 10,
    body: 'Open Integrations, choose ChatGPT / OpenAI, enter your API key, and test the connection before saving. The application encrypts the key before storage and does not show the full key again after saving.\n\nTreat API keys like passwords. Do not paste them into support tickets. If a key may have been exposed, revoke it in the provider account, create a replacement, and update the integration.',
  },
  {
    slug: 'ai-content-and-your-review-responsibilities', title: 'Using AI-generated content responsibly', kind: 'faq', category: 'legal-compliance', sortOrder: 20,
    body: 'Review generated text before publishing or sending it. Check factual claims, permissions, brand requirements, accessibility, and applicable advertising and privacy rules. Do not submit confidential or personal information unless your organization has approved that use.\n\nRights and obligations can depend on your agreement with this platform and the AI provider, the input you provide, and local law. This FAQ does not determine ownership or provide legal advice; review the applicable terms and seek legal advice for your situation.',
  },
  {
    slug: 'ai-data-and-provider-privacy', title: 'What happens to information sent through AI tools?', kind: 'faq', category: 'privacy-data', sortOrder: 20,
    body: 'AI generation requests use the connected provider integration. The application stores the OpenAI API key encrypted and does not return the full key after saving. Information included in a prompt may be sent to that provider to fulfill the request.\n\nAvoid including sensitive personal, financial, health, or confidential information in prompts unless your organization has reviewed and approved the provider, settings, and applicable privacy terms. Check the provider’s current privacy documentation for its data handling and retention details.',
  },
  {
    slug: 'request-account-data-access-or-deletion', title: 'Request access to or deletion of account data', kind: 'faq', category: 'privacy-data', sortOrder: 10,
    body: 'Create a support request and choose Privacy & Data. Tell us the account email and describe the information or action you are requesting. We may need to verify account ownership before acting. Do not include passwords, API keys, payment card numbers, or other secrets.\n\nRequests are handled under the privacy notice and legal requirements that apply to your account. Contact your workspace administrator if you need a copy of the current privacy notice.',
  },
  {
    slug: 'find-current-terms-and-privacy-notices', title: 'Where can I find the applicable terms and privacy notice?', kind: 'faq', category: 'legal-compliance', sortOrder: 30,
    body: 'Use the terms of service and privacy notice provided by the organization that operates your account. If you cannot find the current documents, contact your workspace administrator or create a Legal & Compliance support request.\n\nThis help center explains product workflows and does not replace a contract, privacy notice, or legal advice. The documents that apply can depend on your organization, subscription, and jurisdiction.',
  },
  {
    slug: 'billing-plan-and-cancellation-questions', title: 'Billing, plan changes, and cancellation questions', kind: 'faq', category: 'billing-subscriptions', sortOrder: 10,
    body: 'Review your current plan and subscription details in Billing. For an invoice, charge, plan change, or cancellation question, create a Billing & Subscriptions support request and include the invoice number or transaction date. Never send full payment card details.\n\nAvailable cancellation timing, renewal terms, and refunds depend on the terms for your subscription. Check those terms or ask your account administrator before making a change.',
  },
  {
    slug: 'troubleshoot-a-failed-campaign-send', title: 'Troubleshoot a campaign that did not send', kind: 'article', category: 'troubleshooting', sortOrder: 10,
    body: 'Check the campaign status and delivery results first. Confirm that the audience contains eligible contacts, the campaign is not paused, and the connected email provider is active. If the provider connection is missing or invalid, reconnect and test it before retrying.\n\nIf the problem continues, contact support with the campaign name, approximate send time, and the error shown. Remove recipient personal data and secrets from screenshots or logs.',
  },
  {
    slug: 'change-workspace-access-and-profile-details', title: 'Update your profile and workspace access', kind: 'article', category: 'account-workspace', sortOrder: 20,
    body: 'Use your profile and settings pages to review the account details available to you. Workspace administrators manage access and role permissions. If you need access changed or see an unfamiliar account change, contact your administrator or submit an Account & Workspace support request.',
  },
  {
    slug: 'template-and-landing-page-review-checklist', title: 'Review templates and landing pages before publishing', kind: 'article', category: 'templates-content', sortOrder: 10,
    body: 'Preview your content on desktop and mobile. Check the page or email title, links, images, form destinations, contact details, and any privacy or consent language. Test forms with a safe test submission before publishing. Keep a copy of approved content and confirm you have permission to use its text, images, and branding.',
  },
  {
    slug: 'publish-and-test-a-lead-capture-form', title: 'Publish and test a lead capture form', kind: 'article', category: 'leads-automations', sortOrder: 10,
    body: 'Create or edit a lead capture form and review its fields, destination list, and confirmation behavior. Submit a test using a test contact, then confirm that the lead appears in the expected list before sharing the embed code or publishing the form.\n\nIf a submission is missing, verify the form is active and check that the selected list is available to your workspace.',
  },
  {
    slug: 'build-and-monitor-an-automation', title: 'Build and monitor an automation', kind: 'article', category: 'leads-automations', sortOrder: 20,
    body: 'Create an automation by choosing a trigger, adding any conditions, and selecting the action to run. Review the audience and action settings carefully, then enable the workflow when it is ready.\n\nUse the automation activity or logs to check whether a lead met the trigger and whether the action completed. If a workflow is paused or failing, review its configuration and connected integrations before enabling it again.',
  },
];

async function ensureSupportDefaults() {
  if (seedingDefaults) return seedingDefaults;
  seedingDefaults = seedSupportDefaults();
  try {
    return await seedingDefaults;
  } finally {
    seedingDefaults = null;
  }
}

async function seedSupportDefaults() {
  let claim;
  try {
    claim = await SupportSettings.findOneAndUpdate(
      { key: 'global', defaultsSeeded: { $ne: true } },
      { $set: { defaultsSeeded: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code === 11000 && await SupportSettings.exists({ key: 'global', defaultsSeeded: true })) return;
    throw error;
  }
  if (!claim) return;
  try {
    const categoryDocs = await Promise.all(DEFAULT_CATEGORIES.map((category) =>
      SupportCategory.findOneAndUpdate(
        { name: category.name },
        { $setOnInsert: { name: category.name, description: category.description, sortOrder: category.sortOrder, isActive: true } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    ));
    const categoryBySlug = new Map(DEFAULT_CATEGORIES.map((category, index) => [category.slug, categoryDocs[index]._id]));
    await Promise.all(DEFAULT_ARTICLES.map((article) =>
      SupportArticle.findOneAndUpdate(
        { slug: article.slug },
        { $setOnInsert: {
          title: article.title, slug: article.slug, body: article.body, kind: article.kind,
          categoryId: categoryBySlug.get(article.category), status: 'published', sortOrder: article.sortOrder,
        } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    ));
  } catch (error) {
    await SupportSettings.updateOne({ key: 'global' }, { $set: { defaultsSeeded: false } });
    throw error;
  }
}

module.exports = { ensureSupportDefaults, DEFAULT_CATEGORIES, DEFAULT_ARTICLES };
