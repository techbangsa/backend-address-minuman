const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// ── CORS — manual handler to guarantee preflight works ──
const ALLOWED_ORIGINS = [
  'https://minumancom.myshopify.com',
  'https://www.minuman.com',
  'https://minuman.com',
];

function isOriginAllowed(origin) {
  if (!origin) return true; // allow server-to-server / curl
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/\.myshopify\.com$/.test(origin)) return true;
  return false;
}

// Apply CORS headers to EVERY request (including OPTIONS preflight)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Respond to preflight immediately
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json());

// ── Health check ─────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'backend-address-minuman' });
});

// ── Routes ───────────────────────────────────────
const addressRoutes = require('./routes/address');
app.use('/api/address', addressRoutes);

// ── Start ────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`SHOP: ${process.env.SHOP}`);
  console.log(`API_VERSION: ${process.env.API_VERSION}`);
});