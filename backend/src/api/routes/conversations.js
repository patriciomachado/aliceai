const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../../config/database');

/**
 * GET /api/conversations
 * Lists all threads active or closed for the active workspace
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status, assigned_to } = req.query;
    let query = supabase
      .from('conversations')
      .select('*, customers(*), assigned_to(*)')
      .eq('workspace_id', req.workspaceId)
      .order('last_message_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (assigned_to) {
      query = query.eq('assigned_to', assigned_to);
    }

    const { data: conversations, error } = await query;
    if (error) throw error;

    res.json(conversations);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/conversations/:id
 * Fetch detailed metrics for a single thread
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('*, customers(*), assigned_to(*)')
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId)
      .single();

    if (error || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/conversations/:id/status
 * Updates status toggles (active, closed, archived) or updates operator assignment
 */
router.put('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { status, assigned_to, is_ai_disabled } = req.body;
    const updatePayload = {};

    if (status) updatePayload.status = status;
    if (assigned_to !== undefined) updatePayload.assigned_to = assigned_to;

    let updatedConversation;

    if (Object.keys(updatePayload).length > 0) {
      const { data, error } = await supabase
        .from('conversations')
        .update(updatePayload)
        .eq('id', req.params.id)
        .eq('workspace_id', req.workspaceId)
        .select('*, customers(*), assigned_to(*)')
        .single();

      if (error) throw error;
      updatedConversation = data;
    } else {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, customers(*), assigned_to(*)')
        .eq('id', req.params.id)
        .eq('workspace_id', req.workspaceId)
        .single();

      if (error) throw error;
      updatedConversation = data;
    }

    if (!updatedConversation) {
      return res.status(404).json({ error: 'Conversation not found or access denied' });
    }

    if (is_ai_disabled !== undefined && updatedConversation.customers?.id) {
      const currentMetadata = updatedConversation.customers.metadata || {};
      const updatedMetadata = { ...currentMetadata, is_ai_disabled };

      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .update({ metadata: updatedMetadata })
        .eq('id', updatedConversation.customers.id)
        .select()
        .single();

      if (custErr) throw custErr;
      updatedConversation.customers = customer;
    }

    res.json(updatedConversation);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/conversations/:id
 * Deletes a conversation thread and all its messages (cascading)
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Delete associated messages
    const { error: msgDelError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', id);

    if (msgDelError) throw msgDelError;

    // 2. Delete the conversation
    const { error: convDelError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('workspace_id', req.workspaceId);

    if (convDelError) throw convDelError;

    res.json({ success: true, message: 'Conversation deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
