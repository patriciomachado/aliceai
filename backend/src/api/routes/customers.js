const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../../config/database');
const { validate } = require('../middleware/validation');
const { z } = require('zod');

// Zod schemas for input validation
const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  instagram_handle: z.string().optional().nullable(),
  tags: z.array(z.string()).optional()
});

/**
 * GET /api/customers
 * List all workspace customers with optional filters
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { search, tag } = req.query;
    let query = supabase
      .from('customers')
      .select('*')
      .eq('workspace_id', req.workspaceId);

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: customers, error } = await query;
    if (error) throw error;

    // Filter by tag in memory if supplied
    let result = customers;
    if (tag) {
      result = customers.filter(c => {
        const parsedTags = Array.isArray(c.tags) ? c.tags : JSON.parse(c.tags || '[]');
        return parsedTags.includes(tag);
      });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/customers/:id
 * Retrieve single customer details
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId)
      .single();

    if (error || !customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/customers
 * Create a new customer
 */
router.post('/', requireAuth, validate(customerSchema), async (req, res, next) => {
  try {
    const { name, email, phone, whatsapp, instagram_handle, tags } = req.body;

    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        workspace_id: req.workspaceId,
        name,
        email,
        phone,
        whatsapp,
        instagram_handle,
        tags: tags || []
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/customers/:id
 * Update customer properties
 */
router.put('/:id', requireAuth, validate(customerSchema), async (req, res, next) => {
  try {
    const { name, email, phone, whatsapp, instagram_handle, tags } = req.body;

    const { data: customer, error } = await supabase
      .from('customers')
      .update({
        name,
        email,
        phone,
        whatsapp,
        instagram_handle,
        tags
      })
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId)
      .select()
      .single();

    if (error || !customer) {
      return res.status(404).json({ error: 'Customer not found or access denied' });
    }

    res.json(customer);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/customers/:id
 * Remove a customer record
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId);

    if (error) throw error;
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
