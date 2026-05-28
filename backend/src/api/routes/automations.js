const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../../config/database');
const { validate } = require('../middleware/validation');
const { z } = require('zod');

const automationSchema = z.object({
  name: z.string().min(1, 'Automation name is required'),
  trigger_event: z.string().min(1, 'Trigger event is required'),
  conditions: z.record(z.any()).optional().nullable(),
  actions: z.array(z.record(z.any())).min(1, 'At least one action is required'),
  is_active: z.boolean().default(true)
});

/**
 * GET /api/automations
 * List automations
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { data: automations, error } = await supabase
      .from('automations')
      .select('*')
      .eq('workspace_id', req.workspaceId);

    if (error) throw error;
    res.json(automations);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/automations
 * Create automation
 */
router.post('/', requireAuth, validate(automationSchema), async (req, res, next) => {
  try {
    const { name, trigger_event, conditions, actions, is_active } = req.body;

    const { data: automation, error } = await supabase
      .from('automations')
      .insert({
        workspace_id: req.workspaceId,
        name,
        trigger_event,
        conditions: conditions || {},
        actions,
        is_active
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(automation);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/automations/:id
 * Update automation flow
 */
router.put('/:id', requireAuth, validate(automationSchema.partial()), async (req, res, next) => {
  try {
    const updatePayload = {};
    if (req.body.name !== undefined) updatePayload.name = req.body.name;
    if (req.body.trigger_event !== undefined) updatePayload.trigger_event = req.body.trigger_event;
    if (req.body.conditions !== undefined) updatePayload.conditions = req.body.conditions;
    if (req.body.actions !== undefined) updatePayload.actions = req.body.actions;
    if (req.body.is_active !== undefined) updatePayload.is_active = req.body.is_active;

    const { data: automation, error } = await supabase
      .from('automations')
      .update(updatePayload)
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId)
      .select()
      .single();

    if (error || !automation) {
      return res.status(404).json({ error: 'Automation not found or access denied' });
    }

    res.json(automation);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/automations/:id
 * Remove automation record
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('automations')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId);

    if (error) throw error;
    res.json({ success: true, message: 'Automation deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
