const express = require('express');
const router = express.Router();
const config = require('../../config/integrations');
const { messageQueue } = require('../../queue/messageQueue');
const { supabase } = require('../../config/database');

/**
 * GET /api/webhooks/meta
 * Facebook challenge verification callback endpoint
 */
router.get('/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === config.meta.verifyToken) {
      console.log('[Meta Webhook] Successfully verified verification token.');
      return res.status(200).send(challenge);
    }
  }
  res.status(403).send('Forbidden');
});

/**
 * POST /api/webhooks/meta
 * Processes Meta Graph webhook payloads for WhatsApp / Instagram
 */
router.post('/meta', async (req, res, next) => {
  try {
    const payload = req.body;
    console.log('[Meta Webhook] Payload received:', JSON.stringify(payload));

    // Handle standard WhatsApp structures
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];

    if (message) {
      const customerPhone = message.from;
      const content = message.text?.body || '';

      // 1. Resolve workspace id (Lookup configuration key matching webhook sender)
      const { data: defaultWp } = await supabase.from('workspaces').select('id').limit(1);
      const workspaceId = defaultWp?.[0]?.id || '11111111-1111-1111-1111-111111111111';

      // 2. Resolve customer profile from CRM registry or provision a new one
      let { data: customer } = await supabase
        .from('customers')
        .select('id, metadata')
        .eq('whatsapp', customerPhone)
        .single();

      if (!customer) {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({
            workspace_id: workspaceId,
            name: `Whatsapp User ${customerPhone.slice(-4)}`,
            whatsapp: customerPhone,
            phone: customerPhone,
            metadata: {}
          })
          .select()
          .single();
        customer = newCustomer;
      }

      // 3. Find active conversation thread or open a new thread
      let { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('status', 'active')
        .single();

      if (!conversation) {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            workspace_id: workspaceId,
            customer_id: customer.id,
            channel: 'whatsapp',
            status: 'active'
          })
          .select()
          .single();
        conversation = newConv;
      }

      // 4. Save Inbound Message
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_type: 'customer',
          content
        });

      // Check if AI is permanently disabled or paused for this customer
      const customerMetadata = customer.metadata || {};
      const isAiDisabled = customerMetadata.is_ai_disabled === true;
      const isAiPaused = customerMetadata.ai_paused_until && new Date(customerMetadata.ai_paused_until) > new Date();

      if (isAiDisabled || isAiPaused) {
        console.log(`[Meta Webhook] Skipping AI reply for customer [${customerPhone}] because AI is ${isAiDisabled ? 'permanently disabled' : 'paused'}.`);
        res.status(200).json({ received: true });
        return;
      }

      // 5. Add Background Task to Message Queue to let AI Respond
      try {
        await messageQueue.add({
          conversationId: conversation.id,
          content,
          workspaceId,
          recipientPhone: customerPhone,
          channel: 'whatsapp'
        });
      } catch (queueError) {
        console.warn('[Meta Webhook] Redis/Queue not available, falling back to direct asynchronous processing:', queueError.message);
        
        // Fallback: Run worker logic directly in a non-blocking asynchronous execution thread
        const aiService = require('../../services/aiService');
        const connectorService = require('../../services/connectorService');
        
        (async () => {
          try {
            console.log(`[Meta Webhook Fallback] Direct processing AI reply for conversation: ${conversation.id}`);
            const aiResult = await aiService.processIncomingMessage(content, workspaceId);
            
            const { data: dbReply, error: dbError } = await supabase
              .from('messages')
              .insert({
                conversation_id: conversation.id,
                sender_type: 'ai',
                content: aiResult.reply,
                intent: aiResult.intent,
                sentiment: aiResult.sentiment,
                entities: aiResult.entities
              })
              .select()
              .single();
              
            if (dbError) throw dbError;
            
            if (customerPhone) {
              await connectorService.sendMessage(customerPhone, aiResult.reply, 'whatsapp');
            }
            
            await supabase
              .from('conversations')
              .update({
                last_message_at: new Date(),
                sentiment_score: aiResult.sentiment
              })
              .eq('id', conversation.id);
              
            console.log(`[Meta Webhook Fallback] AI Reply generated and sent successfully for conversation: ${conversation.id}`);
          } catch (fallbackError) {
            console.error('[Meta Webhook Fallback Error] Failed to generate AI reply:', fallbackError);
          }
        })();
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/webhooks/stripe
 * Stripe webhook receiver to record payments
 */
router.post('/stripe', async (req, res, next) => {
  try {
    const event = req.body;
    console.log('[Stripe Webhook] Event received:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;

      if (orderId) {
        // Update database order state
        const { error } = await supabase
          .from('orders')
          .update({
            payment_status: 'completed',
            status: 'confirmed'
          })
          .eq('id', orderId);

        if (error) throw error;
        console.log(`[Stripe Webhook] Order #${orderId} set to completed.`);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
