const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const whatsappService = require('../../services/whatsappService');

/**
 * GET /api/whatsapp/status
 * Fetches the current WhatsApp Web QR Code or connection status
 */
router.get('/status', requireAuth, (req, res) => {
  const workspaceId = req.workspaceId;
  res.json(whatsappService.getStatus(workspaceId));
});

/**
 * GET /api/whatsapp/qrcode
 * Alias for status to fetch QR code
 */
router.get('/qrcode', requireAuth, (req, res) => {
  const workspaceId = req.workspaceId;
  res.json(whatsappService.getStatus(workspaceId));
});

/**
 * POST /api/whatsapp/connect
 * Forces a fresh QR Code generation. Clears any existing session and starts a new connection.
 */
router.post('/connect', requireAuth, async (req, res) => {
  const workspaceId = req.workspaceId;
  if (!workspaceId) {
    return res.status(400).json({ error: 'Workspace ID is required to start a WhatsApp connection.' });
  }
  // Always force a fresh QR by clearing existing session first
  whatsappService.forceNewQrCode(workspaceId).catch(err => {
    console.error('[WhatsApp Route] forceNewQrCode error:', err);
  });
  res.json({ success: true, message: 'Generating fresh WhatsApp QR Code...' });
});

/**
 * POST /api/whatsapp/disconnect
 * Logs out and clears the active session keys
 */
router.post('/disconnect', requireAuth, (req, res) => {
  const workspaceId = req.workspaceId;
  whatsappService.clearSession(workspaceId);
  res.json({ success: true, message: 'WhatsApp session cleared.' });
});

module.exports = router;
