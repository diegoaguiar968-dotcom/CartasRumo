/**
 * controllers/minutaController.js
 * Geração da minuta de resposta ao ofício via Claude
 */

const fs = require('fs');
const path = require('path');
const { gerarMinuta, refinarMinuta } = require('../services/claudeService');
const { getTemplate } = require('../services/docxTemplates');
const { modelos, oficios, modelosPermanentes, ultimaMinuta } = require('../services/store');

// Remove markdown artifacts e prefixos indesejados gerados pela IA
function limparMarkdown(texto) {
  return texto
    .replace(/\*\*(.+?)\*\*/gs, '$1')          // **negrito** → texto
    .replace(/\*(.+?)\*/gs, '$1')              // *itálico* → texto
    .replace(/^#{1,6}\s+/gm, '')               // ## Título → Título
    .replace(/^---+\s*$/gm, '')                // linhas --- → removidas
    .replace(/^___+\s*$/gm, '')                // linhas ___ → removidas
    .replace(/^minuta\s+refinada[:\s]*/im, '') // "Minuta Refinada:" → removido
    .replace(/^minuta[:\s]+/im, '')            // "Minuta:" → removido
    .replace(/\n{3,}/g, '\n\n')                // 3+ quebras → 2 quebras
    .trim();
}

// Separa nome e cargo do signatário da ANTT (ex: "Nome - Cargo")
function parsearSignatarioAntt(signatarioAntt) {
  if (!signatarioAntt) return { nome: '', cargo: '' };
  const dashIdx = signatarioAntt.indexOf(' - ');
  if (dashIdx > 0) {
    return {
      nome: signatarioAntt.substring(0, dashIdx).trim(),
      cargo: signatarioAntt.substring(dashIdx + 3).trim(),
    };
  }
  const parts = signatarioAntt.split('\n');
  if (parts.length >= 2) return { nome: parts[0].trim(), cargo: parts.slice(1).join(' ').trim() };
  return { nome: signatarioAntt.trim(), cargo: '' };
}

// Detecta tratamento (Sr./Sra.) pelo primeiro nome
function tratamento(nome) {
  if (!nome) return '';
  const primeiro = nome.split(' ')[0].toLowerCase();
  return /[aei]$/i.test(primeiro) ? 'Sra.' : 'Sr.';
}

async function gerarMinutaHandler(req, res, next) {
  try {
    const modeloId = req.body.modeloId || 'objetiva';
    const template = getTemplate(modeloId);

    // Aceita 'briefing' do body ou usa o último ofício processado no store
    let briefing = req.body.briefing;
    if (!briefing) {
      const ultimoOficio = oficios[oficios.length - 1];
      if (ultimoOficio?.briefing) {
        briefing = ultimoOficio.briefing;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Dados do briefing são obrigatórios. Processe o ofício na Etapa 2 primeiro.',
        });
      }
    }

    const rawPontos = req.body.pontosRespondidos || req.body.pontos || [];
    const pontosRespondidos = rawPontos.map((item) => ({
      ponto: item.ponto || item.pergunta || '',
      resposta: item.resposta || '',
    }));

    const textoModelosReferencia = [...modelosPermanentes, ...modelos]
      .map((m) => m.textoExtraido)
      .join('\n\n---\n\n')
      .substring(0, 8000);

    console.log('[Minuta] Gerando com Claude...');

    const templatePath = template.arquivo
      ? path.join(__dirname, '../templates', template.arquivo)
      : null;
    const usaTemplate = !!(templatePath && fs.existsSync(templatePath));

    const textoRaw = await gerarMinuta({
      briefing, pontosRespondidos,
      textoModelosReferencia, templateHint: template.claudeHint, usaTemplate,
    });

    const textoMinuta = limparMarkdown(textoRaw);
    console.log('[Minuta] Gerada com sucesso.');

    // Parseia o signatário da ANTT para separar nome e cargo
    const { nome: nomeAntt, cargo: cargoAntt } = parsearSignatarioAntt(briefing?.signatarioAntt);

    // Persiste no store
    ultimaMinuta.texto        = textoMinuta;
    ultimaMinuta.modeloId     = modeloId;
    ultimaMinuta.signatarioAntt = nomeAntt ? `${tratamento(nomeAntt)} ${nomeAntt}` : '';
    ultimaMinuta.cargoAntt    = cargoAntt;
    ultimaMinuta.malha        = briefing?.malha || '';
    ultimaMinuta.processo     = briefing?.processo || '';
    ultimaMinuta.assunto      = `Atendimento ao ${briefing?.numero || 'ofício da ANTT'} — ${briefing?.natureza || ''}`.trim();
    ultimaMinuta.referencia   = briefing?.numero || '';

    res.json({
      success: true,
      message: 'Minuta gerada com sucesso.',
      minuta: textoMinuta,
      texto: textoMinuta,
      conteudo: textoMinuta,
      documento: textoMinuta,
      resposta: textoMinuta,
      content: textoMinuta,
    });
  } catch (err) {
    next(err);
  }
}

async function refinarMinutaHandler(req, res, next) {
  try {
    const { textoAtual, mensagem, historico } = req.body;
    if (!textoAtual) return res.status(400).json({ success: false, message: 'textoAtual é obrigatório.' });
    if (!mensagem?.trim()) return res.status(400).json({ success: false, message: 'mensagem é obrigatória.' });

    console.log('[Refinar] Refinando minuta com Claude...');
    const textoRefinado = limparMarkdown(await refinarMinuta({
      textoAtual, mensagem: mensagem.trim(), historico: historico || [],
    }));

    ultimaMinuta.texto = textoRefinado;
    res.json({ success: true, texto: textoRefinado, minuta: textoRefinado });
  } catch (err) {
    next(err);
  }
}

module.exports = { gerarMinutaHandler, refinarMinutaHandler };
