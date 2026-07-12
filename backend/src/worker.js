/**
 * Alice Worker
 * --------------------------------------------------------------
 * Long-running process for parts of Alice that DO NOT work on
 * Vercel serverless:
 *   - WhatsApp (Baileys WebSocket sessions)
 *   - Bull message-processing queue
 *   - Appointment reminder scheduler
 *
 * Run with: `node src/worker.js`
 * Deploy target: Render / Railway / Fly.io / VPS — anywhere with
 * a persistent Node process.
 *
 * On Vercel, this file is NEVER executed; the serverless
 * `api/index.js` exposes only the HTTP API.
 */

require('dotenv').config();

if (process.env.VERCEL === '1' || process.env.VERCEL === 'true') {
  console.error('[Worker] Refusing to start: VERCEL env detected. Worker should not run in serverless.');
  process.exit(1);
}

const { logger } = require('./api/middleware/logging');

logger.info('🚀 Alice worker starting up...');

// 1. Auto-connect all saved WhatsApp sessions
try {
  const whatsappService = require('./services/whatsappService');
  whatsappService.initAllSessions();
  logger.info('[Worker] WhatsApp sessions initialized');
} catch (err) {
  console.error('[Worker] WhatsApp init failed:', err.message);
}

// 2. Register Bull queue workers (process any pending jobs)
try {
  // Importing the queue registers the worker if defined there.
  const messageQueue = require('./queue/messageQueue');

  messageQueue.process(async (job) => {
    const { conversationId, content, workspaceId, recipientPhone, channel } = job.data;
    const aiService = require('./services/aiService');
    const { supabase } = require('./config/database');
    const connectorService = require('./services/connectorService');

    logger.info(`[Worker] Processing job ${job.id} for conversation ${conversationId}`);

    const { data: conversation } = await supabase
      .from('conversations')
      .select('*, customers(*)')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      logger.warn(`[Worker] Conversation ${conversationId} not found`);
      return;
    }

    const aiResult = await aiService.processIncomingMessage(content, workspaceId, conversationId, {
      id: conversation.customers?.id,
      name: conversation.customers?.name,
      phone: conversation.customers?.whatsapp || conversation.customers?.phone
    });

    const { data: dbReply, error: dbReplyError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'ai',
        content: aiResult.reply,
        intent: aiResult.intent,
        sentiment: aiResult.sentiment,
        entities: aiResult.entities
      })
      .select()
      .single();

    if (dbReplyError) {
      logger.error(`[Worker] Failed to persist AI reply: ${dbReplyError.message}`);
      throw dbReplyError;
    }

    if (recipientPhone) {
      if (channel === 'whatsapp') {
        const sent = await require('./services/whatsappService')
          .sendMessageJid(workspaceId, recipientPhone, aiResult.reply);
        if (!sent) {
          await connectorService.sendMessage(recipientPhone, aiResult.reply, channel);
        }
      } else if (channel === 'instagram') {
        await connectorService.sendMessage(recipientPhone, aiResult.reply, channel);
      }
    }

    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date(),
        sentiment_score: aiResult.sentiment
      })
      .eq('id', conversationId);

    logger.info(`[Worker] ✅ Job ${job.id} done for conversation ${conversationId}`);
  });

  logger.info('[Worker] Message queue worker registered');
} catch (err) {
  console.error('[Worker] Queue registration failed:', err.message);
}

// 3. Start the appointment reminder scheduler
try {
  const reminderService = require('./services/reminderService');
  reminderService.startScheduler(60000); // check every 1 minute
  logger.info('[Worker] Reminder scheduler started (60s interval)');
} catch (err) {
  console.error('[Worker] Reminder scheduler failed:', err.message);
}

// 4. Graceful shutdown
const shutdown = (signal) => {
  logger.info(`[Worker] Received ${signal}, shutting down...`);
  try {
    const { redisClient } = require('./config/redis');
    redisClient.quit().catch(() => {});
  } catch {}
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

logger.info('✅ Alice worker ready and running');
