const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const videoMimeTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };

const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const type = imageMimeTypes.has(file.mimetype) ? 'images' : 'videos';
      const directory = path.join('uploads', 'users', String(req.userId), type);
      fs.mkdirSync(directory, { recursive: true });
      cb(null, directory);
    },
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${extensions[file.mimetype]}`),
  }),
  fileFilter: (_req, file, cb) => {
    if (!imageMimeTypes.has(file.mimetype) && !videoMimeTypes.has(file.mimetype)) return cb(new Error('Only JPG, PNG, WebP, GIF, MP4, WebM, and MOV files are allowed.'));
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

module.exports = { mediaUpload, imageMimeTypes, videoMimeTypes };
