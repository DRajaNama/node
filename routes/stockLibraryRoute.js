const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const controller = require('../controller/stockLibraryController');
router.get('/stock-library/search', auth, controller.search);
router.post('/stock-library/recommendations', auth, controller.recommendations);
module.exports = router;
