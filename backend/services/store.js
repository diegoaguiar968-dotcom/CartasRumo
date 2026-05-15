/**
 * services/store.js
 * Armazenamento em memória isolado por sessão.
 *
 * Cada usuário recebe um UUID (X-Session-ID) gerado no frontend.
 * Sessões inativas por mais de 2 horas são removidas automaticamente.
 * modelosPermanentes é global — carregado na inicialização e compartilhado.
 */

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

const sessions = new Map();

function createSessionData() {
  return {
    modelos: [],
    oficios: [],
    documentosComplementares: [],
    ultimaMinuta: {
      texto: '',
      signatario: '',
      cargo: '',
      modeloId: 'objetiva',
      signatarioAntt: '',
      cargoAntt: '',
      processo: '',
      assunto: '',
      referencia: '',
      malha: '',
    },
    lastActivity: Date.now(),
  };
}

function getSession(sessionId) {
  const key = sessionId || 'anonymous';
  let session = sessions.get(key);
  if (!session) {
    session = createSessionData();
    sessions.set(key, session);
  }
  session.lastActivity = Date.now();
  return session;
}

// Limpeza automática de sessões inativas
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, 30 * 60 * 1000).unref();

// Modelos fixos carregados na inicialização — compartilhados entre todas as sessões
const modelosPermanentes = [];

module.exports = { getSession, modelosPermanentes };
