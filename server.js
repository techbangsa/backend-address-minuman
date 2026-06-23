const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const { getAllowedShops } = require('./utils/tenantResolver');
const tenantMiddleware   = require('./middleware/tenantMiddleware');

const app = express();

// ── CORS — built dynamically from all configured stores ──────────────────────
const STATIC_ORIGINS = [
  'https://www.minuman.com',
  'https://minuman.com',
];

// Add every configured domain (SHOP_* + DOMAIN_*) as an https origin.
// For custom (non-myshopify) apex domains, also allow the www. variant.
const shopOrigins = getAllowedShops().flatMap(domain => {
  const origins = [`https://${domain}`];
  if (!/\.myshopify\.com$/.test(domain) && !domain.startsWith('www.')) {
    origins.push(`https://www.${domain}`);
  }
  return origins;
});
const ALLOWED_ORIGINS = [...new Set([...STATIC_ORIGINS, ...shopOrigins])];

function isOriginAllowed(origin) {
  if (!origin) return true; // allow server-to-server / curl
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/\.myshopify\.com$/.test(origin)) return true;
  return false;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'backend-address-minuman' });
});

// ── Routes ───────────────────────────────────────────────────────────────────
// tenantMiddleware runs first to resolve req.storeConfig from req.body.request_from
const addressRoutes = require('./routes/address');
app.use('/api/address', tenantMiddleware, addressRoutes);

const customerRoutes = require('./routes/customer');
app.use('/api/customer', tenantMiddleware, customerRoutes);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Default shop: ${process.env.SHOP}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
