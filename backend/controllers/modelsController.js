/**
 * controllers/modelsController.js
 * Upload e análise de cartas-modelo em PDF; listagem de templates disponíveis
 */

const { processarModelosPDF } = require('../services/pdfService');
const { getSession } = require('../services/store');
const { TEMPLATES } = require('../services/docxTemplates');

const LIMITE_MODELOS_STORE = 5;
const LIMITE_UPLOAD = 5;

async function uploadModelos(req, res, next) {
  try {
    const arquivos = req.files || (req.file ? [req.file] : []);

    if (!arquivos.length) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
    }

    if (arquivos.length > LIMITE_UPLOAD) {
      return res.status(400).json({
        success: false,
        message: `Envie no máximo ${LIMITE_UPLOAD} arquivos por vez. Você enviou ${arquivos.length}.`,
      });
    }

    const session = getSession(req.sessionId);
    const processados = await processarModelosPDF(arquivos);

    const totalAposInsercao = session.modelos.length + processados.length;
    if (totalAposInsercao > LIMITE_MODELOS_STORE) {
      const remover = totalAposInsercao - LIMITE_MODELOS_STORE;
      session.modelos.splice(0, remover);
    }
    session.modelos.push(...processados);

    const avisos = [];
    if (session.modelos.length === LIMITE_MODELOS_STORE) {
      avisos.push(
        `O banco de modelos está no limite máximo de ${LIMITE_MODELOS_STORE} arquivos. Os mais antigos foram substituídos automaticamente.`
      );
    }
    avisos.push(
      `Dica: envie no máximo ${LIMITE_UPLOAD} PDFs por vez para melhor aproveitamento. Arquivos além do 3º têm impacto reduzido na geração.`
    );

    res.json({
      success: true,
      message: `${processados.length} modelo(s) processado(s) com sucesso.`,
      files: processados.map((m) => ({ nome: m.nome, tamanho: m.tamanho, preview: m.preview })),
      totalModelos: session.modelos.length,
      limiteModelos: LIMITE_MODELOS_STORE,
      avisos,
    });
  } catch (err) {
    next(err);
  }
}

function analisarModelos(req, res) {
  const session = getSession(req.sessionId);
  const avisos = [];
  if (session.modelos.length === 0) {
    avisos.push('Nenhum modelo carregado ainda.');
  } else if (session.modelos.length >= 3) {
    avisos.push(
      `${session.modelos.length} modelo(s) carregados. Para melhores resultados, use no máximo ${LIMITE_MODELOS_STORE}.`
    );
  }

  res.json({
    success: true,
    message: 'Análise concluída.',
    totalAnalisado: session.modelos.length,
    limiteModelos: LIMITE_MODELOS_STORE,
    limiteUpload: LIMITE_UPLOAD,
    pontos:
      session.modelos.length > 0
        ? [`${session.modelos.length} modelo(s) carregados e prontos para uso como referência.`, ...avisos]
        : avisos,
  });
}

function listarTemplates(_req, res) {
  res.json({
    success: true,
    templates: TEMPLATES
      .filter(t => t.disponivel !== false)
      .map(({ id, nome, descricao, uso }) => ({ id, nome, descricao, uso })),
  });
}

module.exports = { uploadModelos, analisarModelos, listarTemplates };
