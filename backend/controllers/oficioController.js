/**
 * controllers/oficioController.js
 * Upload do ofício da ANTT e extração inteligente de dados via Claude
 */

const { extrairTextoPDF, textoEhLegivel } = require('../services/pdfService');
const { extrairBriefingOficio, extrairBriefingOficioPDF } = require('../services/claudeService');
const { getSession } = require('../services/store');

async function uploadOficio(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
    }

    const session = getSession(req.sessionId);

    console.log('[Ofício] Extraindo texto do PDF...');
    const textoOficio = await extrairTextoPDF(req.file.path);

    let briefing;
    if (textoEhLegivel(textoOficio)) {
      console.log('[Ofício] Texto legível — extraindo briefing via texto...');
      briefing = await extrairBriefingOficio(textoOficio);
    } else {
      console.log('[Ofício] Texto ilegível (PDF com codificação especial ou escaneado) — usando leitura nativa de PDF pelo Claude...');
      briefing = await extrairBriefingOficioPDF(req.file.path);
    }

    // Novo ofício: limpa documentos complementares da sessão anterior
    session.documentosComplementares.splice(0);

    // Armazena para uso posterior na geração da minuta
    const oficio = {
      id: Date.now(),
      nome: req.file.originalname,
      texto: textoOficio,
      briefing,
      dataProcessamento: new Date().toISOString(),
    };
    session.oficios.push(oficio);

    console.log('[Ofício] Briefing extraído com sucesso:', briefing.numero);

    res.json({
      success: true,
      message: 'Ofício processado com sucesso.',
      briefing,
      analise: briefing,
      content: {
        texto: textoOficio.substring(0, 3000),
        briefing,
        nomeArquivo: req.file.originalname,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function uploadComplementar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
    }

    const session = getSession(req.sessionId);
    const texto = await extrairTextoPDF(req.file.path);
    const doc = {
      id: Date.now(),
      nome: req.file.originalname,
      texto: texto.substring(0, 8000),
    };
    session.documentosComplementares.push(doc);

    console.log(`[Complementar] Documento adicionado: ${doc.nome} (${session.documentosComplementares.length} total)`);
    res.json({ success: true, id: doc.id, nome: doc.nome });
  } catch (err) {
    next(err);
  }
}

function removeComplementar(req, res) {
  const session = getSession(req.sessionId);
  const id = parseInt(req.params.id, 10);
  const idx = session.documentosComplementares.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Documento não encontrado.' });
  session.documentosComplementares.splice(idx, 1);
  res.json({ success: true });
}

module.exports = { uploadOficio, uploadComplementar, removeComplementar };
