/**
 * services/docxTemplates.js
 * Banco de modelos de carta pré-definidos para exportação DOCX
 */

const TEMPLATES = [
  { id: 'objetiva',    disponivel: false, nome: 'Resposta Objetiva',             descricao: 'Ideal para respostas curtas com 1 a 2 pontos. Tom direto, sem subdivisões.',                                         uso: '1–2 pontos · resposta rápida',            docxStyle: { fonte: 'Calibri', tamanho: 24, espacamentoDepois: 160, espacamentoLinha: 240 }, claudeHint: 'Escreva de forma direta e objetiva. Máximo 2 parágrafos por ponto. Sem seções ou subdivisões. Linguagem formal mas concisa.' },
  { id: 'tecnica',     disponivel: false, nome: 'Resposta Técnica',               descricao: 'Para respostas com dados operacionais, múltiplos itens numerados ou tabelas de referência.',                             uso: 'dados técnicos · múltiplos pontos',       docxStyle: { fonte: 'Calibri', tamanho: 22, espacamentoDepois: 200, espacamentoLinha: 276 }, claudeHint: 'Use numeração clara (1., 2., 3.) para cada ponto respondido. Inclua dados técnicos de forma estruturada.' },
  { id: 'documentacao',disponivel: true,  nome: 'Resposta com Documentação',      descricao: 'Quando a resposta encaminha documentos como anexos ou inclui referências a arquivos.',                                   uso: 'anexos · encaminhamentos · documentos',   docxStyle: { fonte: 'Calibri', tamanho: 24, espacamentoDepois: 200, espacamentoLinha: 276 }, claudeHint: 'Ao final do corpo da carta, inclua uma seção "DOCUMENTOS ENCAMINHADOS:" listando os anexos. Use "Encaminhamos em anexo..." quando for referenciar documentos.', arquivo: '3-modelo-anexos.docx' },
  { id: 'juridica',    disponivel: false, nome: 'Resposta Jurídico-Regulatória',  descricao: 'Para respostas com fundamentação legal, citação de normas, resoluções ou cláusulas contratuais.',                       uso: 'normas · contratos · fundamentação legal',docxStyle: { fonte: 'Calibri', tamanho: 24, espacamentoDepois: 240, espacamentoLinha: 360 }, claudeHint: 'Use linguagem jurídica formal. Estruture com numeração romana (I., II., III.). Cite normas, resoluções ANTT e cláusulas contratuais.' },
  { id: 'corporativa', disponivel: false, nome: 'Resposta Corporativa Completa',  descricao: 'Para cartas longas com múltiplas seções, várias áreas envolvidas ou respostas elaboradas.',                             uso: 'carta longa · múltiplas seções',          docxStyle: { fonte: 'Calibri', tamanho: 24, espacamentoDepois: 240, espacamentoLinha: 300 }, claudeHint: 'Estruture em seções com subtítulos em maiúsculas. Elabore cada ponto com profundidade corporativa.' },
];

function getTemplate(id) {
  return TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
}

module.exports = { TEMPLATES, getTemplate };
