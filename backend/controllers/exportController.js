/**
 * controllers/exportController.js
 * Exportação da minuta para DOCX e PDF
 */

const {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  Packer,
} = require('docx');
const PDFDocument = require('pdfkit');
const { ultimaMinuta } = require('../services/store');
const { getTemplate } = require('../services/docxTemplates');

/**
 * Resolve o conteúdo da minuta a partir do body (POST) ou do store (GET)
 */
function resolverConteudo(req) {
  const body = req.body || {};
  const signatario = body.signatario || ultimaMinuta.signatario || '';
  const cargo = body.cargo || ultimaMinuta.cargo || '';
  const dadosResposta = body.dadosResposta || {};
  const conteudo =
    dadosResposta.minuta ||
    dadosResposta.conteudo ||
    dadosResposta.texto ||
    body.texto ||
    body.conteudo ||
    ultimaMinuta.texto ||
    '';
  return { signatario, cargo, conteudo };
}

/**
 * Gera e faz download do arquivo DOCX da minuta.
 * Aceita GET (usa última minuta do store) e POST (usa body da requisição).
 */
async function exportarDocx(req, res, next) {
  try {
    const { signatario, cargo, conteudo } = resolverConteudo(req);

    if (!conteudo) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma minuta disponível. Gere a minuta primeiro.',
      });
    }

    const template = getTemplate(ultimaMinuta.modeloId || 'objetiva');
    const style = template.docxStyle;

    const paragrafos = conteudo.split('\n').map(
      (linha) =>
        new Paragraph({
          children: [new TextRun({ text: linha, font: style.fonte, size: style.tamanho })],
          spacing: { after: style.espacamentoDepois, line: style.espacamentoLinha, lineRule: 'auto' },
        })
    );

    const doc = new Document({
      sections: [
        {
          properties: {
            page: { margin: { top: 1440, right: 1080, bottom: 1440, left: 1440 } },
          },
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
              children: [
                new TextRun({
                  text: signatario || '[SIGNATÁRIO]',
                  bold: true,
                  font: style.fonte,
                  size: style.tamanho,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: cargo || '[CARGO]', font: style.fonte, size: style.tamanho - 2 }),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=resposta-antt.docx');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

/**
 * Gera e faz download do arquivo PDF da minuta usando pdfkit.
 * Aceita GET (usa última minuta do store) e POST (usa body da requisição).
 */
async function exportarPdf(req, res, next) {
  try {
    const { signatario, cargo, conteudo } = resolverConteudo(req);

    if (!conteudo) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma minuta disponível. Gere a minuta primeiro.',
      });
    }

    const pdfTemplate = getTemplate(ultimaMinuta.modeloId || 'objetiva');
    const pdfStyle = pdfTemplate.docxStyle;
    // Convert half-points (docx size unit) to PDF points: divide by 2
    const pdfFontSize = Math.round(pdfStyle.tamanho / 2);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=resposta-antt.pdf');

    const doc = new PDFDocument({ margin: 72, size: 'A4' });
    doc.pipe(res);

    // Cabeçalho
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('RUMO LOGÍSTICA OPERADORA MULTIMODAL S.A.', { align: 'center' });

    doc.moveDown(1.5);

    // Corpo da minuta
    doc.font('Helvetica').fontSize(pdfFontSize);
    conteudo.split('\n').forEach((linha) => {
      if (linha.trim() === '') {
        doc.moveDown(0.5);
      } else {
        doc.text(linha, { align: 'left' });
      }
    });

    // Encerramento
    doc.moveDown(2);
    doc.text('Atenciosamente,', { align: 'center' });
    doc.moveDown(2);
    doc.font('Helvetica-Bold').text(signatario || '[SIGNATÁRIO]', { align: 'center' });
    doc.font('Helvetica').fontSize(10).text(cargo || '[CARGO]', { align: 'center' });

    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { exportarDocx, exportarPdf };
