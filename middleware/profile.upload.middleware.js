const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const profileUpload = multer({
    storage: multer.diskStorage({
        destination: (req, _file, callback) => {
            const directory = path.join('uploads', 'profiles', String(req.userId));
            fs.mkdirSync(directory, { recursive: true });
            callback(null, directory);
        },
        filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${extensions[file.mimetype]}`),
    }),
    fileFilter: (_req, file, callback) => {
        if (!imageTypes.has(file.mimetype)) return callback(new Error('Only JPG, PNG, WebP, and GIF images are allowed.'));
        callback(null, true);
    },
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

module.exports = profileUpload;