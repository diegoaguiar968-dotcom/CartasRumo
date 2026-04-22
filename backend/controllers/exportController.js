/**
 * controllers/exportController.js
 * Exportação da minuta para DOCX (via template) e PDF
 */

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const {
  Document, Paragraph, TextRun, AlignmentType, HeadingLevel, Packer,
} = require('docx');
const PDFDocument = require('pdfkit');
const { ultimaMinuta } = require('../services/store');
const { getTemplate } = require('../services/docxTemplates');
const { resolverMalha } = require('../services/malhas');

function resolverConteudo(req) {
  const body = req.body || {};
  const dadosResposta = body.dadosResposta || {};
  const conteudo =
    dadosResposta.minuta || dadosResposta.conteudo || dadosResposta.texto ||
    body.texto || body.conteudo || ultimaMinuta.texto || '';
  return { conteudo };
}

function gerarNumeroOficio() {
  const ano = new Date().getFullYear();
  const seq = String(Date.now()).slice(-3);
  return `${seq}/${ano}`;
}

async function exportarDocx(req, res, next) {
  try {
    const { conteudo } = resolverConteudo(req);

    if (!conteudo) {
      return res.status(400).json({ success: false, message: 'Nenhuma minuta disponível. Gere a minuta primeiro.' });
    }

    const template = getTemplate(ultimaMinuta.modeloId || 'objetiva');
    const templatePath = template.arquivo
      ? path.join(__dirname, '../templates', template.arquivo)
      : null;

    if (templatePath && fs.existsSync(templatePath)) {
      // ── Exportação via template DOCX com docxtemplater ──
      const malha = resolverMalha(ultimaMinuta.malha);
      const fileContent = fs.readFileSync(templatePath, 'binary');
      const zip = new PizZip(fileContent);

      // Pré-processa o XML:
      // - Remove alinhamento justificado (causa espaçamento forçado entre palavras)
      // - Transforma {conteudo} em loop de parágrafos para o paragraphLoop do docxtemplater
      // Os delimitadores {#paragrafos} e {/paragrafos} DEVEM estar em parágrafos separados
      // para que o paragraphLoop replique o <w:p> completo (e não apenas o run).
      let docXml = zip.files['word/document.xml'].asText();
      docXml = docXml.replace(
        /(<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?\{conteudo\}(?:(?!<\/w:p>)[\s\S])*?<\/w:p>)/,
        (match) => {
          const loopOpen  = '<w:p><w:r><w:t xml:space="preserve">{#paragrafos}</w:t></w:r></w:p>';
          const loopClose = '<w:p><w:r><w:t xml:space="preserve">{/paragrafos}</w:t></w:r></w:p>';
          const contentPara = match
            .replace(/<w:jc w:val="both"\/>/g, '<w:jc w:val="left"/>')
            .replace('{conteudo}', '{.}');
          return loopOpen + contentPara + loopClose;
        }
      );
      zip.file('word/document.xml', docXml);

      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: false });

      // Converte o conteúdo em array de parágrafos — separa em qualquer quebra de linha
      const paragrafos = conteudo
        .split(/\n+/)
        .map(p => p.replace(/\s{2,}/g, ' ').trim())
        .filter(Boolean);

      doc.render({
        numero_oficio: gerarNumeroOficio(),
        data: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
        destinatario: ultimaMinuta.signatarioAntt || '',
        cargo: ultimaMinuta.cargoAntt || '',
        processo: ultimaMinuta.processo || '',
        assunto: ultimaMinuta.assunto || '',
        referencia: ultimaMinuta.referencia || '',
        paragrafos,
        regulada: malha ? malha.nome : '',
      });

      const buffer = doc.getZip().generate({ type: 'nodebuffer' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename=resposta-antt.docx');
      return res.send(buffer);
    }

    // ── Fallback: geração programática (sem arquivo de template) ──
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
            children: [new TextRun({ text: malha ? malha.nome : 'RUMO S.A.', bold: true, font: style.fonte, size: style.tamanho })],
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=resposta-antt.docx');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function exportarPdf(req, res, next) {
  try {
    const { conteudo } = resolverConteudo(req);

    if (!conteudo) {
      return res.status(400).json({ success: false, message: 'Nenhuma minuta disponível. Gere a minuta primeiro.' });
    }

    const template = getTemplate(ultimaMinuta.modeloId || 'objetiva');
    const pdfFontSize = Math.round(template.docxStyle.tamanho / 2);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=resposta-antt.pdf');

    const doc = new PDFDocument({ margin: 72, size: 'A4' });
    doc.pipe(res);

    doc.font('Helvetica-Bold').fontSize(13).text('RUMO LOGÍSTICA OPERADORA MULTIMODAL S.A.', { align: 'center' });
    doc.moveDown(1.5);
    doc.font('Helvetica').fontSize(pdfFontSize);

    conteudo.split('\n').forEach((linha) => {
      if (linha.trim() === '') doc.moveDown(0.5);
      else doc.text(linha, { align: 'justify' });
    });

    const malha = resolverMalha(ultimaMinuta.malha);
    doc.moveDown(2);
    doc.text('Atenciosamente,', { align: 'center' });
    doc.moveDown(2);
    doc.font('Helvetica-Bold').text(malha ? malha.nome : 'RUMO S.A.', { align: 'center' });

    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { exportarDocx, exportarPdf };
