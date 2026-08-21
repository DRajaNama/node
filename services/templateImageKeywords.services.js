const getTemplateImageKeywords = (template = {}) => {
  const values = [template.title, template.name, template.category, template.description, ...(template.tags || [])].filter(Boolean).join(' ');
  const words = values.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !['template', 'landing', 'page', 'email', 'modern', 'professional'].includes(word));
  return [...new Set(words)].slice(0, 3).join(' ') || 'business';
};
module.exports = { getTemplateImageKeywords };
