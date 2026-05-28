const { supabase } = require('../config/database');

/**
 * Recalculate lifetime spend value for a specific customer in workspace
 */
const updateCustomerLifetimeValue = async (customerId, workspaceId) => {
  try {
    // 1. Sum up all completed payment orders
    const { data: orders, error } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('customer_id', customerId)
      .eq('workspace_id', workspaceId)
      .eq('payment_status', 'completed');

    if (error) throw error;

    const lifetimeValue = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);

    // 2. Write value back to customer record
    await supabase
      .from('customers')
      .update({ lifetime_value: lifetimeValue })
      .eq('id', customerId)
      .eq('workspace_id', workspaceId);

    return lifetimeValue;
  } catch (error) {
    console.error('CRM Service Error (update LTV):', error);
    return 0;
  }
};

/**
 * Appends interactive customer tagging groups
 */
const appendCustomerTags = async (customerId, workspaceId, newTags = []) => {
  try {
    const { data: customer } = await supabase
      .from('customers')
      .select('tags')
      .eq('id', customerId)
      .eq('workspace_id', workspaceId)
      .single();

    let currentTags = [];
    if (customer && customer.tags) {
      currentTags = Array.isArray(customer.tags) ? customer.tags : JSON.parse(customer.tags);
    }

    const uniqueTags = Array.from(new Set([...currentTags, ...newTags]));

    await supabase
      .from('customers')
      .update({ tags: JSON.stringify(uniqueTags) })
      .eq('id', customerId)
      .eq('workspace_id', workspaceId);

    return uniqueTags;
  } catch (error) {
    console.error('CRM Service Error (append tags):', error);
    return newTags;
  }
};

module.exports = {
  updateCustomerLifetimeValue,
  appendCustomerTags
};
