const { prepareEmailHtml } = require('./template.helper');

const preparePublishHtml = (html) => {
  if (!html) return '';
  return prepareEmailHtml(html);
};

module.exports = {
  preparePublishHtml,
};
