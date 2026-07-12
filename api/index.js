/**
 * Alice API — Vercel Serverless Entrypoint
 * --------------------------------------------------------------
 * Exposes the Express app as a Vercel serverless function.
 * Long-running parts (WhatsApp Baileys, Bull queue, reminder
 * scheduler) are NOT loaded here — they live in
 * `backend/src/worker.js`, deployed to a separate host
 * (Render / Railway / Fly.io / VPS).
 *
 * Vercel routes (configured in `vercel.json`):
 *   /api/*   -> this file
 *   /*       -> frontend (Vite SPA)
 */

process.env.VERCEL = '1';
require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

const path = require('path');

// Force dotenv to also pick up the backend's .env if frontend has none
try { require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') }); } catch {}

const app = require('../backend/src/app');

module.exports = app;
module.exports.default = app;
