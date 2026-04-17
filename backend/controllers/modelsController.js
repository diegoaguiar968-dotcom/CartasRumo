/**
 * controllers/modelsController.js
 * Gerencia o banco de templates de carta
 */

const { TEMPLATES } = require('../services/docxTemplates');

function listarTemplates(req, res) {
  res.json({ success: true, templates: TEMPLATES.map(({ id, nome, descricao, uso }) => ({ id, nome, descricao, uso })) });
}

module.exports = { listarTemplates };
