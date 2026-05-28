const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../../config/database');
const { validate } = require('../middleware/validation');
const { z } = require('zod');

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional().nullable(),
  price: z.number().positive('Price must be greater than zero'),
  stock: z.number().int().nonnegative().default(0),
  category: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable()
});

/**
 * GET /api/products
 * Fetch products list
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { category, search } = req.query;
    let query = supabase
      .from('products')
      .select('*')
      .eq('workspace_id', req.workspaceId);

    if (category) {
      query = query.eq('category', category);
    }
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: products, error } = await query;
    if (error) throw error;

    res.json(products);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/:id
 * Retrieve product details
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId)
      .single();

    if (error || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/products
 * Create product item
 */
router.post('/', requireAuth, validate(productSchema), async (req, res, next) => {
  try {
    const { name, description, price, stock, category, sku, image_url } = req.body;

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        workspace_id: req.workspaceId,
        name,
        description,
        price,
        stock,
        category,
        sku: sku || `sku-${Date.now()}`,
        image_url
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/products/:id
 * Update product specifications
 */
router.put('/:id', requireAuth, validate(productSchema), async (req, res, next) => {
  try {
    const { name, description, price, stock, category, sku, image_url } = req.body;

    const { data: product, error } = await supabase
      .from('products')
      .update({
        name,
        description,
        price,
        stock,
        category,
        sku,
        image_url
      })
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId)
      .select()
      .single();

    if (error || !product) {
      return res.status(404).json({ error: 'Product not found or access denied' });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/products/:id
 * Delete product from catalog
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId);

    if (error) throw error;
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
