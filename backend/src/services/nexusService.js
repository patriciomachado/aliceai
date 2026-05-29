const axios = require('axios');
const { supabase } = require('../config/database');

/**
 * Technical Assistance Nexus ERP Integration Service
 */
const nexusService = {
  /**
   * Consult active O.S. (Ordem de Serviço) in Nexus by customer phone number
   */
  getOSByPhone: async (phone, workspaceId) => {
    try {
      // Get workspace settings to retrieve Nexus configuration
      const { data: workspace, error: wsErr } = await supabase
        .from('workspaces')
        .select('settings')
        .eq('id', workspaceId)
        .maybeSingle();

      if (wsErr || !workspace) {
        throw new Error('Workspace settings not found');
      }

      const settings = workspace.settings || {};
      const nexusApiUrl = settings.nexus_api_url;
      const nexusApiKey = settings.nexus_api_key;

      // Clean phone number (keep only digits)
      const cleanPhone = phone.replace(/\D/g, '');

      // Check if integration is configured
      if (!nexusApiUrl) {
        console.log(`[Nexus Service] Nexus API not configured for workspace ${workspaceId}. Returning elegant mock data for demo.`);
        return {
          success: true,
          is_mock: true,
          message: 'Integração com Nexus não configurada na aba de configurações. Retornando simulação de demonstração.',
          orders: [
            {
              os_number: 'NXS-2026-9810',
              device: 'MacBook Pro M1 (13 polegadas, 2020)',
              serial_number: 'C02DF890Q05D',
              reported_symptom: 'Bateria inchada e desligando sozinho com 20%',
              status: 'Aguardando Peças',
              status_details: 'Bateria nova original comprada com fornecedor autorizado. Prazo de entrega da peça pela transportadora de até 3 dias úteis.',
              estimated_price: 480.00,
              diagnostic_fee: 80.00,
              created_at: '2026-05-24T14:30:00Z',
              technician: 'Renato Silva'
            }
          ]
        };
      }

      console.log(`[Nexus Service] Fetching OS for customer ${cleanPhone} from Nexus API: ${nexusApiUrl}`);

      // Call the real Nexus API
      const response = await axios.get(`${nexusApiUrl}/api/os`, {
        params: { phone: cleanPhone },
        headers: {
          'Authorization': `Bearer ${nexusApiKey}`,
          'X-Workspace-ID': workspaceId,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      });

      return {
        success: true,
        is_mock: false,
        orders: response.data || []
      };

    } catch (err) {
      console.error('[Nexus Service] Error consulting Nexus OS:', err.message);
      return {
        success: false,
        error: `Erro ao consultar o Nexus: ${err.message}`,
        message: 'Ocorreu uma falha de conexão com o servidor Nexus.',
        orders: [] // Do not fabricate a fake order if the real API fails!
      };
    }
  },

  /**
   * Consult a specific O.S. (Ordem de Serviço) in Nexus by its OS number/ID
   */
  getOSByNumber: async (osNumber, workspaceId) => {
    try {
      // Get workspace settings to retrieve Nexus configuration
      const { data: workspace, error: wsErr } = await supabase
        .from('workspaces')
        .select('settings')
        .eq('id', workspaceId)
        .maybeSingle();

      if (wsErr || !workspace) {
        throw new Error('Workspace settings not found');
      }

      const settings = workspace.settings || {};
      const nexusApiUrl = settings.nexus_api_url;
      const nexusApiKey = settings.nexus_api_key;

      const cleanNumber = osNumber.trim();

      // Check if integration is configured
      if (!nexusApiUrl) {
        console.log(`[Nexus Service] Nexus API not configured for workspace ${workspaceId}. Returning elegant mock data for OS ${cleanNumber} in demo mode.`);
        // If they ask for 00022 specifically in demo/mock mode, return a gorgeous, realistic mock for OS 00022!
        if (cleanNumber.includes('22') || cleanNumber.includes('00022')) {
          return {
            success: true,
            is_mock: true,
            orders: [
              {
                os_number: '00022',
                device: 'iPhone 14 Pro Max (Deep Purple, 256GB)',
                serial_number: 'G01FJ902K01D',
                reported_symptom: 'Tela piscando e touch parou de responder após queda leve',
                status: 'Pronto para Retirada',
                status_details: 'Substituição do display original realizada com sucesso. Testes de touch, TrueTone e sensores aprovados. Garantia de 90 dias ativa.',
                estimated_price: 1200.00,
                diagnostic_fee: 100.00,
                created_at: '2026-05-25T10:00:00Z',
                technician: 'Renato Silva'
              }
            ]
          };
        }

        return {
          success: true,
          is_mock: true,
          message: 'Integração com Nexus não configurada na aba de configurações. Exibindo simulação de demonstração.',
          orders: []
        };
      }

      console.log(`[Nexus Service] Fetching OS number ${cleanNumber} from Nexus API: ${nexusApiUrl}`);

      // Call the real Nexus API with multiple query formats for compatibility (query, number, os_number)
      const response = await axios.get(`${nexusApiUrl}/api/os`, {
        params: { 
          number: cleanNumber,
          os_number: cleanNumber,
          query: cleanNumber
        },
        headers: {
          'Authorization': `Bearer ${nexusApiKey}`,
          'X-Workspace-ID': workspaceId,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      });

      // Also try fetching with /api/os/{number} if the list is empty just in case the API uses restful path
      let orders = response.data || [];
      if (!Array.isArray(orders) || orders.length === 0) {
        try {
          const restResponse = await axios.get(`${nexusApiUrl}/api/os/${cleanNumber}`, {
            headers: {
              'Authorization': `Bearer ${nexusApiKey}`,
              'X-Workspace-ID': workspaceId,
              'Content-Type': 'application/json'
            },
            timeout: 5000
          });
          if (restResponse.data) {
            orders = Array.isArray(restResponse.data) ? restResponse.data : [restResponse.data];
          }
        } catch (restErr) {
          console.log(`[Nexus Service] Restful endpoint /api/os/${cleanNumber} not supported or failed:`, restErr.message);
        }
      }

      return {
        success: true,
        is_mock: false,
        orders: Array.isArray(orders) ? orders : [orders]
      };

    } catch (err) {
      console.error('[Nexus Service] Error consulting Nexus OS by number:', err.message);
      return {
        success: false,
        error: `Erro ao consultar o Nexus: ${err.message}`,
        message: 'Ocorreu uma falha de conexão com o servidor Nexus.',
        orders: []
      };
    }
  },

  /**
   * Synchronize a newly created appointment from Alice to Nexus ERP
   */
  syncAppointmentToNexus: async (appointment, customer, workspaceId) => {
    try {
      // Get workspace settings to retrieve Nexus configuration
      const { data: workspace, error: wsErr } = await supabase
        .from('workspaces')
        .select('settings')
        .eq('id', workspaceId)
        .maybeSingle();

      if (wsErr || !workspace) {
        throw new Error('Workspace settings not found');
      }

      const settings = workspace.settings || {};
      const nexusApiUrl = settings.nexus_api_url;
      const nexusApiKey = settings.nexus_api_key;

      if (!nexusApiUrl) {
        console.log(`[Nexus Service] Nexus API not configured for workspace ${workspaceId}. Skipping API call, returning graceful mock sync success.`);
        return { success: true, is_mock: true, message: 'Nexus não configurado nas configurações. Simulação de sincronização com sucesso.' };
      }

      console.log(`[Nexus Service] Synchronizing appointment ${appointment.id} to Nexus ERP API: ${nexusApiUrl}`);

      // Call the real Nexus ERP API to create the appointment
      const response = await axios.post(`${nexusApiUrl}/api/appointments`, {
        appointment_id: appointment.id,
        service_type: appointment.service_type,
        scheduled_date: appointment.scheduled_date,
        scheduled_time: appointment.scheduled_time,
        notes: appointment.notes,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone || customer.whatsapp
        }
      }, {
        headers: {
          'Authorization': `Bearer ${nexusApiKey}`,
          'X-Workspace-ID': workspaceId,
          'Content-Type': 'application/json'
        },
        timeout: 8500
      });

      return {
        success: true,
        is_mock: false,
        data: response.data
      };

    } catch (err) {
      console.error('[Nexus Service] syncAppointmentToNexus error:', err.message);
      return {
        success: false,
        error: `Erro ao enviar agendamento para o Nexus: ${err.message}`,
        message: 'Ocorreu uma falha ao sincronizar o agendamento com o Nexus. Salvo localmente para re-tentativa.'
      };
    }
  },

  /**
   * Synchronize catalog from Nexus ERP to Alice Database
   */
  syncCatalog: async (items, workspaceId) => {
    try {
      if (!Array.isArray(items)) {
        throw new Error('Catalog items payload must be an array');
      }

      console.log(`[Nexus Service] Starting sync of ${items.length} items for workspace ${workspaceId}`);

      const results = { created: 0, updated: 0, failed: 0 };

      for (const item of items) {
        try {
          const {
            name,
            description,
            price,
            stock = 0,
            category = 'Nexus Sync',
            sku
          } = item;

          if (!name || price === undefined || price === null || isNaN(price)) {
            results.failed++;
            continue;
          }

          // Check if product already exists by SKU or Name in this workspace
          let existingQuery = supabase
            .from('products')
            .select('id')
            .eq('workspace_id', workspaceId);

          if (sku) {
            existingQuery = existingQuery.eq('sku', sku);
          } else {
            existingQuery = existingQuery.eq('name', name);
          }

          const { data: existing, error: existErr } = await existingQuery.maybeSingle();

          if (existErr) throw existErr;

          if (existing) {
            // Update existing product
            const { error: updErr } = await supabase
              .from('products')
              .update({
                name,
                description,
                price: parseFloat(price),
                stock: parseInt(stock),
                category,
                sku: sku || `NXS-${Date.now()}`
              })
              .eq('id', existing.id);

            if (updErr) throw updErr;
            results.updated++;
          } else {
            // Insert new product
            const { error: insErr } = await supabase
              .from('products')
              .insert({
                workspace_id: workspaceId,
                name,
                description,
                price: parseFloat(price),
                stock: parseInt(stock),
                category,
                sku: sku || `NXS-${Date.now()}`
              });

            if (insErr) throw insErr;
            results.created++;
          }
        } catch (itemErr) {
          console.error(`[Nexus Service] Item sync failed: ${item.name || 'Unknown'}`, itemErr.message);
          results.failed++;
        }
      }

      return { success: true, results };
    } catch (err) {
      console.error('[Nexus Service] syncCatalog error:', err.message);
      return { success: false, error: err.message };
    }
  }
};

module.exports = nexusService;
