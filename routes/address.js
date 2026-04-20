const express = require('express');
const {
  findCustomerByEmail,
  createCustomerAddress,
  updateCustomerAddress,
  updateCustomerDefaultAddress,
} = require('../utils/shopifyGraphQL');

const router = express.Router();

/**
 * POST /api/address/save
 *
 * Body:
 * {
 *   "email": "customer@example.com",
 *   "address": {
 *     "formatted": "Jl. Raya Kuta No.1, Kuta, Kec. Kuta, Kabupaten Badung, Bali 80361, Indonesia",
 *     "lat": -8.7234,
 *     "lng": 115.1700,
 *     "extra": "Floor 3, near lobby"
 *   }
 * }
 *
 * Flow:
 *   1. Find customer by email via Shopify Admin GraphQL
 *   2. If customer has a default address → update it
 *   3. If customer has no addresses → create one and set as default
 */
router.post('/save', async (req, res) => {
  try {
    const { email, address, action, addressId } = req.body;

    // ── Validation ───────────────────────────────
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    if (!address || !address.formatted) {
      return res.status(400).json({ success: false, error: 'Address is required' });
    }

    // ── Find customer ────────────────────────────
    const customer = await findCustomerByEmail(email);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found in Shopify' });
    }

    console.log(`[Address] Found customer ${customer.id} (${customer.email})`);

    let result;

    // ── Explicit UPDATE: only when frontend sends action:"update" + addressId ──
    if (action === 'update' && addressId) {
      console.log(`[Address] Updating address: ${addressId}`);
      result = await updateCustomerAddress(
        customer.id,
        addressId,
        address
      );

      const userErrors = result?.data?.customerAddressUpdate?.userErrors;
      if (userErrors && userErrors.length > 0) {
        console.error('[Address] userErrors:', userErrors);
        return res.status(400).json({ success: false, error: userErrors[0].message, userErrors });
      }

      return res.json({
        success: true,
        action: 'updated',
        address: result?.data?.customerAddressUpdate?.address,
      });
    } else {
      // ── Default: always CREATE a new address ─────────────────────
      console.log(`[Address] Creating new address for customer: ${customer.id}`);
      result = await createCustomerAddress(customer.id, address);

      const userErrors = result?.data?.customerAddressCreate?.userErrors;
      if (userErrors && userErrors.length > 0) {
        console.error('[Address] userErrors:', userErrors);
        return res.status(400).json({ success: false, error: userErrors[0].message, userErrors });
      }

      const newAddress = result?.data?.customerAddressCreate?.address;

      // Set the new address as default if customer had no addresses before
      if (newAddress && newAddress.id && !customer.defaultAddress) {
        await updateCustomerDefaultAddress(customer.id, newAddress.id);
      }

      return res.json({
        success: true,
        action: 'created',
        address: newAddress,
      });
    }
  } catch (err) {
    console.error('[Address] Error saving address:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/**
 * POST /api/address/set-default
 *
 * Body:
 * {
 *   "email": "customer@example.com",
 *   "addressId": "gid://shopify/MailingAddress/123456"
 * }
 *
 * Sets the specified address as the customer's default address in Shopify.
 */
router.post('/set-default', async (req, res) => {
  try {
    const { email, addressId } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    if (!addressId) {
      return res.status(400).json({ success: false, error: 'Address ID is required' });
    }

    const customer = await findCustomerByEmail(email);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found in Shopify' });
    }

    console.log(`[Address] Setting default address for ${customer.id}: ${addressId}`);

    // Find the matching address from customer's addresses to get the GID
    const matchedAddress = customer.addresses.find(a => {
      // Compare by numeric ID (addressId from frontend is numeric, Shopify uses GID)
      // GID format: gid://shopify/MailingAddress/12345?customer_id=...
      const numericId = String(addressId);
      return a.id === addressId || a.id.includes('/' + numericId + '?') || a.id.endsWith('/' + numericId);
    });

    if (!matchedAddress) {
      return res.status(404).json({ success: false, error: 'Address not found for this customer' });
    }

    const result = await updateCustomerDefaultAddress(customer.id, matchedAddress.id);

    const userErrors = result?.data?.customerUpdateDefaultAddress?.userErrors;
    if (userErrors && userErrors.length > 0) {
      console.error('[Address] userErrors:', userErrors);
      return res.status(400).json({ success: false, error: userErrors[0].message, userErrors });
    }

    return res.json({
      success: true,
      action: 'default_updated',
      defaultAddress: result?.data?.customerUpdateDefaultAddress?.customer?.defaultAddress,
    });
  } catch (err) {
    console.error('[Address] Error setting default address:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

module.exports = router;
