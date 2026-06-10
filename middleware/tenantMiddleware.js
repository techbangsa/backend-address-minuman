const { resolveTenant } = require('../utils/tenantResolver');

/**
 * Resolves which Shopify store to use based on req.body.request_from:
 *   - absent or empty → default store (minuman)
 *   - matches a REQUEST_FROM_* env value → that store's credentials
 *   - unknown value → 403
 *
 * On success, attaches req.storeConfig = { token, shop, apiVersion, storeName }
 */
function tenantMiddleware(req, res, next) {
  const requestFrom = req.body?.request_from || null;
  const storeConfig = resolveTenant(requestFrom);

  if (!storeConfig) {
    return res.status(403).json({
      success: false,
      error: `Access denied: unknown store "${requestFrom}"`,
    });
  }

  req.storeConfig = storeConfig;
  next();
}

module.exports = tenantMiddleware;
