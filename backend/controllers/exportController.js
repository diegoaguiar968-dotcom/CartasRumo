/**
 * controllers/exportController.js
 * Exportação da minuta para DOCX (via template)
 */

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const {
  Document, Paragraph, TextRun, AlignmentType, HeadingLevel, Packer,
} = require('docx');
const { getSession } = require('../services/store');
const { getTemplate } = require('../services/docxTemplates');
const { MALHAS, resolverMalhas, gerarTextoMalhas } = require('../services/malhas');

function resolverConteudo(req, ultimaMinuta) {
  const body = req.body || {};
  const dadosResposta = body.dadosResposta || {};
  const conteudo =
    dadosResposta.minuta || dadosResposta.conteudo || dadosResposta.texto ||
    body.texto || body.conteudo || ultimaMinuta.texto || '';
  return { conteudo };
}

// Infere saudação pelo prefixo "Sr."/"Sra." já atribuído ao signatário,
// com fallback na terminação do cargo.
function inferirSaudacao(signatarioAntt, cargoAntt) {
  if (/^Sra\./i.test((signatarioAntt || '').trim())) return 'Prezada Senhora';
  if (/^Sr\./i.test((signatarioAntt || '').trim())) return 'Prezado Senhor';

  // Fallback: primeira palavra do cargo
  const primeiraWordo = (cargoAntt || '').split(/[\s/,-]/)[0].toLowerCase();
  const neutros = /nte$|ste$|ife$|efe$|ista$/;
  if (primeiraWordo.endsWith('a') && !neutros.test(primeiraWordo)) return 'Prezada Senhora';

  return 'Prezado Senhor';
}

// Gera nome do arquivo: $numero$ - GREG - $ano$ - $assunto$ - $malha$
function gerarNomeArquivo(numero, assunto, malhaKey) {
  const sanitize = (s) => (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[/\\:*?"<>|]/g, ' ')
    .replace(/[^a-zA-Z0-9\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80);

  const seq = (numero || '').replace(/\D/g, '').padStart(4, '0') || '0000';
  const ano = new Date().getFullYear();
  const assuntoSanitized = sanitize(assunto) || 'Carta';

  const malhas = resolverMalhas(malhaKey);
  const siglaMalha = malhas.length > 0 ? malhas.map(m => m.sigla).join(', ') : '';

  return siglaMalha
    ? `${seq} - GREG - ${ano} - ${assuntoSanitized} - ${siglaMalha}.docx`
    : `${seq} - GREG - ${ano} - ${assuntoSanitized}.docx`;
}

async function exportarDocx(req, res, next) {
  try {
    const session = getSession(req.sessionId);
    const { ultimaMinuta } = session;

    const { conteudo } = resolverConteudo(req, ultimaMinuta);
    const numeroOficio = req.body?.numero_oficio?.trim() || '';

    // Metadados enviados pelo frontend — fallback para o store da sessão
    const meta = req.body?.meta || {};
    const signatarioAntt = meta.signatarioAntt ?? ultimaMinuta.signatarioAntt ?? '';
    const cargoAntt      = meta.cargoAntt      ?? ultimaMinuta.cargoAntt      ?? '';
    const malhaKey       = meta.malha          ?? ultimaMinuta.malha          ?? '';
    const assunto        = meta.assunto        ?? ultimaMinuta.assunto        ?? '';
    const processo       = meta.processo       ?? ultimaMinuta.processo       ?? '';
    const referencia     = meta.referencia     ?? ultimaMinuta.referencia     ?? '';
    const modeloId       = meta.modeloId       ?? ultimaMinuta.modeloId       ?? 'objetiva';

    if (!conteudo) {
      return res.status(400).json({ success: false, message: 'Nenhuma minuta disponível. Gere a minuta primeiro.' });
    }

    const template = getTemplate(modeloId);
    const templatePath = template.arquivo
      ? path.join(__dirname, '../templates', template.arquivo)
      : null;

    if (templatePath && fs.existsSync(templatePath)) {
      // ── Exportação via template DOCX com docxtemplater ──
      const malhasResolvidas = resolverMalhas(malhaKey);
      const textoMalhas = gerarTextoMalhas(malhasResolvidas);
      const fileContent = fs.readFileSync(templatePath, 'binary');
      const zip = new PizZip(fileContent);

      // Pré-processa o XML:
      // - Remove alinhamento justificado (causa espaçamento forçado entre palavras)
      // - Transforma {conteudo} em loop de parágrafos para o paragraphLoop do docxtemplater
      // Os delimitadores {#paragrafos} e {/paragrafos} DEVEM estar em parágrafos separados
      // para que o paragraphLoop replique o <w:p> completo (e não apenas o run).
      let docXml = zip.files['word/document.xml'].asText();

      // {conteudo} → loop de parágrafos (paragraphLoop replica <w:p> por item)
      docXml = docXml.replace(
        /(<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?\{conteudo\}(?:(?!<\/w:p>)[\s\S])*?<\/w:p>)/,
        (match) => {
          const open  = '<w:p><w:r><w:t xml:space="preserve">{#paragrafos}</w:t></w:r></w:p>';
          const close = '<w:p><w:r><w:t xml:space="preserve">{/paragrafos}</w:t></w:r></w:p>';
          return open + match.replace('{conteudo}', '{.}') + close;
        }
      );

      // {processo} → parágrafo omitido quando vazio
      docXml = docXml.replace(
        /(<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?\{processo\}(?:(?!<\/w:p>)[\s\S])*?<\/w:p>)/,
        (match) => {
          const open  = '<w:p><w:r><w:t xml:space="preserve">{#processoItems}</w:t></w:r></w:p>';
          const close = '<w:p><w:r><w:t xml:space="preserve">{/processoItems}</w:t></w:r></w:p>';
          return open + match + close;
        }
      );

      // {referencia} → parágrafo omitido quando vazio
      docXml = docXml.replace(
        /(<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?\{referencia\}(?:(?!<\/w:p>)[\s\S])*?<\/w:p>)/,
        (match) => {
          const open  = '<w:p><w:r><w:t xml:space="preserve">{#referenciaItems}</w:t></w:r></w:p>';
          const close = '<w:p><w:r><w:t xml:space="preserve">{/referenciaItems}</w:t></w:r></w:p>';
          return open + match + close;
        }
      );

      // Saudação hardcoded no template ("Prezada Senhora,") → substituir por {saudacao}
      docXml = docXml.replace(
        '<w:r><w:t>Prezada</w:t></w:r><w:r w:rsidR="00B66443"><w:t xml:space="preserve"> </w:t></w:r><w:r w:rsidR="00FC1687"><w:t>Senhor</w:t></w:r><w:r><w:t>a</w:t></w:r><w:r w:rsidR="00B66443"><w:t>,</w:t></w:r>',
        '<w:r><w:t>{saudacao}</w:t></w:r>'
      );

      zip.file('word/document.xml', docXml);

      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: false });

      // Converte o conteúdo em array de parágrafos — separa em qualquer quebra de linha
      const paragrafos = conteudo
        .split(/\n+/)
        .map(p => p.replace(/\s{2,}/g, ' ').trim())
        .filter(Boolean);

      const saudacao = inferirSaudacao(signatarioAntt, cargoAntt);

      doc.render({
        numero_oficio: numeroOficio,
        data: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
        destinatario: signatarioAntt,
        cargo: cargoAntt,
        saudacao,
        processoItems:   processo  ? [{ processo  }] : [],
        referenciaItems: referencia ? [{ referencia }] : [],
        assunto,
        paragrafos,
        regulada: textoMalhas?.nomesResumidos || '',
      });

      const buffer = doc.getZip().generate({ type: 'nodebuffer' });
      const nomeArquivo = gerarNomeArquivo(numeroOficio, assunto, malhaKey);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
      return res.send(buffer);
    }

    // ── Fallback: geração programática (sem arquivo de template) ──
    const malhasResolvidas = resolverMalhas(malhaKey);
    const textoMalhas = gerarTextoMalhas(malhasResolvidas);
    const style = template.docxStyle;
    const paragrafos = conteudo.split('\n').map(
      (linha) => new Paragraph({
        children: [new TextRun({ text: linha, font: style.fonte, size: style.tamanho })],
        spacing: { after: style.espacamentoDepois, line: style.espacamentoLinha, lineRule: 'auto' },
      })
    );

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 1440, right: 1080, bottom: 1440, left: 1440 } } },
        children: [
          new Paragraph({
            text: 'RUMO LOGÍSTICA OPERADORA MULTIMODAL S.A.',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({ children: [new TextRun({ text: '', break: 1 })] }),
          ...paragrafos,
          new Paragraph({ children: [new TextRun({ text: '', break: 2 })] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Atenciosamente,', font: style.fonte, size: style.tamanho })],
          }),
          new Paragraph({ children: [new TextRun({ text: '', break: 2 })] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: textoMalhas?.nomesResumidos || 'RUMO S.A.', bold: true, font: style.fonte, size: style.tamanho })],
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const nomeArquivo = gerarNomeArquivo(numeroOficio, assunto, malhaKey);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { exportarDocx };
