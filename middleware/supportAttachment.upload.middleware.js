const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const storagePath = path.join(__dirname, '..', 'private-support-uploads');
fs.mkdirSync(storagePath, { recursive: true });
const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']);
const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.txt']);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, storagePath),
    filename: (_req, _file, callback) => callback(null, crypto.randomUUID()),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    if (!allowed.has(file.mimetype) || !allowedExtensions.has(path.extname(file.originalname || '').toLowerCase())) {
      return callback(new Error('Only PDF, PNG, JPEG, WebP, and plain text attachments are allowed.'));
    }
    callback(null, true);
  },
});

module.exports = { upload, storagePath };
