const { supabase } = require('../config/database');

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

const formatBrazilDate = (dateStr) => {
  const parts = dateStr.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const checkAndSendReminders = async () => {
  try {
    console.log('[Reminder Service] Running periodic appointment reminder check...');
    
    // 1. Fetch all active workspaces
    const { data: workspaces, error: wsErr } = await supabase
      .from('workspaces')
      .select('id, settings');

    if (wsErr || !workspaces) {
      console.error('[Reminder Service] Error fetching workspaces:', wsErr?.message);
      return;
    }

    for (const ws of workspaces) {
      const settings = ws.settings || {};
      
      // If appointments module is disabled, skip
      if (settings.modules?.appointments === false) {
        continue;
      }

      const reminderLeadHours = parseInt(settings.appointment_reminder_lead_hours, 10) !== undefined
        ? parseInt(settings.appointment_reminder_lead_hours, 10)
        : 2;

      if (reminderLeadHours <= 0) {
        continue; // Reminders disabled
      }

      // 2. Fetch active scheduled/confirmed appointments for this workspace
      const { data: appointments, error: apptErr } = await supabase
        .from('appointments')
        .select('*, customers(id, name, phone, whatsapp)')
        .eq('workspace_id', ws.id)
        .in('status', ['scheduled', 'confirmed']);

      if (apptErr || !appointments) {
        continue;
      }

      const { dateStr: currentBrDate, timeStr: currentBrTime } = getBrazilDateTime();
      const [curYear, curMonth, curDay] = currentBrDate.split('-').map(Number);
      const [curHour, curMin] = currentBrTime.split(':').map(Number);
      const nowBr = new Date(curYear, curMonth - 1, curDay, curHour, curMin);

      for (const appt of appointments) {
        const notes = appt.notes || '';
        
        // Skip if reminder has already been marked sent in notes
        if (notes.includes('[REMINDER_SENT]')) {
          continue;
        }

        // Construct appointment datetime object in Brazil timezone
        const [schYear, schMonth, schDay] = appt.scheduled_date.split('-').map(Number);
        const [schHour, schMin] = appt.scheduled_time.split(':').map(Number);
        const scheduledBr = new Date(schYear, schMonth - 1, schDay, schHour, schMin);

        // Difference in hours
        const diffMs = scheduledBr - nowBr;
        const diffHours = diffMs / (1000 * 60 * 60);

        // Send reminder if difference is between 0 and reminderLeadHours
        if (diffHours > 0 && diffHours <= reminderLeadHours) {
          const customer = appt.customers;
          if (!customer) continue;

          const customerName = customer.name || 'Cliente';
          const phone = customer.phone || customer.whatsapp;

          if (!phone) {
            console.warn(`[Reminder Service] Skip Send: Customer phone not found for appointment ID: ${appt.id}`);
            continue;
          }

          const cleanedPhone = phone.replace(/\D/g, '');
          if (!cleanedPhone) continue;

          const formattedDate = formatBrazilDate(appt.scheduled_date);
          const formattedTime = appt.scheduled_time.slice(0, 5);

          const message = `Olá, *${customerName}*! Passando para te lembrar do seu agendamento de *${appt.service_type}* marcado para *${formattedDate}* às *${formattedTime}*. Estamos te esperando! 🕒`;

          console.log(`[Reminder Service] Sending reminder for appointment ${appt.id} to ${customerName} (${cleanedPhone})...`);

          // Resilient message sending (WhatsApp Web Socket first, then Meta Graph API fallback)
          let success = false;
          try {
            const whatsappService = require('./whatsappService');
            if (whatsappService && typeof whatsappService.sendMessageJid === 'function') {
              success = await whatsappService.sendMessageJid(ws.id, cleanedPhone, message);
            }
          } catch (wsErr) {
            console.warn('[Reminder Service] WhatsApp Web Socket not connected:', wsErr.message);
          }

          if (success) {
            console.log(`[Reminder Service] Reminder sent successfully via WhatsApp Web Socket to ${cleanedPhone}.`);
          } else {
            console.log('[Reminder Service] Web Socket failed. Routing reminder via Meta Graph API...');
            try {
              const connectorService = require('./connectorService');
              if (connectorService && typeof connectorService.sendMessage === 'function') {
                const res = await connectorService.sendMessage(cleanedPhone, message, 'whatsapp');
                console.log('[Reminder Service] Message routed via Meta Graph API:', res);
                success = true;
              }
            } catch (connErr) {
              console.error('[Reminder Service] Meta Graph API fallback failed:', connErr.message);
            }
          }

          // 3. Mark reminder as sent by appending [REMINDER_SENT] to notes
          const newNotes = notes ? `${notes} [REMINDER_SENT]` : '[REMINDER_SENT]';
          const { error: updateErr } = await supabase
            .from('appointments')
            .update({ notes: newNotes })
            .eq('id', appt.id);

          if (updateErr) {
            console.error(`[Reminder Service] Failed to update appointment notes for ID ${appt.id}:`, updateErr.message);
          } else {
            console.log(`[Reminder Service] Appointment ID ${appt.id} successfully marked as reminder sent.`);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Reminder Service Error] Check failed:', err.message);
  }
};

// Start periodic interval scanning
const startScheduler = (intervalMs = 60000) => { // Default to every 1 minute
  console.log('[Reminder Service] Initializing periodic appointment reminder scheduler...');
  setInterval(checkAndSendReminders, intervalMs);
};

module.exports = {
  checkAndSendReminders,
  startScheduler
};
