const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    general: {
      siteName: { type: String, default: 'Pro Marketing' },
      siteDescription: { type: String, default: '' },
      logo: { type: String, default: '' },
      favicon: { type: String, default: '' },
      contactEmail: { type: String, default: '' },
      supportEmail: { type: String, default: '' },
      phone: { type: String, default: '' },
      address: { type: String, default: '' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      language: { type: String, default: 'en' },
      currency: { type: String, default: 'USD' },
      dateFormat: { type: String, default: 'YYYY-MM-DD' },
    },
    branding: {
      primaryColor: { type: String, default: '' },
      secondaryColor: { type: String, default: '' },
    },
    theme: {
      primary: { type: String, default: '#2B2E46' },
      secondary: { type: String, default: '#929EB1' },
      background: { type: String, default: '#EFF4F6' },
      accent: { type: String, default: '#F51D38' },
      accentHover: { type: String, default: '#E40024' },
    },
    smtp: {
      host: { type: String, default: '' },
      port: { type: Number, default: 587 },
      username: { type: String, default: '' },
      password: { type: String, default: '', select: false },
      encryption: { type: String, enum: ['TLS', 'SSL', 'None'], default: 'TLS' },
      fromName: { type: String, default: '' },
      fromEmail: { type: String, default: '' },
    },
    seo: {
      defaultTitle: { type: String, default: '' },
      metaDescription: { type: String, default: '' },
      keywords: { type: String, default: '' },
      robots: { type: String, default: 'index,follow' },
      canonicalUrl: { type: String, default: '' },
      ogTitle: { type: String, default: '' },
      ogDescription: { type: String, default: '' },
      ogImage: { type: String, default: '' },
      twitterCard: { type: String, default: 'summary_large_image' },
    },
    social: {
      facebook: { type: String, default: '' },
      twitter: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      instagram: { type: String, default: '' },
    },
    security: {
      maintenanceMode: { type: Boolean, default: false },
      allowRegistration: { type: Boolean, default: true },
      requireEmailVerification: { type: Boolean, default: true },
      loginAlert: { type: Boolean, default: false },
    },
    rolePermissions: {
      user: { type: [String], default: [] },
      admin: { type: [String], default: [] },
    },
    integrations: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

systemSettingsSchema.methods.toJSON = function () {
  const obj = this.toObject();
  if (obj.smtp) delete obj.smtp.password;
  if (obj.integrations?.pixabay?.config?.apiKey) delete obj.integrations.pixabay.config.apiKey;
  if (obj.integrations?.paypal?.config) {
    delete obj.integrations.paypal.config.clientSecret;
    delete obj.integrations.paypal.config.clientId;
  }
  return obj;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
