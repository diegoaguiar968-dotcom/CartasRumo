// routes/models.js
const router = require('express').Router();
const { listarTemplates } = require('../controllers/modelsController');

router.get('/templates', listarTemplates);

module.exports = router;
