const fs = require('fs');
const path = require('path');
const multer = require('multer');

const dest = path.join('uploads', 'branding');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const kind = String(req.body.kind || req.query.kind || 'asset').replace(/[^a-z]/gi, '');
    const name = `${kind || 'asset'}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`;
    cb(null, name);
  },
});

const allowed = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.has(file.mimetype) || ['.ico', '.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (png, jpg, webp, svg, ico)'), false);
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});
