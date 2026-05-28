# Alice - Plataforma Autônoma de Atendimento & Vendas 🚀

Alice é uma plataforma completa e autônoma de atendimento, suporte ao cliente e vendas impulsionada por Inteligência Artificial (GPT-4 Turbo), integrada com Meta API (WhatsApp e Instagram), Stripe (pagamentos automáticos) e Google Calendar (agendamentos).

---

## 🛠️ Stack Tecnológica

### Backend
- **Express.js (Node.js 20 LTS)**: Servidor REST API principal.
- **Clerk SDK**: Autenticação e controle de sessões federado.
- **Supabase (PostgreSQL 15)**: Armazenamento persistente com Row-Level Security (RLS).
- **Bull + Redis**: Filas de mensagens assíncronas para processamento resiliente de webhooks.
- **OpenAI (GPT-4 Turbo & embeddings)**: Motor de inteligência, análise de sentimento e buscas RAG.
- **Pino & Pino Pretty**: Logging estruturado de alta performance.

### Frontend
- **React 18 & Vite**: SPA rápida, otimizada e responsiva.
- **Tailwind CSS & Shadcn/ui**: Design de altíssima fidelidade com tema escuro imersivo, gradientes HSL vibrantes e glassmorphism.
- **TanStack Query (React Query)**: Sincronização de estados de rede e cache em memória.
- **Recharts**: Gráficos analíticos interativos de volume e sentimento.
- **Lucide React**: Biblioteca de ícones modernos e minimalistas.

---

## 📝 Estrutura do Projeto

```text
alice/
├── backend/                  # Servidor Express.js
│   ├── src/
│   │   ├── api/              # Rotas, middlewares e validações
│   │   ├── config/           # Clientes Supabase, Redis, OpenAI e Stripe
│   │   ├── services/         # Processadores de IA, CRM e conectores
│   │   ├── queue/            # Filas Bull e workers assíncronos
│   │   └── app.js            # Entrypoint da aplicação Express
│   ├── migrations/           # Schemas de Banco de Dados SQL
│   └── Dockerfile
│
├── frontend/                 # Interface do Usuário React SPA
│   ├── src/
│   │   ├── components/       # 12 Módulos funcionais e visual layouts
│   │   ├── services/         # Conectores Axios com dev mock fallbacks
│   │   ├── context/          # Provedor global de estado e toasts
│   │   ├── styles/           # Design system e estilização index.css
│   │   └── App.jsx           # Rotas e layouts estruturados
│   └── Dockerfile
│
├── docker-compose.yml        # Orquestrador de contêineres Docker
├── nginx.conf                # Configuração de proxy reverso Nginx
└── scripts/                  # Shell scripts para backup, deploy e health-check
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js v20 LTS instalado.
- Redis rodando localmente (ou via Docker).
- Docker e Docker Compose (opcional, para execução em contêineres).

### Executando em Contêineres (Docker Compose)
Para rodar toda a aplicação integrada de forma local instantaneamente:
```bash
docker-compose up --build
```
A plataforma estará acessível nos seguintes endereços:
- **Frontend (Painel)**: `http://localhost:3001`
- **Backend (API)**: `http://localhost:3000`
- **Health Check**: `http://localhost:3000/api/health`

### Executando de Forma Manual (Modo Desenvolvimento)

#### 1. Configure as Variáveis de Ambiente
Copie o template `.env.example` tanto em `backend/` quanto em `frontend/` e insira suas credenciais:
```bash
cp backend/.env.example backend/.env
```

#### 2. Instale as Dependências e Rode o Backend
```bash
cd backend
npm install
npm run dev
```

#### 3. Instale as Dependências e Rode o Frontend
```bash
cd ../frontend
npm install
npm run dev
```

---

## 🔐 Segurança Implementada

- **CORS Configurado**: Proteção de tráfego baseada em origens registradas.
- **Express Rate Limit**: Máximo de 100 requisições por minuto por endereço IP.
- **Clerk JWT Verification**: Proteção de sessão de usuário em nível de middleware.
- **Supabase RLS Policies**: Proteção contra vazamento de dados isolando inquilinos (workspaces) de forma lógica na base.
- **Cabeçalhos HTTP Seguros**: Imposição automática de HSTS, nosniff, Frame Options e CSP.
