const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const analyticsService = require('../../services/analyticsService');

/**
 * GET /api/analytics/dashboard
 * Retrieves compilation of critical workspace KPIs
 */
router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    const kpis = await analyticsService.compileDashboardKPIs(req.workspaceId);
    res.json(kpis);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/conversations
 * Fetch comparative logs of sentiment analysis metrics over time
 */
router.get('/conversations', requireAuth, (req, res) => {
  // Simulates monthly trend charts for chart layouts
  const data = [
    { name: 'Seg', sentiment: 0.72, volume: 45 },
    { name: 'Ter', sentiment: 0.81, volume: 55 },
    { name: 'Qua', sentiment: 0.79, volume: 62 },
    { name: 'Qui', sentiment: 0.85, volume: 48 },
    { name: 'Sex', sentiment: 0.88, volume: 70 },
    { name: 'Sab', sentiment: 0.92, volume: 30 },
    { name: 'Dom', sentiment: 0.90, volume: 15 }
  ];
  res.json(data);
});

/**
 * GET /api/analytics/export
 * Simulates CSV format data export pipeline logs
 */
router.get('/export', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=alice_analytics_report.csv');
  
  const csvContent = `Data,Indicador,Valor\n2026-05-20,Vendas,1250.00\n2026-05-21,Vendas,3480.00\n2026-05-22,Vendas,8120.00`;
  res.send(csvContent);
});

module.exports = router;
