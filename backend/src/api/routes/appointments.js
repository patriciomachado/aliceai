const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../../config/database');
const { validate } = require('../middleware/validation');
const { z } = require('zod');

const appointmentSchema = z.object({
  customer_id: z.string().uuid('Invalid customer id'),
  service_type: z.string().min(1, 'Service type is required'),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Scheduled date must match YYYY-MM-DD'),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Scheduled time must match HH:MM'),
  duration_minutes: z.number().int().positive().default(60),
  notes: z.string().optional().nullable()
});

/**
 * GET /api/appointments
 * List appointments
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { date } = req.query;
    let query = supabase
      .from('appointments')
      .select('*, customers(*)')
      .eq('workspace_id', req.workspaceId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (date) {
      query = query.eq('scheduled_date', date);
    }

    const { data: appointments, error } = await query;
    if (error) throw error;

    res.json(appointments);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/appointments
 * Create appointment
 */
router.post('/', requireAuth, validate(appointmentSchema), async (req, res, next) => {
  try {
    const { customer_id, service_type, scheduled_date, scheduled_time, duration_minutes, notes } = req.body;

    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        workspace_id: req.workspaceId,
        customer_id,
        service_type,
        scheduled_date,
        scheduled_time,
        duration_minutes,
        notes,
        status: 'scheduled',
        google_calendar_event_id: `gcal_${Date.now()}` // Mock-ready event registration
      })
      .select('*, customers(*)')
      .single();

    if (error) throw error;

    // Trigger background automation workflow
    try {
      const automationService = require('../../services/automationService');
      automationService.trigger('appointment_booked', {
        appointment,
        customer: appointment.customers
      }, req.workspaceId);
    } catch (autoErr) {
      console.error('[Appointments Route] Automation trigger error:', autoErr.message);
    }

    res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/appointments/:id
 * Update appointment details
 */
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { customer_id, service_type, scheduled_date, scheduled_time, duration_minutes, notes, status } = req.body;

    const updatePayload = {};
    if (customer_id !== undefined) updatePayload.customer_id = customer_id;
    if (service_type !== undefined) updatePayload.service_type = service_type;
    if (scheduled_date !== undefined) updatePayload.scheduled_date = scheduled_date;
    if (scheduled_time !== undefined) updatePayload.scheduled_time = scheduled_time;
    if (duration_minutes !== undefined) updatePayload.duration_minutes = duration_minutes;
    if (notes !== undefined) updatePayload.notes = notes;
    if (status !== undefined) updatePayload.status = status;

    const { data: appointment, error } = await supabase
      .from('appointments')
      .update(updatePayload)
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId)
      .select('*, customers(*)')
      .single();

    if (error || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(appointment);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/appointments/:id
 * Cancels or deletes appointment
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { permanent } = req.query;
    console.log('[DELETE APPOINTMENT] ID:', req.params.id, 'WorkspaceId:', req.workspaceId, 'Permanent:', permanent);

    if (permanent === 'true') {
      const dbRes = await supabase
        .from('appointments')
        .delete()
        .eq('id', req.params.id)
        .eq('workspace_id', req.workspaceId);

      console.log('[DELETE APPOINTMENT] Supabase Response Status:', dbRes.status, 'Error:', dbRes.error);
      if (dbRes.error) throw dbRes.error;
      res.json({ success: true, message: 'Appointment permanently deleted' });
    } else {
      const dbRes = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', req.params.id)
        .eq('workspace_id', req.workspaceId);

      console.log('[CANCEL APPOINTMENT] Supabase Response Status:', dbRes.status, 'Error:', dbRes.error);
      if (dbRes.error) throw dbRes.error;
      res.json({ success: true, message: 'Appointment cancelled successfully' });
    }
  } catch (error) {
    console.error('[DELETE/CANCEL APPOINTMENT] Error:', error);
    next(error);
  }
});

/**
 * GET /api/appointments/availability
 * Simulates calendar slots availability checking
 */
router.get('/availability', requireAuth, (req, res) => {
  const { date } = req.query;
  const timeSlots = [
    '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'
  ];
  
  // Return standard slots map
  res.json({
    date: date || new Date().toISOString().split('T')[0],
    availableSlots: timeSlots
  });
});

module.exports = router;
