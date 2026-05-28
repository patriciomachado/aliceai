const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../../config/database');
const nexusService = require('../../services/nexusService');

/**
 * POST /api/integrations/nexus/sync
 * Sincronização de catálogo enviada pelo Nexus
 */
router.post('/nexus/sync', async (req, res, next) => {
  try {
    const { items, workspace_id } = req.body;
    let finalWorkspaceId = workspace_id || req.workspaceId;

    // Check header x-nexus-key for automated external calls from Nexus ERP
    const nexusKeyHeader = req.headers['x-nexus-key'];
    if (nexusKeyHeader && !finalWorkspaceId) {
      const { data: workspaces, error: wsErr } = await supabase
        .from('workspaces')
        .select('id, settings');

      if (wsErr) throw wsErr;

      const matchedWs = workspaces.find(w => w.settings?.nexus_api_key === nexusKeyHeader);
      if (matchedWs) {
        finalWorkspaceId = matchedWs.id;
      }
    }

    if (!finalWorkspaceId) {
      return res.status(401).json({ 
        error: 'Não autorizado. Forneça o token de autenticação ou a chave x-nexus-key correspondente nos cabeçalhos.' 
      });
    }

    const syncResult = await nexusService.syncCatalog(items, finalWorkspaceId);
    if (!syncResult.success) {
      return res.status(400).json(syncResult);
    }

    res.json(syncResult);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
