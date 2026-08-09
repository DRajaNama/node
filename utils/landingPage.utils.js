const getBlankLandingPageHtml = () => {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="visual-editor-type" content="landing"/><meta name="visual-editor-version" content="1"/></head><body><section class="editor-element ve-section" data-type="section" id="editor-element-root-section" style="position:relative;width:100%;min-height:400px;padding:40px 20px;background:#ffffff;"><div class="editor-element" data-type="headline-h1" id="editor-element-root-h1" style="position:relative;margin:0 auto 16px;max-width:720px;"><h1 class="editable-text" contenteditable="true">Welcome</h1></div><div class="editor-element" data-type="paragraph" id="editor-element-root-p" style="position:relative;margin:0 auto;max-width:720px;"><p class="editable-text" contenteditable="true">Start building your landing page.</p></div></section></body></html>`;
};

const getBlankFormPopupHtml = () => {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="visual-editor-type" content="popup"/><meta name="visual-editor-version" content="1"/></head><body><div class="editor-element ve-popup-container" data-type="popup-container" id="editor-element-popup-root" style="position:relative;width:420px;max-width:92%;margin:40px auto;padding:28px;background:#ffffff;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.18);" data-popup-width="420" data-popup-position="center" data-popup-overlay="#00000099" data-popup-animation="fade" data-popup-delay="0"><button type="button" class="editor-element ve-close-button" data-type="close-button" id="editor-element-popup-close" style="position:absolute;top:8px;right:8px;border:none;background:transparent;font-size:20px;cursor:pointer;" aria-label="Close">×</button><div class="editor-element" data-type="headline-h2" id="editor-element-popup-h2"><h2 class="editable-text" contenteditable="true" style="margin:0 0 12px;">Special Offer</h2></div><div class="editor-element" data-type="paragraph" id="editor-element-popup-p"><p class="editable-text" contenteditable="true" style="margin:0 0 16px;">Sign up to get updates.</p></div><form class="editor-element editor-form ve-email-form" data-type="email-form" action="[[LEAD_SUBMIT_URL]]" method="POST" style="position:relative;width:100%;padding:0;"><div class="row editor-form-body g-2"><div class="col-12"><div class="form-group editor-form-group editor-element" data-type="input-email" data-drag="false" data-resize="false"><label class="form-label">Email</label><input type="email" name="email" class="form-control" placeholder="you@example.com" required/></div></div><div class="col-12"><button type="submit" class="btn btn-primary w-100">Subscribe</button></div></div></form></div></body></html>`;
};

const slugify = (value) => {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
};

const uniqueSlug = (base, suffix = '') => {
  const slug = slugify(base);
  return suffix ? `${slug}-${suffix}` : slug;
};

module.exports = {
  getBlankLandingPageHtml,
  getBlankFormPopupHtml,
  slugify,
  uniqueSlug,
};
