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

    // DOMAIN_<SUFFIX> is a comma-separated list of custom/storefront domains
    // (e.g. "kptll.com,kapitall-jakarta.myshopify.com") used for the CORS allowlist.
    const domains = (process.env[`DOMAIN_${suffix}`] || '')
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);

    map[value] = {
      token:      process.env[`SHOPIFY_ACCESS_TOKEN_${suffix}`],
      shop:       process.env[`SHOP_${suffix}`],
      apiVersion: process.env[`API_VERSION_${suffix}`] || process.env.API_VERSION || '2026-01',
      storeName:  suffix.toLowerCase(),
      domains,
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
 * Returns all domains that are configured (for CORS allowlist):
 *   - every store's myshopify domain (SHOP_*)
 *   - every custom/storefront domain (DOMAIN_*)
 * Returns bare hostnames (e.g. "kptll.com"); the caller prefixes the scheme.
 */
function getAllowedShops() {
  const domains = [DEFAULT_STORE.shop].filter(Boolean);
  for (const config of Object.values(TENANT_MAP)) {
    if (config.shop) domains.push(config.shop);
    if (config.domains) domains.push(...config.domains);
  }
  return [...new Set(domains)];
}

module.exports = { resolveTenant, DEFAULT_STORE, getAllowedShops };
