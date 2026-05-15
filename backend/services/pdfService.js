/**
 * services/pdfService.js
 * Extração e pré-processamento de texto de arquivos PDF
 */

const pdfParse = require('pdf-parse');
const fs = require('fs');

/**
 * Extrai o texto bruto de um arquivo PDF em disco.
 * @param {string} filePath - Caminho absoluto do arquivo
 * @returns {Promise<string>} - Texto extraído
 */
async function extrairTextoPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);
  return pdfData.text;
}

/**
 * Verifica se o texto extraído de um PDF é legível e útil.
 * PDFs com codificação de fonte customizada (comum no SEI/governo) retornam
 * texto ilegível — caracteres fora do range latino ou razão de lixo > 35%.
 * @param {string} texto
 * @returns {boolean}
 */
function textoEhLegivel(texto) {
  if (!texto || texto.trim().length < 150) return false;
  // Conta caracteres legíveis: letras (incluindo acentuadas), dígitos, pontuação e espaços
  const legiveis = (texto.match(/[a-záàâãéèêíïóôõöúüçñ0-9\s.,;:!?()\[\]"'\-\/\n]/gi) || []).length;
  return legiveis / texto.length > 0.62;
}

/**
 * Processa múltiplos PDFs e retorna um resumo de cada um para uso como modelos de referência.
 * @param {Array<{path: string, originalname: string, size: number}>} files
 * @returns {Promise<Array>}
 */
async function processarModelosPDF(files) {
  const resultados = [];

  for (const file of files) {
    try {
      const texto = await extrairTextoPDF(file.path);
      resultados.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        nome: file.originalname,
        tamanho: file.size,
        textoExtraido: texto,
        preview: texto.substring(0, 200).replace(/\s+/g, ' ').trim() + '...',
        dataUpload: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`[PDF] Erro ao processar ${file.originalname}:`, err.message);
      // Não lança exceção — permite que outros arquivos continuem sendo processados
    }
  }

  return resultados;
}

module.exports = { extrairTextoPDF, textoEhLegivel, processarModelosPDF };

