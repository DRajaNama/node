const fs = require('fs/promises');
const path = require('path');
const Media = require('../models/media.model');
const { imageMimeTypes } = require('../middleware/media.upload.middleware');

const MEDIA_ROOT = path.resolve(__dirname, '..', 'uploads', 'users');
const safeUnlink = async (storageKey) => {
  if (!storageKey) return;
  const filePath = path.resolve(__dirname, '..', 'uploads', storageKey);
  if (filePath.startsWith(`${MEDIA_ROOT}${path.sep}`)) await fs.unlink(filePath).catch(() => {});
};

const MediaController = {
  upload: async (req, res) => {
    try {
      if (!req.file) return res.status(400).send({ data: null, message: 'An image or video file is required.' });
      const type = imageMimeTypes.has(req.file.mimetype) ? 'image' : 'video';
      const maxSize = type === 'image' ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).send({ data: null, message: `${type === 'image' ? 'Images' : 'Videos'} must be ${type === 'image' ? '2MB' : '5MB'} or smaller.` });
      }
      const storageKey = path.posix.join('users', String(req.userId), `${type}s`, req.file.filename);
      const media = await Media.create({
        userId: req.userId, type, originalName: req.file.originalname, fileName: req.file.filename,
        mimeType: req.file.mimetype, size: req.file.size, storageKey, url: `/uploads/${storageKey}`,
      });
      return res.status(201).send({ data: media, message: 'Media uploaded successfully.' });
    } catch (error) {
      if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
      return res.status(500).send({ data: null, message: 'Unable to upload media.' });
    }
  },

  list: async (req, res) => {
    const filter = { userId: req.userId };
    if (req.query.type) {
      if (!['image', 'video'].includes(req.query.type)) return res.status(400).send({ data: null, message: 'Invalid media type.' });
      filter.type = req.query.type;
    }
    const data = await Media.find(filter).sort({ createdAt: -1 }).limit(200);
    return res.send({ data, message: 'Media found.' });
  },

  get: async (req, res) => {
    const data = await Media.findOne({ _id: req.params.id, userId: req.userId });
    if (!data) return res.status(404).send({ data: null, message: 'Media not found.' });
    return res.send({ data, message: 'Media found.' });
  },

  delete: async (req, res) => {
    const data = await Media.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!data) return res.status(404).send({ data: null, message: 'Media not found.' });
    await safeUnlink(data.storageKey);
    return res.send({ data: null, message: 'Media deleted.' });
  },
};

module.exports = MediaController;
