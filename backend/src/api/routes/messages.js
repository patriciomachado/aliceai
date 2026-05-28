const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../../config/database');
const { messageQueue } = require('../../queue/messageQueue');
const connectorService = require('../../services/connectorService');
const { validate } = require('../middleware/validation');
const { z } = require('zod');

const sendMsgSchema = z.object({
  content: z.string().min(1, 'Message content cannot be blank'),
  sender_type: z.enum(['customer', 'agent', 'ai']).default('agent'),
  recipient_phone: z.string().optional()
});

/**
 * GET /api/conversations/:id/messages
 * Retrieves historical logs of a conversation
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    // 1. Verify access to conversation first
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId)
      .single();

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation thread not found' });
    }

    // 2. Load historical logs
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(messages);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/conversations/:id/messages
 * Dispatches a new chat message entry.
 * Triggering AI answers for inbound customer entries asynchronously via Bull queues.
 */
router.post('/', requireAuth, validate(sendMsgSchema), async (req, res, next) => {
  try {
    const { content, sender_type, recipient_phone } = req.body;
    const conversationId = req.params.id;

    // 1. Verify parent thread
    const { data: conversation } = await supabase
      .from('conversations')
      .select('*, customers(*)')
      .eq('id', conversationId)
      .eq('workspace_id', req.workspaceId)
      .single();

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation thread not found' });
    }

    // 2. Save physical message to database
    const { data: dbMsg, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_type,
        sender_id: sender_type === 'agent' ? req.user.id : undefined,
        content
      })
      .select()
      .single();

    if (error) throw error;

    // 3. Handle outbound delivery logic
    if (sender_type === 'agent') {
      // Manual operator reply -> dispatch via channels (WhatsApp/Instagram)
      const channel = conversation.channel;
      const targetPhone = recipient_phone || conversation.customers?.whatsapp || conversation.customers?.phone;

      if (targetPhone && (channel === 'whatsapp' || channel === 'instagram')) {
        await connectorService.sendMessage(targetPhone, content, channel);
      }

      // Pause the AI when a manual message is sent from the web app
      let pauseDuration = 30; // default 30 minutes
      try {
        const { data: wp } = await supabase
          .from('workspaces')
          .select('settings')
          .eq('id', req.workspaceId)
          .single();
          
        if (wp?.settings?.agent_takeover_pause_duration !== undefined) {
          pauseDuration = parseInt(wp.settings.agent_takeover_pause_duration, 10);
        }
      } catch (wpErr) {
        console.error('[Messages API] Error fetching workspace pause settings:', wpErr);
      }

      const pausedUntil = new Date(Date.now() + pauseDuration * 60 * 1000);
      console.log(`[Messages API] Pausing AI for conversation ${conversationId} until ${pausedUntil.toISOString()} due to manual agent reply from web panel.`);
      
      // Update customer metadata
      if (conversation.customers?.id) {
        const currentMetadata = conversation.customers.metadata || {};
        const updatedMetadata = { ...currentMetadata, ai_paused_until: pausedUntil.toISOString() };
        await supabase
          .from('customers')
          .update({
            metadata: updatedMetadata
          })
          .eq('id', conversation.customers.id);
      }

      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date()
        })
        .eq('id', conversationId);

    } else if (sender_type === 'customer') {
      const customerMetadata = conversation.customers?.metadata || {};
      
      // Note: This endpoint (POST /api/conversations/:id/messages with requireAuth) is only invoked
      // from the dashboard UI (e.g., "Simular Resposta de IA"). We bypass AI disabled/paused status 
      // check to ensure developer simulations are always functional for testing.
      if (customerMetadata.is_ai_disabled === true) {
        console.log(`[Messages API] Dashboard Simulation: Bypassing permanent AI disablement check for testing.`);
      }

      if (customerMetadata.ai_paused_until && new Date(customerMetadata.ai_paused_until) > new Date()) {
        console.log(`[Messages API] Dashboard Simulation: Bypassing human takeover pause (${customerMetadata.ai_paused_until}) for testing.`);
      }

      // Incoming customer webhook simulation -> Queue background worker processing for GPT reply
      const recipientPhone = conversation.customers?.whatsapp || conversation.customers?.phone;
      try {
        await messageQueue.add({
          conversationId,
          content,
          workspaceId: req.workspaceId,
          recipientPhone,
          channel: conversation.channel
        });
      } catch (queueError) {
        console.warn('[Messages API] Redis/Queue not available, falling back to direct asynchronous processing:', queueError.message);
        
        const aiService = require('../../services/aiService');
        (async () => {
          try {
            console.log(`[Messages API Fallback] Direct processing AI reply for conversation: ${conversationId}`);
            const aiResult = await aiService.processIncomingMessage(content, req.workspaceId, conversationId, {
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
              
            if (dbReplyError) throw dbReplyError;
            
            if (recipientPhone && (conversation.channel === 'whatsapp' || conversation.channel === 'instagram')) {
              await connectorService.sendMessage(recipientPhone, aiResult.reply, conversation.channel);
            }
            
            await supabase
              .from('conversations')
              .update({
                last_message_at: new Date(),
                sentiment_score: aiResult.sentiment
              })
              .eq('id', conversationId);
              
            console.log(`[Messages API Fallback] AI Reply generated and sent successfully for conversation: ${conversationId}`);
          } catch (fallbackError) {
            console.error('[Messages API Fallback Error] Failed to generate AI reply:', fallbackError);
          }
        })();
      }
    }

    res.status(201).json(dbMsg);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
