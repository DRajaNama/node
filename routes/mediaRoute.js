const router = require('express').Router();
const authMiddleware = require('../middleware/auth.middleware');
const MediaController = require('../controller/mediaController');
const { mediaUpload } = require('../middleware/media.upload.middleware');

router.post('/media/upload', authMiddleware, (req, res, next) => {
  mediaUpload.single('file')(req, res, (error) => {
    if (error) return res.status(400).send({ data: null, message: error.message || 'Invalid media upload.' });
    next();
  });
}, MediaController.upload);
router.get('/media', authMiddleware, MediaController.list);
router.get('/media/:id', authMiddleware, MediaController.get);
router.delete('/media/:id', authMiddleware, MediaController.delete);

module.exports = router;
