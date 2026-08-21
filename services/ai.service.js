const OpenAI = require('openai');
const cheerio = require('cheerio');
require('dotenv').config();

const MAX_SOURCE_CHARS = 30000;
const ALLOWED_TYPES = new Set(['email', 'landing', 'popup']);

const normaliseUrl = (value) => {
  const url = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Website URL must use http or https.');
  if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('Local website URLs are not allowed.');
  return url.toString();
};

const getWebsiteContext = async (websiteUrl) => {
  const response = await fetch(websiteUrl, {
    redirect: 'follow', signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': 'MailflowTemplateGenerator/1.0' },
  });
  if (!response.ok) throw new Error(`The website returned HTTP ${response.status}.`);
  if (!(response.headers.get('content-type') || '').includes('text/html')) throw new Error('The URL did not return an HTML website.');
  const $ = cheerio.load(await response.text());
  $('script, style, noscript, svg, iframe').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, MAX_SOURCE_CHARS);
  if (!text) throw new Error('The website did not provide enough readable content.');
  return { url: response.url, title: $('title').text().trim(), description: $('meta[name="description"]').attr('content') || '', text };
};

const cleanHtml = (html, type) => {
  const $ = cheerio.load(String(html || ''), { decodeEntities: false });
  $('script, iframe, object, embed, link[rel="import"]').remove();
  $('*').each((_, element) => Object.keys(element.attribs || {}).forEach((name) => {
    if (/^on/i.test(name) || name.toLowerCase() === 'srcdoc') $(element).removeAttr(name);
  }));
  const result = $.html();
  if (!result || result.length < 100) throw new Error('The AI response did not contain a usable template.');
  return result.replace(/<head>/i, `<head><meta name="visual-editor-type" content="${type}">`);
};

const buildPrompt = ({ assetType, emailType, targetAudience, tone, websiteUrl, website }) => `Create a complete, polished, editable ${assetType} marketing template from the supplied website source.
Rules: use only facts supported by the source; never invent prices, discounts, claims, guarantees, reviews, deadlines, or product details; use ${websiteUrl} as every primary CTA destination; ${emailType === 'affiliate' ? 'include a concise, visible affiliate disclosure.' : 'do not add an affiliate disclosure unless the source supports it.'} Target audience: ${targetAudience || 'not specified'}; tone: ${tone || 'professional'}; campaign type: ${emailType || 'promotional'}. Return valid, self-contained HTML only—no Markdown, explanation, script, external JavaScript, tracking, or fabricated image URLs. Add <meta name="visual-editor-type" content="${assetType}">. For email use responsive table markup; for landing and popup use clear sections and inline styles compatible with a visual editor. If details are absent, use conservative copy.
Website final URL: ${website.url}
Website title: ${website.title}
Website description: ${website.description}
Website readable content: ${website.text}`;

const AIService = {
  async generateTemplate(input) {
    const assetType = String(input.assetType || '').toLowerCase();
    if (!ALLOWED_TYPES.has(assetType)) throw new Error('Asset type must be email, landing, or popup.');
    console.log('process',process.env.OPENAI_API_KEY)
    if (!process.env.OPENAI_API_KEY) throw new Error('AI generation is not configured. Set OPENAI_API_KEY on the server.');
    const websiteUrl = normaliseUrl(input.websiteUrl);
    const website = await getWebsiteContext(websiteUrl);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({ model: process.env.OPENAI_TEMPLATE_MODEL || 'gpt-5.4', input: buildPrompt({ ...input, websiteUrl, website }), max_output_tokens: 8000, store: false });
    return { html: cleanHtml(response.output_text, assetType), sourceUrl: website.url, title: website.title };
  },
};

module.exports = AIService;
