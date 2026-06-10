const dotenv = require('dotenv');
dotenv.config();

const DEFAULT_STORE = {
  token:      process.env.SHOPIFY_ACCESS_TOKEN,
  shop:       process.env.SHOP,
  apiVersion: process.env.API_VERSION || '2026-01',
  storeName:  'minuman',
};

// Build map: requestFromValue → storeConfig
// Scans all REQUEST_FROM_<SUFFIX> env vars at startup
function buildTenantMap() {
  const map = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('REQUEST_FROM_') || !value) continue;

    const suffix = key.slice('REQUEST_FROM_'.length); // e.g. "KAPITTALL"
    map[value] = {
      token:      process.env[`SHOPIFY_ACCESS_TOKEN_${suffix}`],
      shop:       process.env[`SHOP_${suffix}`],
      apiVersion: process.env[`API_VERSION_${suffix}`] || process.env.API_VERSION || '2026-01',
      storeName:  suffix.toLowerCase(),
    };
  }

  return map;
}

const TENANT_MAP = buildTenantMap();

/**
 * Resolve a storeConfig from the request_from value.
 *   - undefined/null → default store (minuman)
 *   - known value    → matched store config
 *   - unknown value  → null (caller should return 403)
 */
function resolveTenant(requestFrom) {
  if (!requestFrom) return DEFAULT_STORE;
  return TENANT_MAP[requestFrom] || null;
}

/**
 * Returns all shop domains that are configured (for CORS allowlist).
 */
function getAllowedShops() {
  const shops = [DEFAULT_STORE.shop].filter(Boolean);
  for (const config of Object.values(TENANT_MAP)) {
    if (config.shop) shops.push(config.shop);
  }
  return shops;
}

module.exports = { resolveTenant, DEFAULT_STORE, getAllowedShops };
