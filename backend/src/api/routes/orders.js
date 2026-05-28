const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../../config/database');
const paymentService = require('../../services/paymentService');
const { validate } = require('../middleware/validation');
const { z } = require('zod');

const orderSchema = z.object({
  customer_id: z.string().uuid('Invalid customer id'),
  items: z.array(z.object({
    product_id: z.string().uuid('Invalid product id'),
    quantity: z.number().positive('Quantity must be greater than zero'),
    metadata: z.any().optional()
  })).min(1, 'Order must contain at least one item'),
  payment_method: z.enum(['credit_card', 'pix', 'boleto', 'whatsapp_pay']).default('credit_card')
});

/**
 * GET /api/orders
 * List orders
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = supabase
      .from('orders')
      .select('*, customers(*), order_items(*, products(*))')
      .eq('workspace_id', req.workspaceId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    res.json(orders);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/:id
 * Retrieve order details with nested sub-items
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, customers(*), order_items(*, products(*))')
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/orders
 * Create order and initialize Stripe checkout pipeline link
 */
router.post('/', requireAuth, validate(orderSchema), async (req, res, next) => {
  try {
    const { customer_id, items, payment_method } = req.body;

    // 1. Fetch products price list to ensure safety
    const productIds = items.map(i => i.product_id);
    const { data: products } = await supabase
      .from('products')
      .select('id, price, stock')
      .in('id', productIds)
      .eq('workspace_id', req.workspaceId);

    if (!products || products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products not found' });
    }

    let totalAmount = 0;
    const orderItemsPayload = items.map(item => {
      const prod = products.find(p => p.id === item.product_id);
      const subtotal = Number(prod.price) * item.quantity;
      totalAmount += subtotal;
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: prod.price,
        subtotal,
        metadata: item.metadata || {}
      };
    });

    // 2. Save order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        workspace_id: req.workspaceId,
        customer_id,
        total_amount: totalAmount,
        payment_method,
        status: 'pending',
        payment_status: 'pending'
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // 3. Save order junctions
    const finalItems = orderItemsPayload.map(oi => ({ ...oi, order_id: order.id }));
    const { error: itemsError } = await supabase.from('order_items').insert(finalItems);
    if (itemsError) throw itemsError;

    // 4. Fetch customer details to compile Stripe link and trigger automations
    const { data: customer } = await supabase
      .from('customers')
      .select('id, email, name, phone')
      .eq('id', customer_id)
      .single();

    // 5. Build Checkout pipeline link
    const successUrl = `${req.headers.origin || process.env.FRONTEND_URL}/orders/${order.id}/success`;
    const cancelUrl = `${req.headers.origin || process.env.FRONTEND_URL}/orders/${order.id}/cancel`;
    const stripeSession = await paymentService.createCheckoutSession(
      order.id,
      totalAmount,
      customer?.email || 'customer@alice.ai',
      successUrl,
      cancelUrl
    );

    // Trigger background automation workflow
    try {
      const automationService = require('../../services/automationService');
      automationService.trigger('order_created', {
        order,
        customer
      }, req.workspaceId);
    } catch (autoErr) {
      console.error('[Orders Route] Automation trigger error:', autoErr.message);
    }

    res.status(201).json({
      order,
      stripeSessionId: stripeSession.id,
      paymentUrl: stripeSession.url
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/orders/:id/status
 * Update order tracking status manually
 */
router.put('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { status, payment_status } = req.body;
    const updatePayload = {};

    if (status) updatePayload.status = status;
    if (payment_status) updatePayload.payment_status = payment_status;

    const { data: order, error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId)
      .select()
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Order not found or access denied' });
    }

    // Trigger background automation workflow for completed orders
    if (payment_status === 'completed' || status === 'completed') {
      try {
        const { data: customer } = await supabase
          .from('customers')
          .select('id, email, name, phone')
          .eq('id', order.customer_id)
          .single();

        const automationService = require('../../services/automationService');
        automationService.trigger('orders.completed', {
          order,
          customer
        }, req.workspaceId);
      } catch (autoErr) {
        console.error('[Orders Route] Automation completed status trigger error:', autoErr.message);
      }
    }

    // Trigger ready notification for shipped status ("pedido pronto")
    if (status === 'shipped') {
      try {
        const { data: customer } = await supabase
          .from('customers')
          .select('id, name, phone, whatsapp')
          .eq('id', order.customer_id)
          .single();

        if (customer) {
          const customerName = customer.name || 'Cliente';
          const phone = customer.phone || customer.whatsapp;
          if (phone) {
            const cleanedPhone = phone.replace(/\D/g, '');
            if (cleanedPhone) {
              const orderIdShort = order.id.slice(-6).toUpperCase();
              const message = `Olá, *${customerName}*! Boas notícias: o seu pedido *#${orderIdShort}* está *PRONTO* para retirada/entrega! 🎉`;
              
              console.log(`[Orders Route] Sending order ready notification to ${customerName} (${cleanedPhone})...`);
              
              let success = false;
              try {
                const whatsappService = require('../../services/whatsappService');
                if (whatsappService && typeof whatsappService.sendMessageJid === 'function') {
                  success = await whatsappService.sendMessageJid(req.workspaceId, cleanedPhone, message);
                }
              } catch (wsErr) {
                console.warn('[Orders Route] WhatsApp Web Socket offline/not connected:', wsErr.message);
              }

              if (success) {
                console.log(`[Orders Route] Order ready notification sent successfully via Web Socket to ${cleanedPhone}.`);
              } else {
                console.log('[Orders Route] Web Socket offline. Routing ready notification via Meta Graph API...');
                try {
                  const connectorService = require('../../services/connectorService');
                  if (connectorService && typeof connectorService.sendMessage === 'function') {
                    await connectorService.sendMessage(cleanedPhone, message, 'whatsapp');
                    console.log('[Orders Route] Ready notification successfully routed via Meta Graph API.');
                  }
                } catch (connErr) {
                  console.error('[Orders Route] Meta Graph API fallback failed:', connErr.message);
                }
              }
            }
          }
        }
      } catch (autoErr) {
        console.error('[Orders Route] Shipped ready notification error:', autoErr.message);
      }
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/orders/:id
 * Delete order from system
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    // Delete order items first due to foreign key constraints
    await supabase
      .from('order_items')
      .delete()
      .eq('order_id', req.params.id);

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId);

    if (error) throw error;

    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
