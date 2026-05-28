const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../../config/database');
const { validate } = require('../middleware/validation');
const { z } = require('zod');

const serviceSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  description: z.string().optional().nullable(),
  price: z.number().positive('Price must be greater than zero'),
  duration_minutes: z.number().int().positive().default(60),
  category: z.string().optional().nullable(),
  is_active: z.boolean().default(true)
});

/**
 * GET /api/services
 * Fetch services list
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { category, search } = req.query;
    let query = supabase
      .from('services')
      .select('*')
      .eq('workspace_id', req.workspaceId);

    if (category) {
      query = query.eq('category', category);
    }
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: services, error } = await query;
    if (error) throw error;

    res.json(services);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/services/:id
 * Retrieve service details
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data: service, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId)
      .single();

    if (error || !service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json(service);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/services
 * Create service item
 */
router.post('/', requireAuth, validate(serviceSchema), async (req, res, next) => {
  try {
    const { name, description, price, duration_minutes, category, is_active } = req.body;

    const { data: service, error } = await supabase
      .from('services')
      .insert({
        workspace_id: req.workspaceId,
        name,
        description,
        price,
        duration_minutes,
        category,
        is_active
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(service);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/services/:id
 * Update service specifications
 */
router.put('/:id', requireAuth, validate(serviceSchema), async (req, res, next) => {
  try {
    const { name, description, price, duration_minutes, category, is_active } = req.body;

    const { data: service, error } = await supabase
      .from('services')
      .update({
        name,
        description,
        price,
        duration_minutes,
        category,
        is_active
      })
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId)
      .select()
      .single();

    if (error || !service) {
      return res.status(404).json({ error: 'Service not found or access denied' });
    }

    res.json(service);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/services/:id
 * Delete service from catalog
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId);

    if (error) throw error;
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
