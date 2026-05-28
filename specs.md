🏗️ SPECS.md - Technical Specificationsmarkdown1234567891011# Alice - Technical Specifications (SPECS)

**Versão:** 1.0  
**Data:** 22/05/2026  
**Stack:** Node.js + React + Supabase + Clerk  
**Deployment:** VPS + Docker  
**Repositório:** https://github.com/sickn33/alice

---

## 🏗️ Arquitetura Geral┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                 │
└──────────────────────┬──────────────────────────────────────┘
│ HTTPS
┌──────────────────────▼──────────────────────────────────────┐
│                   API Gateway (Node.js)                     │
└──────────────────────┬──────────────────────────────────────┘
│
┌──────────────┼──────────────┐
│              │              │
┌───────▼────┐  ┌─────▼──────┐  ┌───▼──────────┐
│  Supabase  │  │   Redis    │  │  Vector DB   │
│ (Database) │  │  (Cache)   │  │  (Embeddings)│
└────────────┘  └────────────┘  └──────────────┘
│
┌───────▼──────────────────────────────────────┐
│         Serviços Externos (Webhooks)         │
└────────────────────────────────────────────┘markdown
---

## 🛠️ Stack Tecnológico

### Backend
- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js 4.x
- **Autenticação:** Clerk SDK
- **Banco de Dados:** Supabase (PostgreSQL 15)
- **Cache:** Redis 7.x
- **Vector DB:** Supabase Vector (pgvector)
- **IA/LLM:** OpenAI API (GPT-4 Turbo)
- **Message Queue:** Bull (Redis-based)
- **Validação:** Zod
- **HTTP Client:** Axios
- **Logging:** Pino
- **Testing:** Jest + Supertest

### Frontend
- **Framework:** React 18.x
- **Build Tool:** Vite
- **Styling:** Tailwind CSS 3.x
- **UI Components:** Shadcn/ui
- **State Management:** TanStack Query (React Query)
- **Routing:** React Router v6
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts
- **Icons:** Lucide React
- **HTTP Client:** Axios
- **Real-time:** Socket.io Client

### Infraestrutura
- **Containerização:** Docker + Docker Compose
- **Orquestração:** Docker Swarm (VPS)
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus + Grafana
- **Logging:** Pino + File Rotation
- **CDN:** Cloudflare
- **Email:** SendGrid ou Resend

---

## 📊 Schema de Banco de Dados (Supabase PostgreSQL)

### Tabelas Principais

#### `workspaces`
```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);userssql1234567891011121314CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  role ENUM('admin', 'manager', 'agent') DEFAULT 'agent',
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_workspace ON users(workspace_id);
CREATE INDEX idx_users_clerk_id ON users(clerk_id);customerssql123456789101112131415161718CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  instagram_handle VARCHAR(255),
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  lifetime_value DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_customers_workspace ON customers(workspace_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_whatsapp ON customers(whatsapp);conversationssql12345678910111213141516CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  channel ENUM('whatsapp', 'instagram', 'email', 'widget') NOT NULL,
  status ENUM('active', 'closed', 'archived') DEFAULT 'active',
  assigned_to UUID REFERENCES users(id),
  sentiment_score FLOAT,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversations_workspace ON conversations(workspace_id);
CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_conversations_status ON conversations(status);messagessql123456789101112131415CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) NOT NULL,
  sender_type ENUM('customer', 'agent', 'ai') NOT NULL,
  sender_id UUID,
  content TEXT NOT NULL,
  media_urls TEXT[],
  intent VARCHAR(100),
  entities JSONB,
  sentiment FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);productssql1234567891011121314151617CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock INT DEFAULT 0,
  category VARCHAR(100),
  image_url TEXT,
  sku VARCHAR(100) UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_workspace ON products(workspace_id);
CREATE INDEX idx_products_category ON products(category);orderssql123456789101112131415CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
  payment_method ENUM('credit_card', 'pix', 'boleto', 'whatsapp_pay'),
  payment_status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orders_workspace ON orders(workspace_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);order_itemssql1234567891011CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) NOT NULL,
  product_id UUID REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);appointmentssql123456789101112131415161718CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  service_type VARCHAR(100) NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  duration_minutes INT DEFAULT 60,
  status ENUM('scheduled', 'confirmed', 'completed', 'cancelled') DEFAULT 'scheduled',
  google_calendar_event_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_appointments_workspace ON appointments(workspace_id);
CREATE INDEX idx_appointments_customer ON appointments(customer_id);
CREATE INDEX idx_appointments_date ON appointments(scheduled_date);knowledge_basesql123456789101112131415CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  tags TEXT[],
  embedding VECTOR(1536),
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_kb_workspace ON knowledge_base(workspace_id);
CREATE INDEX idx_kb_category ON knowledge_base(category);automationssql1234567891011121314CREATE TABLE automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  trigger_event VARCHAR(100) NOT NULL,
  conditions JSONB,
  actions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_automations_workspace ON automations(workspace_id);
CREATE INDEX idx_automations_trigger ON automations(trigger_event);audit_logssql12345678910111213141516CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_workspace ON audit_logs(workspace_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);🔌 Integrações ExternasMeta API (WhatsApp + Instagram)javascript12345678910111213// Webhook para receber mensagens
POST /api/webhooks/meta
Headers: X-Hub-Signature-256: sha256=...

// Enviar mensagem WhatsApp
POST https://graph.instagram.com/v18.0/{phone-number-id}/messages
{
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to: "{{customer_phone}}",
  type: "text",
  text: { body: "Sua mensagem" }
}Clerk Authenticationjavascript12345678const { getAuth } = require('@clerk/express');

app.use((req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  req.userId = userId;
  next();
});Supabase Clientjavascript123456const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);Google Calendarjavascript123456const { google } = require('googleapis');

const calendar = google.calendar({
  version: 'v3',
  auth: oauth2Client
});OpenAI APIjavascript12345const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});📡 Endpoints da API (Resumo)Autenticação
POST /api/auth/callback/clerk - Webhook do Clerk
GET /api/auth/me - Dados do usuário atual
POST /api/auth/logout - Logout
Clientes
GET /api/customers - Listar clientes
POST /api/customers - Criar cliente
GET /api/customers/:id - Detalhes
PUT /api/customers/:id - Atualizar
DELETE /api/customers/:id - Deletar
Conversas
GET /api/conversations - Listar
GET /api/conversations/:id - Detalhes
POST /api/conversations/:id/messages - Enviar mensagem
GET /api/conversations/:id/messages - Histórico
PUT /api/conversations/:id/status - Atualizar status
Produtos
GET /api/products - Listar
POST /api/products - Criar
GET /api/products/:id - Detalhes
PUT /api/products/:id - Atualizar
DELETE /api/products/:id - Deletar
Pedidos
POST /api/orders - Criar
GET /api/orders/:id - Detalhes
PUT /api/orders/:id/status - Atualizar status
GET /api/orders - Listar
Agendamentos
POST /api/appointments - Criar
GET /api/appointments - Listar
PUT /api/appointments/:id - Atualizar
DELETE /api/appointments/:id - Cancelar
GET /api/appointments/availability - Verificar disponibilidade
Analytics
GET /api/analytics/dashboard - KPIs principais
GET /api/analytics/conversations - Estatísticas
GET /api/analytics/export - Exportar dados
Webhooks
POST /api/webhooks/meta - Meta API (WhatsApp/Instagram)
POST /api/webhooks/stripe - Stripe (Pagamentos)
🔐 Padrões de SegurançaVariáveis de Ambiente (.env)bash123456789101112131415161718192021222324252627282930313233# Clerk
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (NUNCA expor)

# OpenAI
OPENAI_API_KEY=sk-...

# Meta API
META_BUSINESS_ACCOUNT_ID=...
META_ACCESS_TOKEN=... (NUNCA expor)
META_WEBHOOK_VERIFY_TOKEN=...

# Google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=... (NUNCA expor)

# Stripe
STRIPE_SECRET_KEY=sk_live_... (NUNCA expor)
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Redis
REDIS_URL=redis://localhost:6379

# App
NODE_ENV=production
API_URL=https://api.alice.ai
FRONTEND_URL=https://app.alice.ai
JWT_SECRET=... (NUNCA expor)Segurança Implementada
✅ Clerk para autenticação (OAuth 2.0)
✅ Supabase RLS (Row Level Security)
✅ HTTPS obrigatório
✅ CORS configurado
✅ Rate limiting (100 req/min por IP)
✅ Validação de entrada com Zod
✅ Criptografia de dados sensíveis
✅ Logs de auditoria completos
✅ Verificação de assinatura em webhooks
✅ Isolamento de dados por workspace
✅ Conformidade com LGPD/GDPR
🚀 Deployment (VPS)Docker Composeyaml123456789101112131415161718192021222324252627282930313233343536373839404142434445464748version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/alice
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: always

  frontend:
    build: ./frontend
    ports:
      - "3001:3000"
    restart: always

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=alice
      - POSTGRES_USER=alice
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  redis:
    image: redis:7-alpine
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    restart: always

volumes:
  postgres_data:📊 MonitoramentoHealth Checkjavascript12345678910111213141516171819app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    database: 'checking...',
    redis: 'checking...'
  };

  try {
    await supabase.from('users').select('count', { count: 'exact' });
    health.database = 'ok';
  } catch (e) {
    health.database = 'error';
    health.status = 'degraded';
  }

  res.status(health.status === 'ok' ? 200 : 503).json(health);
});📚 Skills do Antigravity NecessáriasFase 1 - Setup Inicial
@react-vite-setup - Configurar React 18 + Vite
@tailwind-shadcn-setup - Tailwind CSS + Shadcn/ui
@clerk-auth-setup - Integração Clerk
@supabase-setup - Configurar Supabase
@express-api-setup - Express.js com estrutura completa
Fase 2 - Integrações
@meta-api-whatsapp - Meta API (WhatsApp + Instagram)
@openai-integration - OpenAI GPT-4 Turbo
@google-calendar-api - Google Calendar
@stripe-integration - Stripe para pagamentos
@redis-cache-setup - Redis para cache
Fase 3 - Banco de Dados
@supabase-migrations - Criar todas as tabelas
@supabase-rls-policies - Row Level Security
@database-indexes - Otimizar índices
Fase 4 - Frontend
@react-router-setup - React Router v6
@react-query-setup - TanStack Query
@form-validation-setup - React Hook Form + Zod
@recharts-setup - Gráficos e dashboards
Fase 5 - Módulos
@dashboard-module - Dashboard com KPIs
@inbox-conversations - Inbox de conversas
@customers-module - Gerenciador de clientes
@products-module - Catálogo de produtos
@orders-module - Gestão de pedidos
@appointments-module - Agendador
@knowledge-base-module - Base de conhecimento
@automations-module - Workflows
@analytics-module - Relatórios
@settings-module - Configurações
Fase 6 - DevOps
@docker-compose-setup - Docker + Docker Compose
@github-actions-ci-cd - CI/CD pipeline
@nginx-reverse-proxy - Nginx configuration
@monitoring-prometheus - Prometheus + Grafana
@logging-pino - Pino logger com rotação
📋 Estrutura de Pastas Finaltextalice/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   └── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── config/
│   │   ├── utils/
│   │   ├── queue/
│   │   └── app.js
│   ├── migrations/
│   ├── tests/
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── context/
│   │   ├── styles/
│   │   └── App.jsx
│   ├── public/
│   ├── .env.example
│   ├── Dockerfile
│   ├── vite.config.js
│   └── package.json
│
├── docker-compose.yml
├── nginx.conf
├── .gitignore
├── PRD.md
├── SPECS.md
├── SECURITY.md
└── README.md✅ Checklist de Conclusão
 Todas as tabelas criadas no Supabase
 RLS policies configuradas
 Índices de banco de dados otimizados
 API Express com todos os endpoints
 Autenticação Clerk integrada
 Meta API (WhatsApp/Instagram) funcionando
 OpenAI integrada para IA
 Google Calendar integrada
 Stripe integrada para pagamentos
 Redis configurado para cache
 Frontend React completo
 Todos os módulos implementados
 Dashboard com gráficos
 Inbox de conversas funcional
 Gerenciador de clientes
 Catálogo de produtos
 Gestão de pedidos
 Agendador
 Base de conhecimento
 Automações (workflows)
 Relatórios e analytics
 Configurações e integrações
 Docker Compose configurado
 GitHub Actions CI/CD
 Nginx reverse proxy
 Monitoring (Prometheus/Grafana)
 Logging (Pino)
 Testes unitários
 Testes de integração
 Documentação completa
 Deploy em VPS testado
markdown
---

## **🚀 PROMPT_ANTIGRAVITY.md - Instruções para Geração Automática**
```markdown
# Alice - Prompt para Antigravity (Geração Automática Completa)

**Objetivo:** Gerar a aplicação Alice INTEIRA em uma única execução, com mínima interferência do usuário.

---

## 🎯 INSTRUÇÃO PRINCIPAL

Você é um agente de desenvolvimento especializado em criar aplicações web completas. Sua tarefa é **gerar a plataforma Alice do zero até a conclusão**, seguindo rigorosamente as especificações abaixo.

**CRÍTICO:** Você DEVE gerar TUDO em uma única execução. Não deixe tarefas pendentes. A aplicação deve estar 100% funcional ao final.

---

## 📋 Escopo Completo

### ✅ O QUE VOCÊ DEVE GERAR

#### 1. **Backend (Node.js + Express)**
- [ ] Estrutura de pastas completa
- [ ] Arquivo `package.json` com todas as dependências
- [ ] Arquivo `.env.example` com todas as variáveis
- [ ] Configuração de Clerk (autenticação)
- [ ] Configuração de Supabase (banco de dados)
- [ ] Configuração de OpenAI (IA)
- [ ] Configuração de Meta API (WhatsApp/Instagram)
- [ ] Configuração de Google Calendar
- [ ] Configuração de Stripe
- [ ] Configuração de Redis
- [ ] Middleware de autenticação
- [ ] Middleware de validação (Zod)
- [ ] Middleware de CORS
- [ ] Middleware de rate limiting
- [ ] Middleware de logging (Pino)
- [ ] Middleware de tratamento de erros
- [ ] Todos os 25+ endpoints da API
- [ ] Serviço de IA (processamento de mensagens)
- [ ] Serviço de integrações (Meta, Google, Stripe)
- [ ] Serviço de CRM
- [ ] Serviço de email
- [ ] Serviço de analytics
- [ ] Fila de mensagens (Bull)
- [ ] Workers para processamento assíncrono
- [ ] Health check endpoint
- [ ] Metrics endpoint (Prometheus)

#### 2. **Banco de Dados (Supabase)**
- [ ] Todas as 12 tabelas criadas (SQL)
- [ ] Todos os índices otimizados
- [ ] RLS (Row Level Security) policies
- [ ] Triggers para updated_at
- [ ] Enums para status, roles, channels
- [ ] Constraints e foreign keys
- [ ] Arquivo de migrations (SQL)

#### 3. **Frontend (React + Vite)**
- [ ] Estrutura de pastas completa
- [ ] Arquivo `package.json` com todas as dependências
- [ ] Arquivo `.env.example`
- [ ] Configuração Vite
- [ ] Configuração Tailwind CSS
- [ ] Configuração Shadcn/ui
- [ ] Configuração Clerk (frontend)
- [ ] Configuração React Router
- [ ] Configuração React Query
- [ ] Configuração React Hook Form
- [ ] Layout principal com sidebar
- [ ] Autenticação com Clerk
- [ ] Proteção de rotas
- [ ] Todos os 12 módulos:
  - Dashboard com KPIs e gráficos
  - Inbox de conversas (chat em tempo real)
  - Gerenciador de clientes
  - Catálogo de produtos
  - Gestão de pedidos
  - Agendador (calendário)
  - Base de conhecimento
  - Automações (builder visual)
  - Relatórios e analytics
  - Configurações
  - Gerenciador de equipe
  - Widget de chat embarcado
- [ ] Componentes reutilizáveis
- [ ] Hooks customizados
- [ ] Context API para estado global
- [ ] Integração com API backend
- [ ] Tratamento de erros
- [ ] Loading states
- [ ] Notificações (toast)
- [ ] Responsividade completa
- [ ] Acessibilidade (WCAG 2.1 AA)

#### 4. **Integrações**
- [ ] Meta API (WhatsApp + Instagram) - Webhooks
- [ ] Clerk - Autenticação OAuth
- [ ] Supabase - Banco de dados
- [ ] OpenAI - GPT-4 Turbo
- [ ] Google Calendar - Agendamentos
- [ ] Stripe - Pagamentos
- [ ] Redis - Cache
- [ ] SendGrid - Email (opcional)

#### 5. **Infraestrutura**
- [ ] Dockerfile para backend
- [ ] Dockerfile para frontend
- [ ] docker-compose.yml completo
- [ ] nginx.conf (reverse proxy)
- [ ] .dockerignore
- [ ] .gitignore
- [ ] GitHub Actions workflow (CI/CD)
- [ ] Script de deploy
- [ ] Script de backup
- [ ] Script de health check

#### 6. **Segurança**
- [ ] HTTPS obrigatório
- [ ] CORS configurado
- [ ] Rate limiting
- [ ] Validação de entrada (Zod)
- [ ] Criptografia de dados sensíveis
- [ ] Verificação de assinatura em webhooks
- [ ] RLS no Supabase
- [ ] Logs de auditoria
- [ ] Secrets em environment variables
- [ ] HSTS headers
- [ ] CSP headers
- [ ] CSRF protection

#### 7. **Documentação**
- [ ] README.md completo
- [ ] CONTRIBUTING.md
- [ ] API documentation
- [ ] Setup guide
- [ ] Deployment guide
- [ ] Troubleshooting guide

---

## 🔧 Tecnologias Obrigatórias

### Backend
```json
{
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