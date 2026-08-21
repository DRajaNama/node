const fs = require('fs');
const path = require('path');
const multer = require('multer');

const tempDirectory = path.join(__dirname, '..', 'uploads', 'predefinedtemplates', '.tmp');
fs.mkdirSync(tempDirectory, { recursive: true });

module.exports = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tempDirectory),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.zip') return cb(new Error('Only .zip template packages are allowed.'));
    cb(null, true);
  },
  limits: { fileSize: 100 * 1024 * 1024 },
});
