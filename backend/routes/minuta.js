// routes/minuta.js
const router = require('express').Router();
const { gerarMinutaHandler, refinarMinutaHandler, gerarCartaEspontaneaHandler } = require('../controllers/minutaController');

router.post('/generate', gerarMinutaHandler);
router.post('/generate-espontanea', gerarCartaEspontaneaHandler);
router.post('/refinar', refinarMinutaHandler);

module.exports = router;
