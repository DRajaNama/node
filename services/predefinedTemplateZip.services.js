const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { pipeline } = require('stream/promises');
const unzipper = require('unzipper');
const cheerio = require('cheerio');

const ROOT = path.resolve(__dirname, '..', 'uploads', 'predefinedtemplates');
const MAX_ENTRIES = 1000;
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

const safeArchivePath = (entryPath) => {
  const normalized = path.posix.normalize(String(entryPath).replace(/\\/g, '/'));
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.startsWith('/') || normalized.includes('\0')) {
    throw new Error('The ZIP contains an unsafe file path.');
  }
  return normalized;
};

const isExternal = (url) => /^(?:[a-z][a-z\d+.-]*:|\/\/|#|data:)/i.test(url.trim());

const rewriteHtmlAssetPaths = (html, htmlEntry, files, templateId) => {
  const $ = cheerio.load(html, { decodeEntities: false });
  const htmlDir = path.posix.dirname(htmlEntry);
  const base = `/uploads/predefinedtemplates/${templateId}/`;
  const rewrite = (value) => {
    if (!value || isExternal(value)) return value;
    const [assetPath, suffix = ''] = value.split(/(?=[?#])/, 2);
    const resolved = path.posix.normalize(path.posix.join(htmlDir === '.' ? '' : htmlDir, assetPath));
    if (resolved.startsWith('../') || !files.has(resolved)) return value;
    return `${base}${resolved}${suffix}`;
  };

  $('img[src], source[src], video[src], audio[src], video[poster], link[href]').each((_index, element) => {
    const attribute = element.name === 'link' ? 'href' : element.attribs.poster !== undefined ? 'poster' : 'src';
    $(element).attr(attribute, rewrite($(element).attr(attribute) || ''));
  });
  $('[style]').each((_index, element) => {
    const style = $(element).attr('style') || '';
    $(element).attr('style', style.replace(/url\((['"]?)([^'")]+)\1\)/gi, (_match, quote, url) => `url(${quote}${rewrite(url)}${quote})`));
  });
  return $.html();
};

const PredefinedTemplateZipService = {
  async extractAndProcess(zipPath, templateId) {
    const archive = await unzipper.Open.file(zipPath);
    if (!archive.files.length || archive.files.length > MAX_ENTRIES) throw new Error('ZIP must contain between 1 and 1,000 files.');
    const files = new Map();
    let totalSize = 0;
    for (const entry of archive.files) {
      const entryPath = safeArchivePath(entry.path);
      if (entry.type === 'Directory') continue;
      totalSize += entry.uncompressedSize || 0;
      if (totalSize > MAX_UNCOMPRESSED_BYTES) throw new Error('Extracted ZIP content exceeds the 100MB limit.');
      files.set(entryPath, entry);
    }
    const htmlEntries = [...files.keys()].filter((file) => /\.html?$/i.test(file));
    if (htmlEntries.length !== 1) throw new Error('ZIP must contain exactly one HTML file.');

    const finalDirectory = path.join(ROOT, String(templateId));
    const stagingDirectory = path.join(ROOT, `.staging-${templateId}-${Date.now()}`);
    await fsp.mkdir(stagingDirectory, { recursive: true });
    try {
      for (const [entryPath, entry] of files) {
        const output = path.resolve(stagingDirectory, entryPath);
        if (!output.startsWith(`${stagingDirectory}${path.sep}`)) throw new Error('The ZIP contains an unsafe file path.');
        await fsp.mkdir(path.dirname(output), { recursive: true });
        await pipeline(entry.stream(), fs.createWriteStream(output, { flags: 'wx' }));
      }
      const htmlEntry = htmlEntries[0];
      const rawHtml = await fsp.readFile(path.join(stagingDirectory, htmlEntry), 'utf8');
      const html = rewriteHtmlAssetPaths(rawHtml, htmlEntry, new Set(files.keys()), templateId);
      await fsp.writeFile(path.join(stagingDirectory, 'index.html'), html, 'utf8');

      await fsp.rm(finalDirectory, { recursive: true, force: true });
      await fsp.rename(stagingDirectory, finalDirectory);
      return { html, htmlFile: `/uploads/predefinedtemplates/${templateId}/index.html`, fileCount: files.size };
    } catch (error) {
      await fsp.rm(stagingDirectory, { recursive: true, force: true });
      throw error;
    }
  },
};

module.exports = PredefinedTemplateZipService;
