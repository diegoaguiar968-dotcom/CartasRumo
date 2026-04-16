// routes/minuta.js
const router = require('express').Router();
const { gerarMinutaHandler, refinarMinutaHandler } = require('../controllers/minutaController');

router.post('/generate', gerarMinutaHandler);
router.post('/refinar', refinarMinutaHandler);

module.exports = router;
