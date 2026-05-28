const { supabase } = require('../config/database');
const axios = require('axios');

/**
 * Normalizes trigger events to support both english and portuguese event naming aliases.
 */
const EVENT_ALIASES = {
  'messages.incoming': ['messages.incoming', 'new_message'],
  'new_message': ['messages.incoming', 'new_message'],
  'orders.created': ['orders.created', 'order_created'],
  'order_created': ['orders.created', 'order_created'],
  'orders.completed': ['orders.completed', 'order_completed'],
  'order_completed': ['orders.completed', 'order_completed'],
  'appointments.created': ['appointments.created', 'appointment_booked'],
  'appointment_booked': ['appointments.created', 'appointment_booked']
};

/**
 * Resolves nested or flat properties from target payload.
 */
const resolvePayloadValue = (key, payload) => {
  if (!payload) return undefined;
  if (payload[key] !== undefined) return payload[key];
  
  // Search common sub-objects
  for (const sub of ['message', 'customer', 'order', 'appointment']) {
    if (payload[sub] && payload[sub][key] !== undefined) {
      return payload[sub][key];
    }
  }
  
  // Handle nested dotted lookups (e.g. customer.name)
  if (key.includes('.')) {
    const parts = key.split('.');
    let current = payload;
    for (const part of parts) {
      if (current && current[part] !== undefined) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  return undefined;
};

/**
 * Compares payload against defined conditions.
 */
const evaluateConditions = (conditions, payload) => {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  for (const [key, expectedValue] of Object.entries(conditions)) {
    const actualValue = resolvePayloadValue(key, payload);
    if (actualValue === undefined) {
      return false;
    }

    if (String(actualValue).toLowerCase().trim() !== String(expectedValue).toLowerCase().trim()) {
      return false;
    }
  }

  return true;
};

/**
 * Replaces double-curly braces {{variable}} in templates with values from the payload.
 */
const interpolateTemplate = (template, payload) => {
  if (!template) return '';
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    // Check key flatly, then subkeys, then nested dotted keys
    const val = resolvePayloadValue(key, payload);
    if (val !== undefined && val !== null) {
      return String(val);
    }
    
    // Map helpful aliases
    if (key === 'customer_name') return resolvePayloadValue('name', payload) || 'Cliente';
    if (key === 'customer_phone') return resolvePayloadValue('phone', payload) || '';
    if (key === 'total_amount') return resolvePayloadValue('total_amount', payload) || '0.00';
    if (key === 'scheduled_date') return resolvePayloadValue('scheduled_date', payload) || '';
    if (key === 'scheduled_time') return resolvePayloadValue('scheduled_time', payload) || '';
    if (key === 'service_type') return resolvePayloadValue('service_type', payload) || '';
    if (key === 'order_id') return resolvePayloadValue('id', payload) || '';
    
    return '';
  });
};

/**
 * GDPR/LGPD compliant masker to hide passwords, secret keys, or credit cards from webhooks.
 */
const maskSensitiveData = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'password_hash', 'api_key', 'authorization', 'auth', 'cred', 'cvv', 'card_number'];

  const sanitized = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) {
      sanitized[k] = '********';
    } else if (typeof v === 'object' && v !== null) {
      sanitized[k] = maskSensitiveData(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
};

class AutomationService {
  /**
   * Fires automation execution flow for an event.
   * @param {string} eventName Name of trigger event (e.g. messages.incoming)
   * @param {object} payload Context details of the event
   * @param {string} workspaceId Current workspace identifier
   */
  async trigger(eventName, payload, workspaceId) {
    if (!workspaceId) {
      console.warn('[Automation Service] Trigger aborted: workspaceId is missing.');
      return;
    }

    try {
      console.log(`[Automation Service] Received trigger event: "${eventName}" for workspace: ${workspaceId}`);

      // 1. Fetch active automations
      const { data: automations, error } = await supabase
        .from('automations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true);

      if (error) {
        console.error('[Automation Service] Failed to retrieve automations:', error.message);
        return;
      }

      if (!automations || automations.length === 0) {
        console.log('[Automation Service] No active automations found.');
        return;
      }

      // 2. Filter matching automations including trigger aliases
      const activeAliases = EVENT_ALIASES[eventName] || [eventName];
      const matchedAutomations = automations.filter(aut => activeAliases.includes(aut.trigger_event));

      console.log(`[Automation Service] Found ${matchedAutomations.length} matching automations for "${eventName}".`);

      for (const aut of matchedAutomations) {
        try {
          // 3. Evaluate conditions
          const conditionsMatch = evaluateConditions(aut.conditions, payload);
          if (!conditionsMatch) {
            console.log(`[Automation Service] Skip: "${aut.name}" (Conditions did not match).`);
            continue;
          }

          console.log(`[Automation Service] Executing automation flow: "${aut.name}" (ID: ${aut.id}).`);

          // 4. Run defined actions sequentially
          const actions = Array.isArray(aut.actions) ? aut.actions : [aut.actions];
          for (const action of actions) {
            await this.executeAction(action, payload, workspaceId);
          }

          // 5. Update audit log
          await supabase.from('audit_logs').insert({
            workspace_id: workspaceId,
            action: 'automation_dispatched',
            resource_type: 'automations',
            resource_id: aut.id,
            changes: { name: aut.name, trigger_event: aut.trigger_event }
          });

        } catch (autError) {
          console.error(`[Automation Service] Error running automation "${aut.name}":`, autError.message);
        }
      }

    } catch (err) {
      console.error('[Automation Service] Unexpected trigger crash:', err.message);
    }
  }

  /**
   * Action Router
   */
  async executeAction(action, payload, workspaceId) {
    const actionType = action.type;
    const params = action.params || {};

    console.log(`[Automation Service] Executing action: "${actionType}"`);

    switch (actionType) {
      case 'send_message':
      case 'send_whatsapp_message': {
        const textTemplate = params.text;
        if (!textTemplate) {
          console.warn('[Automation Service] Skip Send Message: "text" template is missing.');
          return;
        }

        const interpolatedText = interpolateTemplate(textTemplate, payload);
        
        // Find Jid/Phone number
        let phone = resolvePayloadValue('phone', payload) || resolvePayloadValue('whatsapp', payload);
        if (!phone && payload.customer) {
          phone = payload.customer.phone || payload.customer.whatsapp;
        }

        if (!phone) {
          console.warn('[Automation Service] Skip Send Message: Customer phone number could not be resolved.');
          return;
        }

        // Clean phone string
        const cleanedPhone = phone.replace(/\D/g, '');
        if (!cleanedPhone) {
          console.warn('[Automation Service] Skip Send Message: Empty resolved phone number.');
          return;
        }

        // Resilient send: Try WhatsApp socket first, then Meta Connector
        let success = false;
        try {
          const whatsappService = require('./whatsappService');
          if (whatsappService && typeof whatsappService.sendMessageJid === 'function') {
            success = await whatsappService.sendMessageJid(workspaceId, cleanedPhone, interpolatedText);
          }
        } catch (wsErr) {
          console.warn('[Automation Service] Failed loading whatsappService socket:', wsErr.message);
        }

        if (success) {
          console.log(`[Automation Service] Message sent successfully via WhatsApp Web Socket to ${cleanedPhone}.`);
        } else {
          console.log('[Automation Service] WhatsApp Socket offline or failed. Routing via Meta Graph API...');
          try {
            const connectorService = require('./connectorService');
            if (connectorService && typeof connectorService.sendMessage === 'function') {
              const res = await connectorService.sendMessage(cleanedPhone, interpolatedText, 'whatsapp');
              console.log('[Automation Service] Message routed via Meta Graph API:', res);
            } else {
              console.error('[Automation Service] Meta connectorService is unavailable.');
            }
          } catch (connErr) {
            console.error('[Automation Service] Failed to send via Meta Graph API:', connErr.message);
          }
        }
        break;
      }

      case 'trigger_webhook': {
        const url = params.url;
        if (!url) {
          console.warn('[Automation Service] Skip Webhook: "url" parameter is missing.');
          return;
        }

        // LGPD/GDPR sanitization/masking
        const sanitizedPayload = maskSensitiveData(payload);

        try {
          console.log(`[Automation Service] Triggering outbound HTTP POST Webhook: ${url}`);
          const response = await axios.post(url, {
            event_fired_at: new Date().toISOString(),
            workspace_id: workspaceId,
            payload: sanitizedPayload
          }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000 // 5 seconds timeout
          });
          console.log(`[Automation Service] Webhook response received (Status: ${response.status}).`);
        } catch (webErr) {
          console.error(`[Automation Service] Webhook trigger failed for URL "${url}":`, webErr.message);
        }
        break;
      }

      case 'add_customer_tag': {
        const tag = params.tag;
        if (!tag) {
          console.warn('[Automation Service] Skip Add Tag: "tag" parameter is missing.');
          return;
        }

        let customerId = resolvePayloadValue('customer_id', payload) || resolvePayloadValue('id', payload);
        if (!customerId && payload.customer) {
          customerId = payload.customer.id;
        }

        if (!customerId) {
          console.warn('[Automation Service] Skip Add Tag: Customer ID could not be resolved from payload.');
          return;
        }

        try {
          // Fetch customer
          const { data: customer, error: fetchErr } = await supabase
            .from('customers')
            .select('tags')
            .eq('id', customerId)
            .single();

          if (fetchErr || !customer) {
            console.warn('[Automation Service] Skip Add Tag: Customer record not found.');
            return;
          }

          let currentTags = [];
          if (Array.isArray(customer.tags)) {
            currentTags = customer.tags;
          } else if (typeof customer.tags === 'string') {
            try {
              currentTags = JSON.parse(customer.tags || '[]');
            } catch {
              currentTags = customer.tags ? [customer.tags] : [];
            }
          }

          // Push new tag if not duplicates
          const normalizedTag = tag.trim();
          if (!currentTags.includes(normalizedTag)) {
            currentTags.push(normalizedTag);
            
            const { error: updateErr } = await supabase
              .from('customers')
              .update({ tags: currentTags })
              .eq('id', customerId);

            if (updateErr) throw updateErr;
            console.log(`[Automation Service] Added tag "${normalizedTag}" to customer ID ${customerId}.`);
          } else {
            console.log(`[Automation Service] Tag "${normalizedTag}" already exists on customer ID ${customerId}.`);
          }

        } catch (dbErr) {
          console.error(`[Automation Service] Add tag Database Error:`, dbErr.message);
        }
        break;
      }

      default:
        console.warn(`[Automation Service] Unsupported automation action type: "${actionType}".`);
    }
  }
}

module.exports = new AutomationService();
