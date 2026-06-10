const express = require('express');
const { findCustomerByEmail, setCustomerMetafield } = require('../utils/shopifyGraphQL');

const router = express.Router();

/**
 * POST /api/customer/krisflyer
 *
 * Saves the KrisFlyer ID to the customer metafield my_fields.krisflyer
 * (single line text). Called from the cart page in the theme.
 *
 * Body:
 * {
 *   "request_from": "kapittal",          // optional — omit for minuman (default store)
 *   "customerId": "7234567890",          // preferred — numeric customer id from Liquid
 *   "email": "customer@example.com",     // fallback lookup when customerId missing
 *   "krisflyer": "1234567890"
 * }
 */
router.post('/krisflyer', async (req, res) => {
  try {
    const { customerId, email, krisflyer } = req.body;
    const storeConfig = req.storeConfig;

    const value = krisflyer != null ? String(krisflyer).trim() : '';
    if (!value) {
      return res.status(400).json({ success: false, error: 'krisflyer is required' });
    }

    let ownerId = null;

    if (customerId) {
      const numericId = String(customerId).replace(/\D/g, '');
      if (numericId) ownerId = `gid://shopify/Customer/${numericId}`;
    }

    if (!ownerId) {
      if (!email) {
        return res.status(400).json({ success: false, error: 'customerId or email is required' });
      }
      const customer = await findCustomerByEmail(email, storeConfig);
      if (!customer) {
        return res.status(404).json({ success: false, error: 'Customer not found in Shopify' });
      }
      ownerId = customer.id;
    }

    console.log(`[Customer][${storeConfig.storeName}] Saving krisflyer metafield for ${ownerId}`);

    const result = await setCustomerMetafield(
      ownerId,
      { namespace: 'my_fields', key: 'krisflyer', value },
      storeConfig
    );

    const userErrors = result?.data?.metafieldsSet?.userErrors;
    if (userErrors && userErrors.length > 0) {
      console.error('[Customer] userErrors:', userErrors);
      return res.status(400).json({ success: false, error: userErrors[0].message, userErrors });
    }

    return res.json({
      success: true,
      metafield: result?.data?.metafieldsSet?.metafields?.[0],
    });
  } catch (err) {
    console.error('[Customer] Error saving krisflyer metafield:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

module.exports = router;
