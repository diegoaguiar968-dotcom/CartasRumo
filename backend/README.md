# Agente Rumo — Backend v2.0

Backend do Agente Rumo, refatorado com integração real à API Claude (Anthropic).

## Estrutura de Pastas

```
agente-rumo-backend/
├── server.js               # Ponto de entrada
├── package.json
├── .env.example            # Modelo das variáveis de ambiente
├── .gitignore
│
├── routes/                 # Definição das rotas HTTP
│   ├── models.js
│   ├── oficio.js
│   ├── minuta.js
│   └── export.js
│
├── controllers/            # Lógica de cada endpoint
│   ├── modelsController.js
│   ├── oficioController.js
│   ├── minutaController.js
│   └── exportController.js
│
├── services/               # Regras de negócio e integrações externas
│   ├── claudeService.js    # ← Integração com Claude AI (Anthropic)
│   ├── pdfService.js       # ← Extração de texto de PDFs
│   └── store.js            # ← Armazenamento em memória
│
└── middleware/
    ├── upload.js           # Configuração do multer
    ├── logger.js           # Log de requisições
    └── errorHandler.js     # Tratamento centralizado de erros
```

## Rotas Disponíveis

| Método | Rota                  | Descrição                                      |
|--------|-----------------------|------------------------------------------------|
| GET    | /api/status           | Health check                                   |
| POST   | /api/models/upload    | Upload de PDFs de cartas-modelo                |
| GET    | /api/models/analyze   | Confirmar modelos carregados                   |
| POST   | /api/oficio/upload    | Upload do ofício ANTT + extração via Claude AI |
| POST   | /api/minuta/generate  | Gera a minuta de resposta via Claude AI        |
| POST   | /api/export/docx      | Exporta minuta como .docx                      |

## Setup Local

```bash
# 1. Instalar dependências
npm install

# 2. Criar arquivo .env
cp .env.example .env
# Edite .env e adicione sua ANTHROPIC_API_KEY

# 3. Rodar em desenvolvimento
npm run dev

# 4. Rodar em produção
npm start
```

## Deploy no Render

1. Faça push deste código para o seu repositório GitHub
2. No Render: **New → Web Service → conecte o repo**
3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Em **Environment Variables**, adicione:
   - `ANTHROPIC_API_KEY` = sua chave da Anthropic
5. Anote a URL gerada (ex: `https://agente-rumo-api.onrender.com`)
6. No `index.html` do frontend, atualize:
   ```js
   window.API_URL = "https://agente-rumo-api.onrender.com";
   ```

## Obter a API Key da Anthropic

1. Acesse https://console.anthropic.com/
2. Clique em **API Keys → Create Key**
3. Copie a chave (começa com `sk-ant-...`)
4. Nunca commite a chave no Git — use sempre variáveis de ambiente

## Notas de Segurança

- ✅ A API Key nunca é exposta no código-fonte
- ✅ Validação de tipo de arquivo (apenas PDF)
- ✅ Limite de 15 MB por arquivo
- ✅ Tratamento centralizado de erros
- ⚠️ O `store.js` é volátil (memória) — dados são perdidos ao reiniciar
- ⚠️ Para produção com múltiplos usuários, adicione autenticação e um banco de dados
