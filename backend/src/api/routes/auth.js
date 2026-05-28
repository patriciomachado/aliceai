const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../../config/database');

/**
 * GET /api/auth/me
 * Retrieves current database profile details matching Clerk ID
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*, workspaces(*)')
      .eq('clerk_id', req.user.clerk_id)
      .single();

    if (error || !user) {
      // Create a brand new, empty, unique workspace for the new company/user
      const { data: newWp, error: wpError } = await supabase
        .from('workspaces')
        .insert({
          name: `${req.user.name || 'Nova Empresa'}'s Workspace`,
          slug: `workspace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          settings: {
            modules: {
              orders: true,
              services: true,
              products: true,
              appointments: true
            },
            widget_color: '#6366F1',
            widget_enabled: true,
            widget_greeting: 'Olá! Sou seu assistente virtual. Como posso ajudar você hoje?',
            system_instruction: 'Você é um assistente virtual inteligente criado para ajudar os clientes.'
          }
        })
        .select()
        .single();

      if (wpError) throw wpError;
      const workspaceId = newWp.id;

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          clerk_id: req.user.clerk_id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role,
          workspace_id: workspaceId
        })
        .select('*, workspaces(*)')
        .single();

      if (createError) throw createError;
      return res.json(newUser);
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/callback/clerk
 * Webhook endpoint for direct sync events triggered by Clerk system
 */
router.post('/callback/clerk', async (req, res, next) => {
  try {
    const { type, data } = req.body;

    if (type === 'user.created' || type === 'user.updated') {
      const email = data.email_addresses[0]?.email_address;
      const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'User';
      const clerkId = data.id;

      // Check if user already exists in DB to preserve their workspace
      const { data: existingUser } = await supabase
        .from('users')
        .select('workspace_id')
        .eq('clerk_id', clerkId)
        .maybeSingle();

      let workspaceId;
      if (existingUser) {
        workspaceId = existingUser.workspace_id;
      } else {
        // Create a brand new, empty, unique workspace for the new user/company
        const { data: newWp, error: wpError } = await supabase
          .from('workspaces')
          .insert({
            name: `${name}'s Workspace`,
            slug: `workspace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            settings: {
              modules: {
                orders: true,
                services: true,
                products: true,
                appointments: true
              },
              widget_color: '#6366F1',
              widget_enabled: true,
              widget_greeting: 'Olá! Sou seu assistente virtual. Como posso ajudar você hoje?',
              system_instruction: 'Você é um assistente virtual inteligente criado para ajudar os clientes.'
            }
          })
          .select()
          .single();

        if (wpError) throw wpError;
        workspaceId = newWp.id;
      }

      const { error } = await supabase
        .from('users')
        .upsert({
          clerk_id: clerkId,
          email,
          name,
          workspace_id: workspaceId,
          role: 'agent',
          avatar_url: data.image_url
        }, { onConflict: 'clerk_id' });

      if (error) throw error;
    }

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/auth/workspace
 * Updates settings and configuration metadata of the active user's workspace
 */
router.put('/workspace', requireAuth, async (req, res, next) => {
  try {
    const { name, settings } = req.body;
    const updatePayload = {};
    if (name) updatePayload.name = name;
    if (settings) updatePayload.settings = settings;

    const { data: updatedWp, error } = await supabase
      .from('workspaces')
      .update(updatePayload)
      .eq('id', req.workspaceId)
      .select()
      .single();

    if (error) throw error;
    res.json(updatedWp);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Standard logout stub
 */
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
