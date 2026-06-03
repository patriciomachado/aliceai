const { openai, model } = require('../config/llm');
const { supabase } = require('../config/database');

/**
 * Returns the current date (YYYY-MM-DD) and time (HH:MM) in Brasília time zone (America/Sao_Paulo)
 */
const getBrazilDateTime = () => {
  const options = {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  
  const formatter = new Intl.DateTimeFormat('pt-BR', options);
  const parts = formatter.formatToParts(new Date());
  const dateMap = parts.reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  
  const dateStr = `${dateMap.year}-${dateMap.month}-${dateMap.day}`; // YYYY-MM-DD
  const timeStr = `${dateMap.hour}:${dateMap.minute}`; // HH:MM
  
  return { dateStr, timeStr };
};

/**
 * Formats a Date object or ISO string to Brasília Time (DD/MM/YYYY, HH:MM)
 */
const formatBrazilDateTime = (dateVal) => {
  if (!dateVal) return '';
  const dateObj = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  const options = {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  const formatter = new Intl.DateTimeFormat('pt-BR', options);
  return formatter.format(dateObj); // Returns "DD/MM/YYYY, HH:MM"
};

/**
 * Recursively strips any timestamp prefixes (e.g. "[26/05/2026, 14:50]") from message content
 */
const cleanMessageContent = (content) => {
  if (typeof content !== 'string') return content;
  
  // 1. Remove Brasília timestamp prefixes
  let cleaned = content;
  const regex = /^\[\d{2}[-/]\d{2}[-/]\d{4},?\s\d{2}:\d{2}\]\s*/;
  while (regex.test(cleaned)) {
    cleaned = cleaned.replace(regex, '');
  }

  // 2. Remove OpenRouter/Anthropic XML tool calling residue tags (e.g. <antml:function_calls>)
  cleaned = cleaned.replace(/<antml[\s\S]*?<\/antml[^>]*>/gi, '');
  cleaned = cleaned.replace(/<[\s\S]*?<\/.*?>/gi, '');
  cleaned = cleaned.replace(/<[^>]+>/g, ''); // Remove raw tags

  // 3. Remove raw text artifacts of malformed XML or OpenRouter tag leakages
  const patternsToStrip = [
    /antml:function\s+function_calls\s*>?/gi,
    /antml:invoke\s*>?/gi,
    /antml:parameter\s*>?/gi,
    /\.?antml\s+invoke:name="[^"]*"\s*>?/gi,
    /an:antml:parameter[^>]*>?/gi,
    /an:name="[^"]*"/gi,
    /proname="[^"]*"/gi,
    /name="[^"]*"/gi,
    /parameter\s+name="[^"]*"/gi,
    /<\/antml[^>]*>/gi,
    /<\/parameter[^>]*>/gi,
    /<\/invoke[^>]*>/gi,
    /ant\s*}\s*\]/gi,
    /ant\s*}\s*\]\s*<\/?[a-z0-9_:\-=\s"']+>?/gi,
    /<\/?[a-z0-9_:\-=\s"'\(\)\[\]{}#@!%&*+\/\\|?,]+>?/gi,
    />?\s*\[\s*\{\s*"product_id"[\s\S]*?\}\s*\]\s*\]?\s*\}?\s*(?:name)?\s*:?\s*function_calls\s*>?(?:\s*>\s*>?\s*)*/gi,
    /\[\s*\{\s*"?product_id"?[\s\S]*?\}\s*\]/gi,
    /function_calls\s*>?[> \s]*/gi,
    /invoke\s*:\s*name\s*=[\s\S]*?>/gi
  ];

  for (const pattern of patternsToStrip) {
    cleaned = cleaned.replace(pattern, '');
  }

  // 4. Fix any lingering brackets or broken braces and extra spaces
  cleaned = cleaned.replace(/\]\s*\}\s*\]/g, '');
  cleaned = cleaned.replace(/\{\s*an\s*:\s*>/g, '');
  cleaned = cleaned.replace(/an\s*:\s*>/g, '');
  cleaned = cleaned.replace(/:\s*_\s*>\s*:\s*_/g, '');
  cleaned = cleaned.replace(/<\/?>\s*:\s*_/g, '');
  cleaned = cleaned.replace(/>\s*>\s*>\s*/g, '');
  cleaned = cleaned.replace(/^\s*>\s*/g, '');
  // Collapse multiple consecutive blank lines into max 2 newlines, but PRESERVE single \n line breaks
  cleaned = cleaned.replace(/[ \t]+/g, ' ');           // collapse horizontal whitespace only (spaces/tabs)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');         // max 2 consecutive newlines
  cleaned = cleaned.replace(/^\s+$/gm, '');             // remove whitespace-only lines

  return cleaned.trim();
};

// ==========================================
// AI TOOL DEFINITIONS (Function Calling)
// ==========================================
const aiTools = [
  {
    type: 'function',
    function: {
      name: 'create_appointment',
      description: 'Creates a real appointment in the system database. CALL THIS whenever a customer confirms an appointment (date + time agreed). Do NOT just say you booked it — execute this function to persist it.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string', description: 'The UUID of the customer' },
          service_type: { type: 'string', description: 'Service or appointment type being booked' },
          scheduled_date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
          scheduled_time: { type: 'string', description: 'Time in HH:MM format (24h)' },
          duration_minutes: { type: 'number', description: 'Duration in minutes, default 60' },
          notes: { type: 'string', description: 'Optional notes' }
        },
        required: ['customer_id', 'service_type', 'scheduled_date', 'scheduled_time']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_order',
      description: 'Creates a product order in the database for the customer. CALL THIS whenever a customer wants to buy, purchase, or order one or more products.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string', description: 'The UUID of the customer (UUID)' },
          payment_method: { type: 'string', description: 'Payment method. One of: "pix", "credit_card", "boleto", "whatsapp_pay"' },
          items: {
            type: 'array',
            description: 'List of items in the order',
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'string', description: 'The UUID of the product' },
                quantity: { type: 'number', description: 'Quantity of this product, default 1' },
                cut_type: { type: 'string', description: 'Optional. Selected meat cut preference if niche is butcher (e.g. "Bife Fino", "Bife Grosso", "Moído", "Em Cubos", "Peça Inteira", "Bife de 2 dedos")' },
                toppings: { 
                  type: 'array', 
                  description: 'Optional. Selected food toppings/extras if niche is restaurant (e.g. "Bacon", "Queijo Extra", "Ovo Frito")',
                  items: { type: 'string' } 
                },
                notes: { type: 'string', description: 'Optional. Any special custom note or observation requested by the customer (e.g. "sem cebola", "cortar em bifes de dois dedos")' }
              },
              required: ['product_id', 'quantity']
            }
          }
        },
        required: ['customer_id', 'items']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_order_item_metadata',
      description: 'Updates metadata (such as cutting preferences, notes, or toppings) for a specific item in a pending order. CALL THIS whenever a customer requests changes or observations/specifications for an item (e.g. "cortar em bifes de dois dedos", "sem cebola") after the order is created.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string', description: 'The UUID of the customer (UUID)' },
          product_id: { type: 'string', description: 'The UUID of the product to update the metadata for' },
          cut_type: { type: 'string', description: 'Optional. Meat cut preference (e.g. "Bife de 2 dedos", "Bife Fino", "Moído")' },
          toppings: { 
            type: 'array', 
            description: 'Optional. Selected toppings (e.g. "Bacon", "Queijo Extra")',
            items: { type: 'string' } 
          },
          notes: { type: 'string', description: 'Optional. Observations or custom notes requested by the customer (e.g. "cortar em bifes de 2 cm")' }
        },
        required: ['customer_id', 'product_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cancel_order',
      description: 'Cancels the active pending order of the customer in the database. CALL THIS whenever a customer requests to cancel, abort, or delete their order.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string', description: 'The UUID of the customer (UUID)' }
        },
        required: ['customer_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_nexus_os',
      description: 'Checks the real-time status of active service orders (O.S.) in the Nexus ERP system. CALL THIS whenever a customer asks about their repair status, order status, provides a specific OS number/ID, or asks if their device is ready.',
      parameters: {
        type: 'object',
        properties: {
          customer_phone: { type: 'string', description: 'The phone number of the customer (optional)' },
          os_number: { type: 'string', description: 'The specific O.S. number/ID provided by the customer, e.g. "00022" or "NXS-2026-9810" (optional)' }
        }
      }
    }
  }
];

// ==========================================
// TOOL EXECUTOR
// ==========================================
const executeTool = async (toolName, toolArgs, workspaceId) => {
  console.log(`[AI Service] Executing tool: ${toolName}`, JSON.stringify(toolArgs));

  if (toolName === 'create_appointment') {
    return await createAppointmentInDB(toolArgs, workspaceId);
  }
  if (toolName === 'create_order') {
    return await createOrderInDB(toolArgs, workspaceId);
  }
  if (toolName === 'update_order_item_metadata') {
    return await updateOrderItemMetadataInDB(toolArgs, workspaceId);
  }
  if (toolName === 'cancel_order') {
    return await cancelOrderInDB(toolArgs, workspaceId);
  }
  if (toolName === 'check_nexus_os') {
    return await checkNexusOSInERP(toolArgs, workspaceId);
  }
  return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
};

/**
 * Technical Assistance Nexus ERP tool call handler
 */
const checkNexusOSInERP = async (args, workspaceId) => {
  try {
    const { customer_phone, os_number } = args;
    const nexusService = require('./nexusService');

    // If an OS number was explicitly provided, search by number (with customer_phone passed as fallback context)
    if (os_number) {
      console.log(`[AI Tool] Searching Nexus OS by number: ${os_number} (Fallback Phone: ${customer_phone})`);
      const osResult = await nexusService.getOSByNumber(os_number, workspaceId, customer_phone);
      return JSON.stringify(osResult);
    }

    // Otherwise, search by customer phone number
    if (!customer_phone) {
      return JSON.stringify({ success: false, error: 'Customer phone number or OS number is required' });
    }

    console.log(`[AI Tool] Searching Nexus OS by phone: ${customer_phone}`);
    const osResult = await nexusService.getOSByPhone(customer_phone, workspaceId);
    return JSON.stringify(osResult);
  } catch (err) {
    console.error('[AI Tool] checkNexusOSInERP error:', err.message);
    return JSON.stringify({ success: false, error: err.message });
  }
};

/**
 * Core appointment creation logic used by both tool calling and JSON fallback
 */
const createAppointmentInDB = async (args, workspaceId) => {
  try {
    const {
      customer_id,
      service_type,
      scheduled_date,
      scheduled_time,
      duration_minutes = 60,
      notes = null
    } = args;

    // Validate customer belongs to this workspace
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('id, name, email, phone')
      .eq('id', customer_id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (custErr || !customer) {
      console.error('[AI Tool] Customer not found:', customer_id, custErr?.message);
      return JSON.stringify({ success: false, error: 'Customer not found in workspace' });
    }

    // 1. Fetch workspace settings to validate business hours
    const { data: workspace, error: wsErr } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .single();

    if (wsErr || !workspace) {
      console.error('[AI Tool] Workspace not found for settings lookup:', wsErr?.message);
      return JSON.stringify({ success: false, error: 'Workspace settings not found' });
    }

    const settings = workspace.settings || {};
    const apptHours = settings.appointment_hours || {};

    // Get day name of scheduled_date (YYYY-MM-DD)
    const dateParts = scheduled_date.split('-');
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // 0-indexed month
    const day = parseInt(dateParts[2], 10);
    const dateObj = new Date(year, month, day);

    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = daysOfWeek[dateObj.getDay()];
    const dayLabels = {
      sunday: 'domingo',
      monday: 'segunda-feira',
      tuesday: 'terça-feira',
      wednesday: 'quarta-feira',
      thursday: 'quinta-feira',
      friday: 'sexta-feira',
      saturday: 'sábado'
    };

    const dayConfig = apptHours[dayName];

    // If day is not enabled or not defined in settings
    if (!dayConfig || dayConfig.enabled === false) {
      const dayLabel = dayLabels[dayName] || dayName;
      return JSON.stringify({
        success: false,
        error: 'Fora do horário de atendimento',
        message: `Desculpe, não realizamos agendamentos aos ${dayLabel}s. Por favor, escolha outro dia de segunda a sábado.`
      });
    }

    // Validate scheduled_time is within open/close range (HH:MM)
    const requestedTime = scheduled_time.slice(0, 5); // ensure HH:MM format
    const openTime = dayConfig.open || '10:00';
    const closeTime = dayConfig.close || '17:00';

    if (requestedTime < openTime || requestedTime > closeTime) {
      const dayLabel = dayLabels[dayName] || dayName;
      return JSON.stringify({
        success: false,
        error: 'Fora do horário de atendimento',
        message: `Desculpe, o horário de ${requestedTime} está fora do nosso expediente para ${dayLabel}. Nosso horário de atendimento nesse dia é das ${openTime} às ${closeTime}. Por favor, escolha um horário dentro desta janela.`
      });
    }

    // Validate requested time is not in the past if requested date is today in Brazil Time
    const { dateStr: currentBrDate, timeStr: currentBrTime } = getBrazilDateTime();
    if (scheduled_date === currentBrDate) {
      if (requestedTime < currentBrTime) {
        return JSON.stringify({
          success: false,
          error: 'Horário no passado',
          message: `Desculpe, o horário das ${requestedTime} já passou. Agora são ${currentBrTime} no horário de Brasília. Por favor, escolha um horário futuro para hoje.`
        });
      }
    }

    // Validate minimum lead time
    const leadTimeHours = parseInt(settings.appointment_lead_time_hours, 10) || 0;
    const slotInterval = parseInt(settings.appointment_slot_interval_minutes, 10) || 30;

    if (leadTimeHours > 0) {
      const [curYear, curMonth, curDay] = currentBrDate.split('-').map(Number);
      const [curHour, curMin] = currentBrTime.split(':').map(Number);
      const nowBr = new Date(curYear, curMonth - 1, curDay, curHour, curMin);

      const [schYear, schMonth, schDay] = scheduled_date.split('-').map(Number);
      const [schHour, schMin] = requestedTime.split(':').map(Number);
      const scheduledBr = new Date(schYear, schMonth - 1, schDay, schHour, schMin);

      // Allow a 15-minute tolerance/grace period for message delay & race conditions
      const gracePeriodMs = 15 * 60 * 1000;
      const diffMs = scheduledBr.getTime() - nowBr.getTime() + gracePeriodMs;
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < leadTimeHours) {
        // Calculate the nearest allowed time
        let minBrDate = new Date(nowBr.getTime() + leadTimeHours * 60 * 60 * 1000);
        
        // Round up to the next slotInterval multiple
        const msInterval = 1000 * 60 * slotInterval;
        minBrDate = new Date(Math.ceil(minBrDate.getTime() / msInterval) * msInterval);

        const minDay = String(minBrDate.getDate()).padStart(2, '0');
        const minMonth = String(minBrDate.getMonth() + 1).padStart(2, '0');
        const minYear = minBrDate.getFullYear();
        const minHour = String(minBrDate.getHours()).padStart(2, '0');
        const minMin = String(minBrDate.getMinutes()).padStart(2, '0');
        const minFormatted = `${minDay}/${minMonth}/${minYear} às ${minHour}:${minMin}`;

        return JSON.stringify({
          success: false,
          error: 'Antecedência insuficiente',
          message: `Desculpe, precisamos de no mínimo ${leadTimeHours} horas de antecedência para realizar um agendamento. O horário mais próximo disponível seria a partir de ${minFormatted}. Por favor, escolha um horário após este limite.`
        });
      }
    }

    // 2. Validate duplicate slot (same date, time, and active status)
    const normalizedTime = requestedTime.length === 5 ? `${requestedTime}:00` : requestedTime;

    const { data: existingAppt, error: checkErr } = await supabase
      .from('appointments')
      .select('id, customer_id, service_type, scheduled_date, scheduled_time, duration_minutes, status')
      .eq('workspace_id', workspaceId)
      .eq('scheduled_date', scheduled_date)
      .eq('scheduled_time', normalizedTime)
      .in('status', ['scheduled', 'confirmed'])
      .limit(1)
      .maybeSingle();

    if (checkErr) {
      console.error('[AI Tool] Error checking existing appointments:', checkErr.message);
    }

    if (existingAppt) {
      // If the appointment already exists for the SAME customer, reuse it and return success!
      if (existingAppt.customer_id === customer_id) {
        console.log(`[AI Tool] Reusing existing appointment for same customer: ${existingAppt.id}`);
        return JSON.stringify({
          success: true,
          appointment_id: existingAppt.id,
          customer_name: customer.name,
          service_type: existingAppt.service_type,
          scheduled_date: existingAppt.scheduled_date,
          scheduled_time: existingAppt.scheduled_time.slice(0, 5),
          duration_minutes: existingAppt.duration_minutes,
          status: existingAppt.status,
          message: `Agendamento já estava registrado com sucesso para este cliente em ${existingAppt.scheduled_date} às ${existingAppt.scheduled_time.slice(0, 5)}.`
        });
      }

      return JSON.stringify({
        success: false,
        error: 'Horário indisponível',
        message: `Desculpe, o horário das ${requestedTime} no dia ${scheduled_date} já está reservado por outro cliente. Por favor, escolha outro horário ou outra data.`
      });
    }

    // 3. Insert the appointment
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        workspace_id: workspaceId,
        customer_id,
        service_type,
        scheduled_date,
        scheduled_time: normalizedTime,
        duration_minutes: parseInt(duration_minutes, 10) || 60,
        notes,
        status: 'scheduled',
        google_calendar_event_id: `ai_gcal_${Date.now()}`
      })
      .select('*, customers(name)')
      .single();

    // Trigger background automation workflow
    try {
      const automationService = require('./automationService');
      automationService.trigger('appointment_booked', {
        appointment,
        customer
      }, workspaceId);
    } catch (autoErr) {
      console.error('[AI Service Appointment Tool] Automation trigger error:', autoErr.message);
    }

    console.log(`[AI Tool] ✅ Appointment created for ${customer.name}: ${service_type} on ${scheduled_date} at ${scheduled_time}`);

    // Synchronize newly created appointment to Nexus ERP
    try {
      const nexusService = require('./nexusService');
      await nexusService.syncAppointmentToNexus(appointment, customer, workspaceId);
    } catch (nexusErr) {
      console.error('[AI Service Appointment Tool] Nexus sync error:', nexusErr.message);
    }

    return JSON.stringify({
      success: true,
      appointment_id: appointment.id,
      customer_name: customer.name,
      service_type,
      scheduled_date,
      scheduled_time,
      duration_minutes: appointment.duration_minutes,
      status: 'scheduled',
      message: `Agendamento registrado com sucesso: ${service_type} para ${customer.name} em ${scheduled_date} às ${scheduled_time}.`
    });
  } catch (err) {
    console.error('[AI Tool] Unexpected error:', err.message);
    return JSON.stringify({ success: false, error: err.message });
  }
};

/**
 * Core order creation logic used by tool calling
 */
const createOrderInDB = async (args, workspaceId) => {
  try {
    const {
      customer_id,
      payment_method = 'pix'
    } = args;

    // Fetch workspace settings to validate order hours
    const { data: workspace, error: wsErr } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .single();

    if (wsErr || !workspace) {
      console.error('[AI Tool] Workspace not found for order hours lookup:', wsErr?.message);
    }
    const settings = workspace?.settings || {};
    const orderHours = settings.order_hours || {};
    const ordersPaused = settings.orders_paused === true;

    const { dateStr: currentBrDate, timeStr: currentTimeStr } = getBrazilDateTime();
    const dateParts = currentBrDate.split('-');
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);
    const dateObj = new Date(year, month, day);

    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = daysOfWeek[dateObj.getDay()];
    const dayConfig = orderHours[dayName];

    let isOutsideHours = false;
    if (!dayConfig || dayConfig.enabled === false) {
      isOutsideHours = true;
    } else {
      const openTime = dayConfig.open || '08:00';
      const closeTime = dayConfig.close || '18:00';
      if (currentTimeStr < openTime || currentTimeStr > closeTime) {
        isOutsideHours = true;
      }
    }

    let items = args.items;

    // Self-healing format adapter to handle variations in LLM tool calling formats
    if (!items) {
      if (args.product_id) {
        items = [{
          product_id: args.product_id,
          quantity: Number(args.quantity) || 1
        }];
      } else if (args.product_ids) {
        let pIds = args.product_ids;
        if (typeof pIds === 'string') {
          try { pIds = JSON.parse(pIds); } catch { pIds = [pIds]; }
        }
        let qty = args.quantity || args.quantities || 1;
        if (typeof qty === 'string') {
          try { qty = JSON.parse(qty); } catch { qty = [qty]; }
        }

        if (Array.isArray(pIds)) {
          items = pIds.map((id, index) => {
            let q = 1;
            if (Array.isArray(qty)) {
              q = Number(qty[index]) || 1;
            } else if (typeof qty === 'number') {
              q = qty;
            } else if (typeof qty === 'string') {
              q = Number(qty) || 1;
            }
            return { product_id: id, quantity: q };
          });
        }
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return JSON.stringify({ success: false, error: 'No items provided for the order.' });
    }

    // Validate customer belongs to this workspace
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('id, name, email, phone')
      .eq('id', customer_id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (custErr || !customer) {
      console.error('[AI Tool] Customer not found:', customer_id, custErr?.message);
      return JSON.stringify({ success: false, error: 'Customer not found in workspace' });
    }

    // Fetch product pricing
    const productIds = items.map(i => i.product_id).filter(id => {
      // Only query valid UUIDs to avoid Supabase querying errors
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(id);
    });

    let products = [];
    if (productIds.length > 0) {
      const { data: dbProducts, error: prodErr } = await supabase
        .from('products')
        .select('id, name, price, stock')
        .in('id', productIds)
        .eq('workspace_id', workspaceId);
      
      if (!prodErr && dbProducts) {
        products = dbProducts;
      }
    }

    let totalAmount = 0;
    const orderItemsPayload = [];

    // Ensure we have a generic product in the workspace database for any unrecognized item
    const getOrCreateGenericProduct = async () => {
      const { data: existingGeneric } = await supabase
        .from('products')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('name', 'Produto Personalizado')
        .limit(1)
        .maybeSingle();

      if (existingGeneric) {
        return existingGeneric;
      }

      const crypto = require('crypto');
      const newProductId = crypto.randomUUID();
      const { data: newProd, error: createErr } = await supabase
        .from('products')
        .insert({
          id: newProductId,
          workspace_id: workspaceId,
          name: 'Produto Personalizado',
          description: 'Item de pedido personalizado (preço a calcular no momento da entrega/retirada)',
          price: 0.00,
          stock: 999,
          category: 'Geral',
          sku: `custom-${Date.now()}`
        })
        .select()
        .single();

      if (createErr) {
        console.error('[AI Tool] Failed to create generic product fallback:', createErr.message);
        throw new Error(createErr.message);
      }
      return newProd;
    };

    let cachedGenericProduct = null;

    for (const item of items) {
      let prod = products.find(p => p.id === item.product_id);
      if (!prod) {
        // Self-healing fallback: Load or create a generic product for this item
        console.log(`[AI Tool] Product ID ${item.product_id} not found in database. Using self-healing generic product fallback.`);
        if (!cachedGenericProduct) {
          cachedGenericProduct = await getOrCreateGenericProduct();
        }
        prod = cachedGenericProduct;
        item.product_id = prod.id;
      }

      const qty = Number(item.quantity) || 1;
      const subtotal = Number(prod.price) * qty;
      totalAmount += subtotal;

      const itemMetadata = {
        cut_type: item.cut_type || null,
        toppings: item.toppings || [],
        notes: item.notes || null
      };

      orderItemsPayload.push({
        product_id: item.product_id,
        quantity: qty,
        unit_price: prod.price,
        subtotal,
        metadata: itemMetadata
      });
    }

    // Check if customer already has a pending order in this workspace to avoid duplicate order clutter
    const { data: existingPendingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_id', customer_id)
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let order;
    if (existingPendingOrder) {
      // Reuse and update the existing pending order
      const { data: updatedOrder, error: orderError } = await supabase
        .from('orders')
        .update({
          total_amount: totalAmount,
          payment_method,
          updated_at: new Date()
        })
        .eq('id', existingPendingOrder.id)
        .select()
        .single();

      if (orderError) {
        console.error('[AI Tool] Failed to update existing order:', orderError.message);
        return JSON.stringify({ success: false, error: orderError.message });
      }

      order = updatedOrder;

      // Clean up previous items for this order to replace them with the new ones
      await supabase
        .from('order_items')
        .delete()
        .eq('order_id', order.id);

      console.log(`[AI Tool] Reusing and updating existing pending order: ${order.id}`);
    } else {
      // Insert new order record
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          workspace_id: workspaceId,
          customer_id,
          total_amount: totalAmount,
          payment_method,
          status: 'pending',
          payment_status: 'pending'
        })
        .select()
        .single();

      if (orderError) {
        console.error('[AI Tool] Failed to create order:', orderError.message);
        return JSON.stringify({ success: false, error: orderError.message });
      }

      order = newOrder;
      console.log(`[AI Tool] Created new pending order: ${order.id}`);
    }

    // Insert order items junctions
    const finalItems = orderItemsPayload.map(oi => ({ ...oi, order_id: order.id }));
    const { error: itemsError } = await supabase.from('order_items').insert(finalItems);
    if (itemsError) {
      console.error('[AI Tool] Failed to create order items:', itemsError.message);
      return JSON.stringify({ success: false, error: itemsError.message });
    }

    // Trigger background automation workflow
    try {
      const automationService = require('./automationService');
      automationService.trigger('order_created', {
        order,
        customer
      }, workspaceId);
    } catch (autoErr) {
      console.error('[AI Service Order Tool] Automation trigger error:', autoErr.message);
    }

    if (ordersPaused) {
      console.log(`[AI Tool] ✅ Order created while paused for ${customer.name}: Total R$ ${totalAmount}`);
      return JSON.stringify({
        success: true,
        orders_paused: true,
        order_id: order.id,
        customer_name: customer.name,
        total_amount: totalAmount,
        message: `Pedido #${order.id.slice(-6).toUpperCase()} registrado no sistema com sucesso! No entanto, gostaríamos de avisar que nossos pedidos estão temporariamente pausados devido a uma emergência ou manutenção. O seu pedido foi guardado de forma segura e será preparado assim que reativarmos o sistema de pedidos.`
      });
    }

    if (isOutsideHours) {
      console.log(`[AI Tool] ✅ Order created outside hours for ${customer.name}: Total R$ ${totalAmount}`);
      return JSON.stringify({
        success: true,
        outside_hours: true,
        order_id: order.id,
        customer_name: customer.name,
        total_amount: totalAmount,
        message: `Pedido #${order.id.slice(-6).toUpperCase()} guardado com sucesso! Note que estamos fora do nosso horário de atendimento. O pedido foi registrado no sistema e será preparado e processado assim que iniciarmos o próximo expediente.`
      });
    }

    console.log(`[AI Tool] ✅ Order confirmed for ${customer.name}: Total R$ ${totalAmount}`);
    return JSON.stringify({
      success: true,
      order_id: order.id,
      customer_name: customer.name,
      total_amount: totalAmount,
      payment_url: null,
      message: `Pedido #${order.id.slice(-6).toUpperCase()} gerado com sucesso! Total: R$ ${totalAmount.toFixed(2)}. O pagamento será efetuado diretamente na retirada ou entrega via ${payment_method === 'pix' ? 'Pix' : 'Cartão'}.`
    });
  } catch (err) {
    console.error('[AI Tool] Unexpected error in createOrderInDB:', err.message);
    return JSON.stringify({ success: false, error: err.message });
  }
};

const updateOrderItemMetadataInDB = async (args, workspaceId) => {
  try {
    const {
      customer_id,
      product_id,
      cut_type = null,
      toppings = [],
      notes = null
    } = args;

    // 1. Find the latest pending order for the customer in this workspace
    const { data: latestOrder, error: orderErr } = await supabase
      .from('orders')
      .select('id, status')
      .eq('customer_id', customer_id)
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderErr || !latestOrder) {
      console.error('[AI Tool] No active pending order found to update:', customer_id, orderErr?.message);
      return JSON.stringify({ success: false, error: 'No active pending order found for this customer to update.' });
    }

    // 2. Find the specific order item in order_items
    const { data: orderItem, error: itemErr } = await supabase
      .from('order_items')
      .select('id, metadata')
      .eq('order_id', latestOrder.id)
      .eq('product_id', product_id)
      .maybeSingle();

    if (itemErr || !orderItem) {
      console.error('[AI Tool] Product not found in the latest order items:', product_id, itemErr?.message);
      return JSON.stringify({ success: false, error: 'Product not found in this order.' });
    }

    // 3. Merge metadata
    const currentMetadata = orderItem.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      cut_type: cut_type !== null ? cut_type : currentMetadata.cut_type,
      toppings: toppings.length > 0 ? toppings : (currentMetadata.toppings || []),
      notes: notes !== null ? notes : currentMetadata.notes
    };

    // 4. Update order_item record
    const { error: updateErr } = await supabase
      .from('order_items')
      .update({ metadata: updatedMetadata })
      .eq('id', orderItem.id);

    if (updateErr) {
      console.error('[AI Tool] Failed to update item metadata:', updateErr.message);
      return JSON.stringify({ success: false, error: updateErr.message });
    }

    console.log(`[AI Tool] Metadata updated successfully for order ${latestOrder.id}, item ${orderItem.id}`);
    return JSON.stringify({
      success: true,
      message: 'Preferência do cliente registrada no pedido com sucesso!',
      order_id: latestOrder.id,
      updated_metadata: updatedMetadata
    });

  } catch (err) {
    console.error('[AI Tool] Unexpected error in updateOrderItemMetadataInDB:', err.message);
    return JSON.stringify({ success: false, error: err.message });
  }
};

const cancelOrderInDB = async (args, workspaceId) => {
  try {
    const { customer_id } = args;

    // 1. Find the latest pending order for the customer in this workspace
    const { data: latestOrder, error: orderErr } = await supabase
      .from('orders')
      .select('id, status')
      .eq('customer_id', customer_id)
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderErr || !latestOrder) {
      console.error('[AI Tool] No active pending order found to cancel:', customer_id, orderErr?.message);
      return JSON.stringify({ success: false, error: 'No active pending order found for this customer to cancel.' });
    }

    // 2. Update status to 'cancelled'
    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', latestOrder.id)
      .select()
      .single();

    if (updateErr) {
      console.error('[AI Tool] Failed to cancel order in DB:', updateErr.message);
      return JSON.stringify({ success: false, error: updateErr.message });
    }

    console.log(`[AI Tool] ✅ Order ${latestOrder.id} cancelled successfully.`);
    return JSON.stringify({
      success: true,
      order_id: latestOrder.id,
      message: `Pedido #${latestOrder.id.slice(-6).toUpperCase()} cancelado com sucesso no sistema.`
    });

  } catch (err) {
    console.error('[AI Tool] Unexpected error in cancelOrderInDB:', err.message);
    return JSON.stringify({ success: false, error: err.message });
  }
};

/**
 * Fallback: ask AI to extract appointment data as JSON when tool_calls aren't available.
 * This handles models that don't support OpenAI-style function calling (e.g. some OpenRouter models).
 */
const tryExtractAndCreateAppointment = async (conversationMessages, workspaceId, customerId) => {
  if (!customerId) return null;

  try {
    // Use a separate, targeted call to extract appointment data
    const extractionCompletion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Analise a conversa abaixo e verifique se foi CONFIRMADO um agendamento (data e horário definidos pelo cliente e aceitos pelo assistente).
Se sim, responda SOMENTE com um JSON no seguinte formato (sem texto adicional, sem markdown):
{"has_appointment": true, "service_type": "...", "scheduled_date": "YYYY-MM-DD", "scheduled_time": "HH:MM", "duration_minutes": 60, "notes": "..."}
Se NÃO foi confirmado um agendamento, responda apenas: {"has_appointment": false}
Data de hoje: ${getBrazilDateTime().dateStr}`
        },
        ...conversationMessages.slice(-6) // Last 6 messages for context
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 256
    });

    const extracted = JSON.parse(extractionCompletion.choices[0].message.content);
    
    if (extracted.has_appointment && extracted.scheduled_date && extracted.scheduled_time) {
      console.log(`[AI Service] Fallback appointment extraction found: ${extracted.service_type} on ${extracted.scheduled_date}`);
      const result = await createAppointmentInDB({
        customer_id: customerId,
        service_type: extracted.service_type || 'Atendimento',
        scheduled_date: extracted.scheduled_date,
        scheduled_time: extracted.scheduled_time,
        duration_minutes: extracted.duration_minutes || 60,
        notes: extracted.notes || null
      }, workspaceId);
      
      const parsed = JSON.parse(result);
      return parsed.success ? parsed : null;
    }
  } catch (err) {
    console.warn('[AI Service] Appointment extraction fallback failed:', err.message);
  }
  return null;
};

/**
 * Main AI message processing pipeline with Function Calling + JSON fallback
 */
const processIncomingMessage = async (messageText, workspaceId, conversationId = null, customerContext = null) => {
  try {
    // If customerContext is not supplied but conversationId is, automatically load it from the DB
    if (!customerContext && conversationId) {
      try {
        const { data: conv } = await supabase
          .from('conversations')
          .select('*, customers(*)')
          .eq('id', conversationId)
          .single();
          
        if (conv?.customers) {
          customerContext = {
            id: conv.customers.id,
            name: conv.customers.name,
            phone: conv.customers.whatsapp || conv.customers.phone
          };
          console.log(`[AI Service] Resolved customerContext automatically: ID ${customerContext.id}, Name: ${customerContext.name}, Phone: ${customerContext.phone}`);
        }
      } catch (convErr) {
        console.error('[AI Service] Error resolving customerContext from conversationId:', convErr.message);
      }
    }

    // 1. Parallel fetch of all context data
    const fetchPromises = [
      evaluateSentimentAndIntent(messageText),
      searchKnowledgeBase(messageText, workspaceId),
      supabase.from('workspaces').select('name, settings').eq('id', workspaceId).single(),
      supabase.from('products').select('id, name, description, price, stock, category').eq('workspace_id', workspaceId),
      supabase.from('services').select('name, description, price, duration_minutes, category').eq('workspace_id', workspaceId).eq('is_active', true)
    ];

    if (customerContext?.id) {
      fetchPromises.push(
        supabase
          .from('appointments')
          .select('id, service_type, scheduled_date, scheduled_time, status')
          .eq('customer_id', customerContext.id)
          .in('status', ['scheduled', 'confirmed'])
          .order('scheduled_date', { ascending: true })
          .order('scheduled_time', { ascending: true })
      );
      fetchPromises.push(
        supabase
          .from('orders')
          .select('id, total_amount, status, created_at, order_items(quantity, products(name))')
          .eq('customer_id', customerContext.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
      );
    } else {
      fetchPromises.push(Promise.resolve({ data: [] }));
      fetchPromises.push(Promise.resolve({ data: [] }));
    }

    const [sentimentResult, kbMatches, workspaceRes, productsRes, servicesRes, appointmentsRes, ordersRes] = await Promise.all(fetchPromises);
    const activeAppointmentsList = appointmentsRes?.data || [];
    const activeOrdersList = ordersRes?.data || [];

    const workspaceName = workspaceRes.data?.name || 'Assistente Virtual';
    const workspaceSettings = workspaceRes.data?.settings || {};
    const systemInstruction = workspaceSettings.system_instruction || 
      'Você é um assistente virtual inteligente, prestativo e profissional. Ajude o cliente respondendo suas dúvidas de forma objetiva.';

    const productsList = productsRes.data || [];
    const servicesList = servicesRes.data || [];

    // 2. Load conversation history
    let historyMessages = [];
    if (conversationId) {
      try {
        const { data: dbHistory } = await supabase
          .from('messages')
          .select('sender_type, content, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(40);
          
        if (dbHistory && dbHistory.length > 0) {
          historyMessages = dbHistory.map(m => ({
            role: m.sender_type === 'customer' ? 'user' : 'assistant',
            content: cleanMessageContent(m.content)
          }));
        }
      } catch (historyErr) {
        console.error('[AI Service] Error loading conversation history:', historyErr);
      }
    }

    // 3. Build system prompt
    const activeModules = workspaceSettings.modules || {
      products: true,
      services: true,
      orders: true,
      appointments: true
    };
    const slotInterval = workspaceSettings.appointment_slot_interval_minutes || 30;
    const showProducts = activeModules.products !== false;
    const showServices = activeModules.services !== false;

    const { dateStr: todayStr, timeStr: currentTimeStr } = getBrazilDateTime();
    const customerIdLine = customerContext?.id
      ? `\nID DO CLIENTE ATUAL NO SISTEMA (UUID): ${customerContext.id} — use este ID no campo customer_id ao chamar ferramentas/funções como create_appointment e create_order.`
      : '';

    let appointmentsSection = '';
    if (activeAppointmentsList.length > 0) {
      appointmentsSection = `\n\nAGENDAMENTOS ATIVOS DESTE CLIENTE NO BANCO DE DADOS:
${activeAppointmentsList.map(a => `- Serviço: ${a.service_type} | Data: ${a.scheduled_date} | Horário: ${a.scheduled_time.slice(0, 5)} | Status: ${a.status}`).join('\n')}
(Nota sobre agendamentos de hoje: se o horário de hoje já passou em relação à HORA ATUAL EM BRASÍLIA, o agendamento já ocorreu/passou. Ofereça reagendamento ou pergunte como foi o atendimento, não o trate como um evento futuro.)`;
    } else {
      appointmentsSection = `\n\nEste cliente não possui nenhum agendamento ativo ou pendente no banco de dados no momento.`;
    }

    let ordersSection = '';
    if (activeOrdersList.length > 0) {
      ordersSection = `\n\nPEDIDOS ATIVOS/PENDENTES DESTE CLIENTE NO BANCO DE DADOS:
${activeOrdersList.map(o => `- Pedido ID: ${o.id} | Total: R$ ${Number(o.total_amount).toFixed(2)} | Status: ${o.status} | Itens: ${o.order_items?.map(oi => `${oi.quantity}x ${oi.products?.name}`).join(', ') || 'Nenhum'}`).join('\n')}
(Nota sobre cancelamento: se o cliente solicitar o cancelamento, use a função cancel_order. Você sabe que ele tem um pedido pendente ativo!)`;
    } else {
      ordersSection = `\n\nEste cliente não possui nenhum pedido pendente ou ativo no momento.`;
    }

    const activeNiche = workspaceSettings.niche || 'retail';
    const acceptedPayments = workspaceSettings.payment_methods || ['pix', 'credit_card'];
    const paymentMethodsLabels = {
      pix: 'Pix',
      credit_card: 'Cartão de Crédito',
      debit_card: 'Cartão de Débito',
      cash: 'Dinheiro em Espécie'
    };
    const paymentMethodsListStr = acceptedPayments.map(m => paymentMethodsLabels[m] || m).join(', ');

    const nicheInstructions = {
      butcher: 'Você atende em nome de um Açougue/Casa de Carnes. Os clientes podem pedir carnes por peso (ex: kg ou gramas) e escolher a preferência do corte (ex: bife fino, grosso, moído, em cubos, peça inteira). Lembre-se de confirmar o peso e a preferência de corte. Para produtos vendidos por peso (ex: carne), informe que o valor final exato será calculado no momento da retirada com base na pesagem.',
      restaurant: 'Você atende em nome de uma Lanchonete/Restaurante. Os clientes podem pedir alimentos e adicionar opcionais como Bacon, Queijo Extra ou Ovo Frito.',
      gym: 'Você atende em nome de uma Academia, Studio de Pilates/Yoga ou Centro Fitness. O cliente já possui o aplicativo de administração principal do estabelecimento para o dia a dia. Seu papel é atuar como uma recepcionista virtual 24h: tire dúvidas institucionais (horários de funcionamento, estrutura, modalidades), ajude na venda de Planos e Serviços (Mensal, Trimestral, Anual, Gold, Platinum) que estão catalogados na nossa lista de produtos abaixo, informe as condições e preços vigentes de forma clara, e se ele demonstrar interesse em iniciar ou agendar uma Aula Experimental, use a função "create_appointment" para agendar um horário de aula experimental. Para pagamentos de mensalidades/planos, informe a nossa chave Pix ou formas de pagamento aceitas e oriente-o de que o pagamento de novos planos deve ser efetuado para ativação ou diretamente na recepção.',
      retail: 'Você atende em nome de um estabelecimento de Varejo/Serviços Gerais.'
    };
    
    const nichePrompt = nicheInstructions[activeNiche] || nicheInstructions.retail;
    let paymentPrompt = `\nMÉTODOS DE PAGAMENTO ACEITOS: Aceitamos apenas os seguintes métodos de pagamento: ${paymentMethodsListStr}. Certifique-se de instruir o cliente sobre essas formas de pagamento no fechamento do pedido.`;
    if (acceptedPayments.includes('pix') && workspaceSettings.pix_key) {
      paymentPrompt += `\n- DADOS PARA PAGAMENTO VIA PIX: A nossa chave Pix é "${workspaceSettings.pix_key}"`;
      if (workspaceSettings.pix_name) {
        paymentPrompt += ` em nome de "${workspaceSettings.pix_name}" (Favorecido/Beneficiário).`;
      } else {
        paymentPrompt += `.`;
      }
      paymentPrompt += ` Sempre que o cliente escolher pagamento via Pix, informe a chave Pix e o nome do favorecido claramente para que ele possa realizar a transferência com segurança.`;
    }

    let techContextSection = `\n\nCONTEXTO TECNOLÓGICO DE 2026:
- Estamos no ano de 2026. Portanto, os modelos iPhone 15 (lançado em 2023), iPhone 16 (lançado em 2024) e iPhone 17 (lançado em 2025) já foram lançados e são smartphones reais e extremamente comuns no mercado atual. O iPhone 18 será lançado no final deste ano de 2026.
- Se o cliente perguntar sobre o reparo ou orçamento de um modelo de iPhone recente (como iPhone 15, 16, 17, 17 Pro, etc.) que não esteja listado explicitamente na nossa lista estática de produtos ou serviços abaixo:
  * NUNCA diga ao cliente que o modelo não existe ou que só existe até o 15 Pro Max.
  * Confirme de forma profissional que esses modelos existem.
  * Explique que, por serem aparelhos mais novos ou que necessitam de cotação de peças sob demanda, você não tem o valor fixado em seu sistema neste exato momento.
  * Ofereça-se para verificar com o setor técnico a disponibilidade e o valor personalizado, direcionando o atendimento para um técnico humano para concluir o orçamento.`;

    const systemPrompt = `${systemInstruction}

Você está conversando com um cliente em nome de "${workspaceName}".
${nichePrompt}${paymentPrompt}
SIGA as instruções acima RIGOROSAMENTE. Responda de forma direta, concisa e amigável.
Não repita perguntas que já foram respondidas no histórico.

REGRA CRÍTICA DE PRODUTOS E VALORES — TOLERÂNCIA ZERO A ALUCINAÇÕES E ORÇAMENTOS INVENTADOS:
- Você SÓ PODE confirmar a existência, passar valores, orçamentos, estimativas, descrições e estoques de produtos ou serviços que estejam listados EXPLICITAMENTE abaixo em "PRODUTOS DISPONÍVEIS NO SISTEMA" ou "SERVIÇOS DISPONÍVEIS NO SISTEMA".
- Se o cliente perguntar por um produto, serviço, conserto ou orçamento que NÃO esteja nessa lista (ou se a lista de produtos/serviços estiver vazia), você JAMAIS, EM HIPÓTESE ALGUMA, deve chutar, estimar ou inventar qualquer valor ou faixa de preço (ex: "deve custar cerca de R$ X", "o orçamento fica entre R$ X e R$ Y"). Isso é uma violação gravíssima e inaceitável.
- ANTES de passar qualquer orçamento ou valor monetário (R$), SEMPRE verifique se o produto ou serviço exato está listado no catálogo abaixo. Se NÃO estiver listado, diga de forma direta e gentil que não possui o preço ou orçamento para esse item no sistema e que irá transferir para um colaborador humano para calcular o valor.
- Esta regra aplica-se a QUALQUER tipo de orçamento, conserto, peça, acessório ou serviço. Se não está nas tabelas oficiais abaixo, você NÃO tem o preço e NÃO sabe o valor.

REGRAS OBRIGATÓRIAS DE FORMATAÇÃO E QUALIDADE:
- Use QUEBRAS DE LINHA (\n) para separar blocos de informação e listas de produtos/serviços. Nunca envie um "textão" corrido sem parágrafos.
- Ao listar produtos, preços ou opções, coloque CADA ITEM em uma linha separada usando o formato "- Nome: R$ Preço".
- Escreva em Português do Brasil impecável, sem erros ortográficos, palavras grudadas ou abreviações incorretas.
- Use emojis com moderação (1-2 por mensagem) para manter um tom profissional e acolhedor.
- Nunca duplique pontuação (ex: ::, ,,, //) nem gere caracteres aleatórios.
DATA DE HOJE EM BRASÍLIA: ${todayStr} | HORA ATUAL EM BRASÍLIA: ${currentTimeStr}${customerIdLine}${appointmentsSection}${ordersSection}${techContextSection}

REGRA CRÍTICA SOBRE AGENDAMENTOS: Quando o cliente confirmar uma data E horário para um serviço, você DEVE executar a função create_appointment para registrar no banco de dados. Não apenas confirme verbalmente — execute a função. Após criar, informe ao cliente os detalhes completos do agendamento. Você deve SEMPRE sugerir, oferecer e enfileirar horários arredondados em intervalos de exatamente ${slotInterval} minutos (ex: 14:00, 14:30, 15:00), NUNCA minutos quebrados (como 14:17 ou 15:47). Isso garante organização e previne que o horário expire enquanto o cliente responde. **REGRA ANTI-LOOP IMPORTANTE**: Se o cliente já possuir um agendamento ativo/confirmado listado em "AGENDAMENTOS ATIVOS DESTE CLIENTE NO BANCO DE DADOS" para o mesmo serviço, data e hora, você **NÃO DEVE** executar a função 'create_appointment' novamente! Apenas responda a ele de forma natural (por exemplo, se ele disser "Não" para o lembrete, apenas encerre a conversa amigavelmente ou pergunte se há algo mais a ajudar, sem chamar a função ou reenviar os dados do agendamento). Só execute a função se for para registrar um agendamento totalmente novo ou se ele pedir explicitamente para reagendar (mudar) o dia/hora.

REGRA CRÍTICA SOBRE PEDIDOS (COMPRAS): Quando o cliente quiser comprar ou pedir um ou mais produtos, use a função create_order para criar um pedido real no banco de dados. Se a função retornar que os pedidos estão pausados por emergência (orders_paused: true), você DEVE responder informando de forma extremamente simpática e polida que o pedido foi registrado com absoluto sucesso em nosso banco de dados, mas que no momento os nossos atendimentos para pedidos estão suspensos/pausados temporariamente devido a uma emergência ou manutenção, prometendo que ele será preparado com prioridade máxima assim que o sistema for retomado. Se a função retornar que o pedido foi criado fora do horário de atendimento (outside_hours: true), você DEVE responder de forma amigável informando que o pedido foi guardado/registrado com sucesso, mas que no momento estamos fora do horário de atendimento, e por isso ele será processado assim que iniciarmos o expediente. Caso contrário, se for dentro do horário, informe que o pagamento será feito diretamente no momento da entrega ou retirada (por ${paymentMethodsListStr}) — informe isso de forma clara, amigável e espaçada, e diga que o pedido foi enviado para preparação. Se o cliente solicitar especificações, observações ou preferências de corte para um produto após o pedido ser criado, você DEVE executar a função update_order_item_metadata para registrar essas preferências no banco de dados.

REGRA CRÍTICA SOBRE CANCELAMENTO DE PEDIDOS: Se o cliente expressamente solicitar o cancelamento, deleção, aborto ou desistência do seu pedido pendente (ex: "cancele meu pedido", "cancele por favor", "não quero mais comprar"), você DEVE executar a função cancel_order imediatamente para efetivar o cancelamento no banco de dados. Não tente apenas responder por texto — execute a função para que a alteração seja registrada.

${showProducts && productsList.length > 0 ? `PRODUTOS DISPONÍVEIS NO SISTEMA (CATÁLOGO OFICIAL E ÚNICO — USE SOMENTE ESTES):\n${productsList.map(p => `- ID DO PRODUTO: ${p.id} | [${p.category}] ${p.name}: R$ ${p.price} (Estoque: ${p.stock}) — ${p.description}`).join('\n')}\n` : 'PRODUTOS DISPONÍVEIS: NENHUM PRODUTO CADASTRADO NO SISTEMA. Você NÃO possui nenhum produto em seu catálogo no momento. Se o cliente perguntar por qualquer produto, preço, valor, disponibilidade ou estoque, responda que nosso catálogo de produtos ainda está sendo atualizado no sistema e que você não tem informações de preço/estoque para informar neste momento, mas que pode transferir o atendimento para um colaborador humano que poderá verificar diretamente.\n'}${showServices && servicesList.length > 0 ? `SERVIÇOS DISPONÍVEIS NO SISTEMA (CATÁLOGO OFICIAL E ÚNICO — USE SOMENTE ESTES):\n${servicesList.map(s => `- [${s.category}] ${s.name}: R$ ${s.price} (Duração: ${s.duration_minutes} min) — ${s.description}`).join('\n')}\n` : 'SERVIÇOS DISPONÍVEIS: NENHUM SERVIÇO CADASTRADO NO SISTEMA. Você NÃO possui nenhum serviço cadastrado no catálogo. Se o cliente perguntar por qualquer serviço, conserto, reparo ou orçamento, responda que nosso catálogo de serviços ainda está sendo atualizado no sistema e que você não tem informações de preço ou orçamento para passar neste momento, oferecendo transferir o atendimento para um atendente humano que poderá verificar diretamente.\n'}CONHECIMENTO ADICIONAL:
${kbMatches.length > 0 ? kbMatches.map(kb => `[${kb.title}]: ${kb.content}`).join('\n') : 'Nenhum conteúdo adicional.'}`;

    // 4. Build messages array
    const messagesPayload = [{ role: 'system', content: systemPrompt }];

    if (historyMessages.length > 0) {
      const lastMsg = historyMessages[historyMessages.length - 1];
      if (lastMsg.role === 'user' && lastMsg.content === messageText) {
        messagesPayload.push(...historyMessages);
      } else {
        messagesPayload.push(...historyMessages);
        messagesPayload.push({ role: 'user', content: messageText });
      }
    } else {
      messagesPayload.push({ role: 'user', content: messageText });
    }

    // 5. Build dynamic tools list based on active modules configuration
    const tools = [];
    if (activeModules.appointments !== false) {
      const apptTool = aiTools.find(t => t.function.name === 'create_appointment');
      if (apptTool) tools.push(apptTool);
    }
    if (activeModules.orders !== false && activeModules.products !== false) {
      const orderTool = aiTools.find(t => t.function.name === 'create_order');
      if (orderTool) tools.push(orderTool);

      const updateMetadataTool = aiTools.find(t => t.function.name === 'update_order_item_metadata');
      if (updateMetadataTool) tools.push(updateMetadataTool);

      const cancelOrderTool = aiTools.find(t => t.function.name === 'cancel_order');
      if (cancelOrderTool) tools.push(cancelOrderTool);
    }
    if (activeNiche === 'tech_repair') {
      const nexusTool = aiTools.find(t => t.function.name === 'check_nexus_os');
      if (nexusTool) tools.push(nexusTool);
    }

    // 6. First AI call with tool calling
    let reply;
    try {
      const chatCompletion = await openai.chat.completions.create({
        model,
        messages: messagesPayload,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        temperature: 0.45, // Balanced: precise enough for tool calling, creative enough for clean Portuguese
        max_tokens: 4096
      });

      const firstChoice = chatCompletion.choices[0];

      // 6. Handle tool calls
      if (firstChoice.message.tool_calls && firstChoice.message.tool_calls.length > 0) {
        console.log(`[AI Service] Tool calls requested: ${firstChoice.message.tool_calls.map(t => t.function.name).join(', ')}`);
        
        // OpenRouter Anthropic wrapper bug: message.content might contain leaked XML tags/junk.
        // We clean/nullify content for the assistant tool call message to conform to standard OpenAI API
        // and prevent the second completion turn from seeing raw XML/stuttering templates.
        const cleanAssistantMessage = {
          role: 'assistant',
          content: null,
          tool_calls: firstChoice.message.tool_calls
        };
        messagesPayload.push(cleanAssistantMessage);
        
        for (const toolCall of firstChoice.message.tool_calls) {
          let toolArgs = {};
          try { toolArgs = JSON.parse(toolCall.function.arguments); } catch {}
          
          // Enrich tool arguments with customer context details
          if (customerContext) {
            toolArgs.customer_phone = toolArgs.customer_phone || customerContext.phone;
            toolArgs.customer_name = toolArgs.customer_name || customerContext.name;
            toolArgs.customer_id = toolArgs.customer_id || customerContext.id;
          }

          const toolResult = await executeTool(toolCall.function.name, toolArgs, workspaceId);
          messagesPayload.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult
          });
        }

        const secondCompletion = await openai.chat.completions.create({
          model,
          messages: messagesPayload,
          temperature: 0.45, // Balanced for clean Portuguese output
          max_tokens: 4096
        });
        reply = secondCompletion.choices[0].message.content;

      } else {
        reply = firstChoice.message.content;

        // 7. FALLBACK: If the AI mentioned "agend" in reply but didn't call tool,
        //    try to extract and create the appointment separately
        const replyLower = (reply || '').toLowerCase();
        const schedulingKeywords = ['agend', 'marcad', 'reservad', 'confirm', 'horário marcado', 'dia marcado'];
        const mentionsScheduling = schedulingKeywords.some(kw => replyLower.includes(kw));

        if (mentionsScheduling && customerContext?.id && sentimentResult.intent === 'scheduling') {
          console.log('[AI Service] Tool call not triggered but scheduling intent detected — trying JSON extraction fallback...');
          const created = await tryExtractAndCreateAppointment(messagesPayload, workspaceId, customerContext.id);
          if (created) {
            console.log(`[AI Service] ✅ Fallback appointment created: ${created.appointment_id}`);
          }
        }
      }
    } catch (toolErr) {
      // If tool calling is not supported by model, fall back to no-tools call
      console.warn('[AI Service] Tool calling failed, retrying without tools:', toolErr.message);
      const fallbackCompletion = await openai.chat.completions.create({
        model,
        messages: messagesPayload,
        temperature: 0.7,
        max_tokens: 4096
      });
      reply = fallbackCompletion.choices[0].message.content;
    }

    const cleanedReply = cleanMessageContent(reply);

    return {
      reply: cleanedReply,
      intent: sentimentResult.intent,
      sentiment: sentimentResult.score,
      entities: sentimentResult.entities
    };

  } catch (error) {
    console.error('AI Service Error:', error);
    return {
      reply: 'Olá! Recebemos sua mensagem. Um atendente entrará em contato em breve para lhe ajudar.',
      intent: 'general_support',
      sentiment: 0.5,
      entities: {}
    };
  }
};

/**
 * Categorize intent and fetch sentiment
 */
const evaluateSentimentAndIntent = async (text) => {
  try {
    const chatCompletion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'Analyze this customer message. Return a raw JSON object with keys: "intent" (one of: greeting, scheduling, checkout, cancel, shipping, query, support), "score" (float 0.0-1.0 sentiment), and "entities" (key-value metadata). Return ONLY raw JSON, no markdown.'
        },
        { role: 'user', content: text }
      ],
      response_format: { type: 'json_object' }
    });

    const payload = JSON.parse(chatCompletion.choices[0].message.content);
    return {
      intent: payload.intent || 'support',
      score: payload.score !== undefined ? payload.score : 0.5,
      entities: payload.entities || {}
    };
  } catch (err) {
    return { intent: 'support', score: 0.5, entities: {} };
  }
};

/**
 * Searches pgvector embeddings inside Supabase database
 */
const searchKnowledgeBase = async (queryText, workspaceId) => {
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText
    });
    const queryVector = embeddingResponse.data[0].embedding;

    const { data, error } = await supabase.rpc('match_knowledge_base', {
      query_embedding: queryVector,
      match_threshold: 0.5,
      match_count: 3,
      filter_workspace_id: workspaceId
    });

    if (error) {
      console.warn('RPC Vector match missing, falling back to text query:', error.message);
      const { data: textData } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('workspace_id', workspaceId)
        .ilike('content', `%${queryText}%`)
        .limit(3);
      return textData || [];
    }
    return data || [];
  } catch (error) {
    try {
      const { data } = await supabase.from('knowledge_base').select('*').eq('workspace_id', workspaceId).limit(2);
      return data || [];
    } catch { return []; }
  }
};

module.exports = {
  processIncomingMessage,
  evaluateSentimentAndIntent,
  searchKnowledgeBase,
  createAppointmentInDB
};
