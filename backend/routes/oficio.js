const router = require('express').Router();
const upload = require('../middleware/upload');
const { uploadOficio, uploadComplementar, removeComplementar } = require('../controllers/oficioController');

router.post('/upload', upload.single('file'), uploadOficio);
router.post('/complementar', upload.single('file'), uploadComplementar);
router.delete('/complementar/:id', removeComplementar);
router.get('/upload', (_req, res) => {
  res.json({ success: true, message: 'Rota de ofício ativa. Use POST para enviar o PDF.' });
});
router.post('/analyze', (_req, res) => {
  res.json({ success: true, message: 'Ofício em processamento.' });
});
router.get('/analyze', (_req, res) => {
  res.json({ success: true, message: 'Ofício em processamento.' });
});

module.exports = router;
