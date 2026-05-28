prompt_content = """# Alice - Prompt para Antigravity (Geração Automática Completa)Objetivo: Gerar a aplicação Alice INTEIRA em uma única execução, com mínima interferência do usuário.🎯 INSTRUÇÃO PRINCIPALVocê é um agente de desenvolvimento especializado em criar aplicações web completas. Sua tarefa é gerar a plataforma Alice do zero até a conclusão, seguindo rigorosamente as especificações abaixo.CRÍTICO: Você DEVE gerar TUDO em uma única execução. Não deixe tarefas pendentes. A aplicação deve estar 100% funcional ao final.📋 Escopo Completo✅ O QUE VOCÊ DEVE GERAR1. Backend (Node.js + Express)
 Estrutura de pastas completa
 Arquivo package.json com todas as dependências
 Arquivo .env.example com todas as variáveis
 Configuração de Clerk (autenticação)
 Configuração de Supabase (banco de dados)
 Configuração de OpenAI (IA)
 Configuração de Meta API (WhatsApp/Instagram)
 Configuração de Google Calendar
 Configuração de Stripe
 Configuração de Redis
 Middleware de autenticação
 Middleware de validação (Zod)
 Middleware de CORS
 Middleware de rate limiting
 Middleware de logging (Pino)
 Middleware de tratamento de erros
 Todos os 25+ endpoints da API
 Serviço de IA (processamento de mensagens)
 Serviço de integrações (Meta, Google, Stripe)
 Serviço de CRM
 Serviço de email
 Serviço de analytics
 Fila de mensagens (Bull)
 Workers para processamento assíncrono
 Health check endpoint
 Metrics endpoint (Prometheus)
2. Banco de Dados (Supabase)
 Todas as 12 tabelas criadas (SQL)
 Todos os índices otimizados
 RLS (Row Level Security) policies
 Triggers para updated_at
 Enums para status, roles, channels
 Constraints e foreign keys
 Arquivo de migrations (SQL)
3. Frontend (React + Vite)
 Estrutura de pastas completa
 Arquivo package.json com todas as dependências
 Arquivo .env.example
 Configuração Vite
 Configuração Tailwind CSS
 Configuração Shadcn/ui
 Configuração Clerk (frontend)
 Configuração React Router
 Configuração React Query
 Configuração React Hook Form
 Layout principal com sidebar
 Autenticação com Clerk
 Proteção de rotas
 Todos os 12 módulos:

Dashboard com KPIs e gráficos
Inbox de conversas (chat em tempo real)
Gerenciador de clientes
Catálogo de produtos
Gestão de pedidos
Agendador (calendário)
Base de conhecimento
Automações (builder visual)
Relatórios e analytics
Configurações
Gerenciador de equipe
Widget de chat embarcado


 Componentes reutilizáveis
 Hooks customizados
 Context API para estado global
 Integração com API backend
 Tratamento de erros
 Loading states
 Notificações (toast)
 Responsividade completa
 Acessibilidade (WCAG 2.1 AA)
4. Integrações
 Meta API (WhatsApp + Instagram) - Webhooks
 Clerk - Autenticação OAuth
 Supabase - Banco de dados
 OpenAI - GPT-4 Turbo
 Google Calendar - Agendamentos
 Stripe - Pagamentos
 Redis - Cache
 SendGrid - Email (opcional)
5. Infraestrutura
 Dockerfile para backend
 Dockerfile para frontend
 docker-compose.yml completo
 nginx.conf (reverse proxy)
 .dockerignore
 .gitignore
 GitHub Actions workflow (CI/CD)
 Script de deploy
 Script de backup
 Script de health check
6. Segurança
 HTTPS obrigatório
 CORS configurado
 Rate limiting
 Validação de entrada (Zod)
 Criptografia de dados sensíveis
 Verificação de assinatura em webhooks
 RLS no Supabase
 Logs de auditoria
 Secrets em environment variables
 HSTS headers
 CSP headers
 CSRF protection
7. Documentação
 README.md completo
 CONTRIBUTING.md
 API documentation
 Setup guide
 Deployment guide
 Troubleshooting guide
🔧 Tecnologias ObrigatóriasBackendjson123456789101112131415161718192021222324{
  "dependencies": {
    "express": "^4.18.2",
    "clerk-sdk-node": "^latest",
    "@supabase/supabase-js": "^latest",
    "openai": "^latest",
    "axios": "^latest",
    "zod": "^latest",
    "pino": "^latest",
    "pino-pretty": "^latest",
    "bull": "^latest",
    "redis": "^latest",
    "cors": "^latest",
    "express-rate-limit": "^latest",
    "jsonwebtoken": "^latest",
    "bcryptjs": "^latest",
    "dotenv": "^latest"
  },
  "devDependencies": {
    "jest": "^latest",
    "supertest": "^latest",
    "nodemon": "^latest"
  }
}Frontendjson1234567891011121314151617181920212223242526{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.x",
    "@tanstack/react-query": "^latest",
    "react-hook-form": "^latest",
    "zod": "^latest",
    "@hookform/resolvers": "^latest",
    "axios": "^latest",
    "tailwindcss": "^latest",
    "@shadcn/ui": "^latest",
    "lucide-react": "^latest",
    "recharts": "^latest",
    "@clerk/clerk-react": "^latest",
    "socket.io-client": "^latest",
    "date-fns": "^latest"
  },
  "devDependencies": {
    "vite": "^latest",
    "@vitejs/plugin-react": "^latest",
    "tailwindcss": "^latest",
    "postcss": "^latest",
    "autoprefixer": "^latest"
  }
}📊 Banco de Dados (SQL Completo)Gere TODAS as tabelas com:
Tipos de dados corretos
Constraints (PRIMARY KEY, FOREIGN KEY, UNIQUE)
Índices para performance
Enums para status
Triggers para updated_at
RLS policies para segurança
🔌 Integrações (Código Completo)Meta API (WhatsApp/Instagram)
Webhook para receber mensagens
Função para enviar mensagens
Verificação de assinatura
Tratamento de erros
Clerk
Middleware de autenticação
Sincronização de usuários
Webhook para eventos
OpenAI
Função para processar mensagens
Extração de intenção
Análise de sentimento
Geração de respostas
Google Calendar
Autenticação OAuth
Criar eventos
Verificar disponibilidade
Sincronizar agendamentos
Stripe
Webhook para pagamentos
Criar checkout session
Processar reembolsos
🎨 Frontend (Componentes Completos)Páginas
Dashboard (com gráficos)
Inbox (chat em tempo real)
Clientes (CRUD)
Produtos (CRUD)
Pedidos (CRUD)
Agendamentos (calendário)
Base de conhecimento (editor)
Automações (builder)
Relatórios (gráficos)
Configurações (integrações)
Equipe (gerenciamento)
Componentes Reutilizáveis
Button, Input, Select, Textarea
Card, Modal, Sidebar, Navbar
Table, Pagination, Filters
Chart, Stat, Badge, Avatar
Toast, Skeleton, Loading
Funcionalidades
Autenticação com Clerk
Proteção de rotas
Paginação
Busca e filtros
Sorting
Exportação de dados
Responsividade
Dark mode (opcional)
🚀 Deployment (Docker + VPS)Docker
Dockerfile para backend (Node.js)
Dockerfile para frontend (Node.js build)
docker-compose.yml com:

Backend
Frontend
PostgreSQL
Redis
Nginx


CI/CD (GitHub Actions)
Build automático
Testes automáticos
Deploy automático
Health checks
VPS Setup
Script de inicialização
Script de deploy
Script de backup
Monitoramento
🔐 Segurança (Implementada)
 Clerk para autenticação
 Supabase RLS
 HTTPS obrigatório
 CORS configurado
 Rate limiting
 Validação com Zod
 Criptografia de dados
 Logs de auditoria
 Verificação de webhooks
 Secrets em .env
📝 Estrutura de Pastas (Completa)textalice/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.js
│   │   │   │   ├── customers.js
│   │   │   │   ├── conversations.js
│   │   │   │   ├── messages.js
│   │   │   │   ├── products.js
│   │   │   │   ├── orders.js
│   │   │   │   ├── appointments.js
│   │   │   │   ├── knowledge-base.js
│   │   │   │   ├── automations.js
│   │   │   │   ├── analytics.js
│   │   │   │   └── webhooks.js
│   │   │   ├── middleware/
│   │   │   │   ├── auth.js
│   │   │   │   ├── validation.js
│   │   │   │   ├── errorHandler.js
│   │   │   │   ├── cors.js
│   │   │   │   ├── rateLimit.js
│   │   │   │   └── logging.js
│   │   │   └── controllers/
│   │   ├── services/
│   │   │   ├── aiService.js
│   │   │   ├── connectorService.js
│   │   │   ├── crmService.js
│   │   │   ├── paymentService.js
│   │   │   ├── emailService.js
│   │   │   └── analyticsService.js
│   │   ├── models/
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   ├── redis.js
│   │   │   ├── llm.js
│   │   │   └── integrations.js
│   │   ├── utils/
│   │   ├── queue/
│   │   │   ├── messageQueue.js
│   │   │   └── workers.js
│   │   └── app.js
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   ├── tests/
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/
│   │   │   ├── Inbox/
│   │   │   ├── Customers/
│   │   │   ├── Products/
│   │   │   ├── Orders/
│   │   │   ├── Appointments/
│   │   │   ├── KnowledgeBase/
│   │   │   ├── Automations/
│   │   │   ├── Analytics/
│   │   │   ├── Settings/
│   │   │   ├── Team/
│   │   │   ├── Layout/
│   │   │   └── Common/
│   │   ├── pages/
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── hooks/
│   │   ├── context/
│   │   ├── styles/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── .env.example
│   ├── Dockerfile
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   └── README.md
│
├── docker-compose.yml
├── nginx.conf
├── .gitignore
├── .dockerignore
├── .github/
│   └── workflows/
│       └── deploy.yml
├── scripts/
│   ├── deploy.sh
│   ├── backup.sh
│   └── health-check.sh
├── PRD.md
├── SPECS.md
├── SECURITY.md
├── README.md
└── CONTRIBUTING.md✅ Checklist de ConclusãoVocê DEVE completar TODOS os itens abaixo:Backend
 Estrutura de pastas criada
 package.json com todas as dependências
 .env.example com todas as variáveis
 app.js com configuração Express
 Middleware de autenticação (Clerk)
 Middleware de validação (Zod)
 Middleware de CORS
 Middleware de rate limiting
 Middleware de logging (Pino)
 Middleware de tratamento de erros
 Todos os 25+ endpoints implementados
 Serviço de IA (OpenAI)
 Serviço de integrações (Meta, Google, Stripe)
 Fila de mensagens (Bull)
 Health check endpoint
 Metrics endpoint
Banco de Dados
 Todas as 12 tabelas criadas
 Todos os índices criados
 RLS policies criadas
 Triggers para updated_at
 Arquivo de migrations SQL
 Enums para status
Frontend
 Estrutura de pastas criada
 package.json com todas as dependências
 .env.example
 Vite configurado
 Tailwind CSS configurado
 Shadcn/ui configurado
 Clerk integrado
 React Router configurado
 React Query configurado
 Layout principal com sidebar
 Autenticação com Clerk
 Proteção de rotas
 Dashboard completo
 Inbox de conversas
 Gerenciador de clientes
 Catálogo de produtos
 Gestão de pedidos
 Agendador
 Base de conhecimento
 Automações
 Relatórios
 Configurações
 Gerenciador de equipe
 Componentes reutilizáveis
 Hooks customizados
 Responsividade completa
Integrações
 Meta API (WhatsApp/Instagram)
 Clerk (autenticação)
 Supabase (banco de dados)
 OpenAI (IA)
 Google Calendar
 Stripe (pagamentos)
 Redis (cache)
Infraestrutura
 Dockerfile backend
 Dockerfile frontend
 docker-compose.yml
 nginx.conf
 .gitignore
 .dockerignore
 GitHub Actions workflow
 Scripts de deploy/backup
Segurança
 HTTPS obrigatório
 CORS configurado
 Rate limiting ativo
 Validação de entrada
 Criptografia de dados
 Logs de auditoria
 Verificação de webhooks
 RLS no Supabase
 Secrets em .env
Documentação
 README.md
 CONTRIBUTING.md
 API documentation
 Setup guide
 Deployment guide
🎯 Resultado FinalAo completar esta tarefa, você terá:✅ Uma aplicação web completa e funcional
✅ Backend com API REST completa
✅ Frontend com interface moderna e responsiva
✅ Banco de dados estruturado e otimizado
✅ Integrações com Meta API, Clerk, OpenAI, Google Calendar, Stripe
✅ Segurança implementada (autenticação, validação, criptografia)
✅ Infraestrutura pronta para deploy (Docker, Docker Compose, Nginx)
✅ CI/CD configurado (GitHub Actions)
✅ Documentação completa
✅ Pronto para produção em VPSNENHUMA TAREFA DEVE FICAR PENDENTE.