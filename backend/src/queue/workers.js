const { messageQueue } = require('./messageQueue');
const aiService = require('../services/aiService');
const connectorService = require('../services/connectorService');
const { supabase } = require('../config/database');

// Define worker processing logic
messageQueue.process(async (job) => {
  const { conversationId, content, workspaceId, recipientPhone, channel } = job.data;
  console.log(`[Queue Worker] Processing inbound msg job for conversation: ${conversationId}`);

  try {
    // 1. Fetch AI prediction
    const aiResult = await aiService.processIncomingMessage(content, workspaceId, conversationId);

    // 2. Write AI Reply to Supabase database
    const { data: dbReply, error: dbError } = await supabase
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

    if (dbError) throw dbError;

    // 3. Dispatch AI response back to the customer channel via Meta Graph API
    if (recipientPhone) {
      await connectorService.sendMessage(recipientPhone, aiResult.reply, channel);
    }

    // 4. Update parent conversation with last_message_at and intent/sentiment metadata
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date(),
        sentiment_score: aiResult.sentiment
      })
      .eq('id', conversationId);

    console.log(`[Queue Worker] AI Reply generated and sent successfully for conversation: ${conversationId}`);
    return { success: true, replyId: dbReply.id };
  } catch (error) {
    console.error(`[Queue Worker Error] Job #${job.id} failed:`, error);
    throw error;
  }
});

console.log('[Queue Workers] Background message queue processor is active');
