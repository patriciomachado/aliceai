============================================================================SECURITY.md============================================================================security_content = """# Alice - Security Guidelines (SECURITY)Versão: 1.0
Data: 22/05/2026
Classificação: Confidencial🔐 Princípios de Segurança
Defense in Depth - Múltiplas camadas de proteção
Least Privilege - Acesso mínimo necessário
Zero Trust - Verificar tudo, confiar em nada
Secure by Default - Segurança como padrão
Fail Secure - Falhar de forma segura
🔑 Gestão de Secrets❌ NUNCA FAZERjavascript12345678910111213// ❌ ERRADO - Secrets em código
const API_KEY = 'sk-abc123xyz';
const DB_PASSWORD = 'admin123';

// ❌ ERRADO - Secrets em .env commitado
// .env (commitado no git)
STRIPE_SECRET_KEY=sk_live_...

// ❌ ERRADO - Secrets em logs
console.log('Conectando com token:', token);

// ❌ ERRADO - Secrets em URLs
fetch(\`https://api.example.com?token=\${apiKey}\`);✅ FAZERjavascript1234567891011121314151617181920212223242526// ✅ CORRETO - Usar environment variables
const API_KEY = process.env.OPENAI_API_KEY;
const DB_PASSWORD = process.env.DB_PASSWORD;

// ✅ CORRETO - .env em .gitignore
// .gitignore
.env
.env.local
.env.*.local

// ✅ CORRETO - Usar Supabase Vault para secrets críticas
const secret = await supabase
  .from('vault')
  .select('value')
  .eq('key', 'stripe_secret_key')
  .single();

// ✅ CORRETO - Usar headers para tokens
const response = await fetch('https://api.example.com', {
  headers: {
    'Authorization': \`Bearer \${token}\`
  }
});

// ✅ CORRETO - Mascarar logs
logger.info('Conectando com token:', token.substring(0, 10) + '...');Secrets Críticas (NUNCA expor)markdown- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY
- META_ACCESS_TOKEN
- GOOGLE_CLIENT_SECRET
- STRIPE_SECRET_KEY
- JWT_SECRET
- DATABASE_PASSWORD
- CLERK_SECRET_KEYRotação de Secrets
API Keys: A cada 90 dias
Database Passwords: A cada 180 dias
JWT Secrets: A cada 365 dias
Tokens de Integração: Conforme política do provedor
🔐 AutenticaçãoClerk Setupjavascript123456789101112// ✅ CORRETO - Usar Clerk para autenticação
const { ClerkExpressWithAuth } = require('@clerk/express');

app.use(ClerkExpressWithAuth());

app.get('/api/protected', (req, res) => {
  const { userId } = req.auth;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  // Usuário autenticado
  res.json({ userId });
});JWT Tokensjavascript123456789101112131415// ✅ CORRETO - JWT com expiração curta
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { userId, email },
  process.env.JWT_SECRET,
  { expiresIn: '1h' } // Expiração curta
);

// ✅ CORRETO - Refresh tokens para renovação
const refreshToken = jwt.sign(
  { userId },
  process.env.REFRESH_TOKEN_SECRET,
  { expiresIn: '7d' }
);🛡️ Autorização (RBAC)Roles e Permissõesjavascript123456789101112131415161718192021222324252627282930313233343536const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent'
};

const PERMISSIONS = {
  admin: ['read', 'write', 'delete', 'manage_users'],
  manager: ['read', 'write', 'manage_team'],
  agent: ['read', 'write']
};

// ✅ CORRETO - Middleware de autorização
const authorize = (requiredPermission) => {
  return async (req, res, next) => {
    const { userId } = req.auth;
    
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('clerk_id', userId)
      .single();
    
    if (!user || !PERMISSIONS[user.role].includes(requiredPermission)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    req.user = user;
    next();
  };
};

// Usar
app.delete('/api/users/:id', authorize('delete'), (req, res) => {
  // Apenas admins podem deletar
});Row Level Security (RLS) no Supabasesql12345678910111213141516171819202122-- ✅ CORRETO - RLS habilitado
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Política: Usuários só veem clientes do seu workspace
CREATE POLICY "Users can view customers in their workspace"
  ON customers
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE clerk_id = auth.uid()
    )
  );

-- Política: Usuários só podem criar clientes no seu workspace
CREATE POLICY "Users can create customers in their workspace"
  ON customers
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE clerk_id = auth.uid()
    )
  );🔒 CriptografiaDados em Trânsitojavascript12345678910111213// ✅ CORRETO - HTTPS obrigatório
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect(\`https://\${req.headers.host}\${req.url}\`);
  }
  next();
});

// ✅ CORRETO - HSTS header
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});Dados em Repousojavascript12345678910111213141516171819202122// ✅ CORRETO - Criptografar dados sensíveis
const crypto = require('crypto');

const encryptData = (data, key) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decryptData = (encryptedData, key) => {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// Usar para dados sensíveis
const encryptedPhone = encryptData(customerPhone, process.env.ENCRYPTION_KEY);🚨 Validação de Entrada❌ NUNCA FAZERjavascript12345678910// ❌ ERRADO - SQL Injection
const query = \`SELECT * FROM users WHERE email = '\${email}'\`;

// ❌ ERRADO - XSS
res.send(\`<h1>\${userInput}</h1>\`);

// ❌ ERRADO - Sem validação
app.post('/api/users', (req, res) => {
  const user = req.body; // Aceita qualquer coisa
});✅ FAZERjavascript12345678910111213141516171819202122232425262728// ✅ CORRETO - Usar Zod para validação
const { z } = require('zod');

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(3).max(255),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional()
});

app.post('/api/users', (req, res) => {
  const result = userSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten() });
  }
  
  const validatedData = result.data;
  // Processar dados validados
});

// ✅ CORRETO - Parametrized queries
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('email', email); // Supabase usa parametrized queries

// ✅ CORRETO - Sanitizar output
const sanitizeHtml = require('sanitize-html');
const cleanHtml = sanitizeHtml(userInput);🔐 Proteção contra Ataques ComunsCSRF (Cross-Site Request Forgery)javascript12345678910111213// ✅ CORRETO - CSRF token
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(csrf({ cookie: true }));

app.get('/form', (req, res) => {
  res.send(\`<form action="/submit" method="POST">
    <input type="hidden" name="_csrf" value="\${req.csrfToken()}">
    <input type="submit">
  </form>\`);
});XSS (Cross-Site Scripting)javascript12345678// ✅ CORRETO - Content Security Policy
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );
  next();
});Rate Limitingjavascript123456789101112131415161718192021// ✅ CORRETO - Rate limiting por IP
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições
  message: 'Muitas requisições, tente novamente mais tarde',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// ✅ CORRETO - Rate limiting por usuário
const userLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 requisições por usuário
  keyGenerator: (req) => req.auth.userId
});

app.use('/api/messages', userLimiter);DDoS Protectionjavascript12345// ✅ CORRETO - Usar Cloudflare para DDoS
// Configurar no dashboard do Cloudflare
// - DDoS Protection: On
// - Rate Limiting: 100 req/min
// - Bot Management: On📝 Logging e Auditoria❌ NUNCA FAZERjavascript12345678// ❌ ERRADO - Logar dados sensíveis
logger.info('User login:', { email, password, token });

// ❌ ERRADO - Sem contexto
logger.error('Error');

// ❌ ERRADO - Logs em arquivo sem rotação
fs.appendFileSync('app.log', message);✅ FAZERjavascript1234567891011121314151617181920212223242526272829303132333435// ✅ CORRETO - Usar Pino para logging estruturado
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

// ✅ CORRETO - Mascarar dados sensíveis
logger.info({
  event: 'user_login',
  email: email,
  token: token.substring(0, 10) + '...',
  timestamp: new Date()
});

// ✅ CORRETO - Auditoria de ações críticas
const auditLog = async (action, userId, details) => {
  await supabase.from('audit_logs').insert({
    action,
    user_id: userId,
    details,
    ip_address: req.ip,
    user_agent: req.get('user-agent'),
    created_at: new Date()
  });
};

// Usar
await auditLog('delete_customer', userId, { customer_id });🔐 Webhook Security❌ NUNCA FAZERjavascript12345// ❌ ERRADO - Aceitar webhook sem verificação
app.post('/api/webhooks/meta', (req, res) => {
  const { messages } = req.body;
  // Processar sem verificar assinatura
});✅ FAZERjavascript1234567891011121314151617181920212223242526// ✅ CORRETO - Verificar assinatura do webhook
const crypto = require('crypto');

const verifyMetaWebhook = (req, res, next) => {
  const signature = req.get('X-Hub-Signature-256');
  const body = req.rawBody; // Body como string
  
  const hash = crypto
    .createHmac('sha256', process.env.META_APP_SECRET)
    .update(body)
    .digest('hex');
  
  const expectedSignature = \`sha256=\${hash}\`;
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
};

app.post('/api/webhooks/meta', verifyMetaWebhook, (req, res) => {
  // Webhook verificado
  const { messages } = req.body;
  // Processar...
});🔐 API Security❌ NUNCA FAZERjavascript12345678910111213// ❌ ERRADO - Expor informações sensíveis em erro
app.get('/api/users/:id', (req, res) => {
  try {
    const user = getUser(req.params.id);
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// ❌ ERRADO - Sem validação de entrada
app.get('/api/users/:id', (req, res) => {
  const user = getUser(req.params.id); // ID pode ser qualquer coisa
});✅ FAZERjavascript123456789101112131415161718192021222324252627282930// ✅ CORRETO - Mensagens de erro genéricas
app.get('/api/users/:id', (req, res) => {
  try {
    const user = getUser(req.params.id);
    res.json(user);
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ CORRETO - Validar ID
const { z } = require('zod');

const idSchema = z.string().uuid();

app.get('/api/users/:id', (req, res) => {
  const result = idSchema.safeParse(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  
  const user = getUser(result.data);
  res.json(user);
});

// ✅ CORRETO - Versionar API
app.get('/api/v1/users/:id', (req, res) => {
  // Versão 1 da API
});🔐 ComplianceLGPD (Lei Geral de Proteção de Dados)
✅ Consentimento explícito para coleta de dados
✅ Direito de acesso aos dados pessoais
✅ Direito de correção de dados
✅ Direito de exclusão ("direito ao esquecimento")
✅ Política de privacidade clara
✅ Notificação em caso de vazamento
GDPR (General Data Protection Regulation)
✅ Consentimento para processamento
✅ Data Processing Agreement (DPA)
✅ Direito de portabilidade de dados
✅ Privacy by Design
✅ Data Protection Impact Assessment (DPIA)
Implementaçãojavascript12345678910111213141516171819202122232425262728293031323334353637383940// ✅ CORRETO - Endpoint para deletar dados do usuário
app.delete('/api/users/:id/data', authorize('delete'), async (req, res) => {
  const { userId } = req.auth;
  
  // Verificar se é o próprio usuário ou admin
  if (userId !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Deletar dados
  await supabase.from('users').delete().eq('id', req.params.id);
  await supabase.from('customers').delete().eq('user_id', req.params.id);
  await supabase.from('conversations').delete().eq('user_id', req.params.id);
  
  // Auditoria
  await auditLog('user_data_deleted', userId, { deleted_user_id: req.params.id });
  
  res.json({ message: 'Dados deletados com sucesso' });
});

// ✅ CORRETO - Endpoint para exportar dados do usuário
app.get('/api/users/:id/export', authorize('read'), async (req, res) => {
  const { userId } = req.auth;
  
  if (userId !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const user = await supabase.from('users').select('*').eq('id', req.params.id);
  const customers = await supabase.from('customers').select('*').eq('user_id', req.params.id);
  const conversations = await supabase.from('conversations').select('*').eq('user_id', req.params.id);
  
  const exportData = {
    user: user.data,
    customers: customers.data,
    conversations: conversations.data
  };
  
  res.json(exportData);
});🔐 Checklist de Segurança
 Todas as secrets em environment variables
 HTTPS habilitado em produção
 HSTS header configurado
 CORS configurado corretamente
 Rate limiting ativo
 Validação de entrada em todos os endpoints
 Autenticação com Clerk
 Autorização com RBAC
 RLS habilitado no Supabase
 Criptografia de dados sensíveis
 Logging estruturado
 Auditoria de ações críticas
 Webhooks verificados
 Senhas com bcrypt
 JWT com expiração curta
 Refresh tokens para renovação
 CSRF protection
 XSS protection (CSP)
 DDoS protection (Cloudflare)
 Backup automático de dados
 Disaster recovery plan
 Política de privacidade publicada
 Termos de serviço publicados
 Compliance com LGPD/GDPR
📞 Reporte de SegurançaSe encontrar uma vulnerabilidade, envie um email para: security@alice.aiNão publique vulnerabilidades em issues públicas.
"""