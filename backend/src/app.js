const express = require('express');
require('dotenv').config();

// Configs & Services
const { supabase } = require('./config/database');
const { redisClient } = require('./config/redis');

// Middlewares
const corsMiddleware = require('./api/middleware/cors');
const { requestLogger, logger } = require('./api/middleware/logging');
const { apiRateLimiter } = require('./api/middleware/rateLimit');
const { errorHandler } = require('./api/middleware/errorHandler');

// Routes
const authRoutes = require('./api/routes/auth');
const customerRoutes = require('./api/routes/customers');
const conversationRoutes = require('./api/routes/conversations');
const messageRoutes = require('./api/routes/messages');
const productRoutes = require('./api/routes/products');
const serviceRoutes = require('./api/routes/services');
const orderRoutes = require('./api/routes/orders');
const appointmentRoutes = require('./api/routes/appointments');
const kbRoutes = require('./api/routes/knowledge-base');
const automationRoutes = require('./api/routes/automations');
const analyticsRoutes = require('./api/routes/analytics');
const webhookRoutes = require('./api/routes/webhooks');
const whatsappRoutes = require('./api/routes/whatsapp');
const integrationRoutes = require('./api/routes/integrations');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and Logging Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(corsMiddleware);
app.use(requestLogger);
app.use('/api/', apiRateLimiter);

// Native HTTP Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});

// Mounting Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/conversations/:id/messages', messageRoutes);
app.use('/api/products', productRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/knowledge-base', kbRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/integrations', integrationRoutes);

// ==========================================
// 📊 SYSTEM HEALTH CHECK ENDPOINT
// ==========================================
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    database: 'checking...',
    redis: 'checking...'
  };

  try {
    // 1. Check Supabase
    const { error } = await supabase.from('workspaces').select('id').limit(1);
    health.database = error ? 'error' : 'ok';
    if (error) health.status = 'degraded';
  } catch (e) {
    health.database = 'error';
    health.status = 'degraded';
  }

  try {
    // 2. Check Redis
    if (redisClient.isOpen) {
      health.redis = 'ok';
    } else {
      health.redis = 'disconnected';
      health.status = 'degraded';
    }
  } catch (e) {
    health.redis = 'error';
    health.status = 'degraded';
  }

  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

// ==========================================
// 📈 PROMETHEUS METRICS ENDPOINT
// ==========================================
app.get('/api/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",handler="/api/health",status="200"} 42
# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total ${process.cpuUsage().user / 1000000}
`);
});

// Base Route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Alice Core Engine API' });
});

app.get(['/api', '/api/'], (req, res) => {
  res.json({ message: 'Welcome to Alice Core Engine API (API prefix route)' });
});

// Global Error Handler
app.use(errorHandler);

// Start Server (If not running in Jest tests)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Alice Engine successfully running on Port ${PORT}`);
    
    // Auto-connect all saved WhatsApp sessions on startup
    try {
      const whatsappService = require('./services/whatsappService');
      whatsappService.initAllSessions();
    } catch (startupErr) {
      console.error('[WhatsApp Service] Auto-connect on startup failed:', startupErr);
    }

    // Start periodic appointment reminder scheduler
    try {
      const reminderService = require('./services/reminderService');
      reminderService.startScheduler(60000); // Check every 1 minute
    } catch (reminderErr) {
      console.error('[Reminder Service] Initialization failed:', reminderErr);
    }
  });
}

module.exports = app;
