const express = require('express');
const {
  findCustomerByEmail,
  createCustomerAddress,
  updateCustomerAddress,
  updateCustomerDefaultAddress,
  deleteCustomerAddress,
} = require('../utils/shopifyGraphQL');

const router = express.Router();

/**
 * POST /api/address/save
 *
 * Body:
 * {
 *   "request_from": "kapittal",          // optional — omit for minuman (default store)
 *   "email": "customer@example.com",
 *   "address": {
 *     "formatted": "Jl. Raya Kuta No.1, Kuta, Kec. Kuta, Kabupaten Badung, Bali 80361, Indonesia",
 *     "lat": -8.7234,
 *     "lng": 115.1700,
 *     "extra": "Floor 3, near lobby"
 *   }
 * }
 */
router.post('/save', async (req, res) => {
  try {
    const { email, address, action, addressId } = req.body;
    const storeConfig = req.storeConfig;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    if (!address || !address.formatted) {
      return res.status(400).json({ success: false, error: 'Address is required' });
    }

    const customer = await findCustomerByEmail(email, storeConfig);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found in Shopify' });
    }

    console.log(`[Address][${storeConfig.storeName}] Found customer ${customer.id} (${customer.email})`);

    let result;

    if (action === 'update' && addressId) {
      console.log(`[Address][${storeConfig.storeName}] Updating address: ${addressId}`);
      result = await updateCustomerAddress(customer.id, addressId, address, storeConfig);

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
      console.log(`[Address][${storeConfig.storeName}] Creating new address for customer: ${customer.id}`);
      result = await createCustomerAddress(customer.id, address, storeConfig);

      const userErrors = result?.data?.customerAddressCreate?.userErrors;
      if (userErrors && userErrors.length > 0) {
        console.error('[Address] userErrors:', userErrors);
        return res.status(400).json({ success: false, error: userErrors[0].message, userErrors });
      }

      const newAddress = result?.data?.customerAddressCreate?.address;

      if (newAddress && newAddress.id && !customer.defaultAddress) {
        await updateCustomerDefaultAddress(customer.id, newAddress.id, storeConfig);
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
 *   "request_from": "kapittal",          // optional
 *   "email": "customer@example.com",
 *   "addressId": "gid://shopify/MailingAddress/123456"
 * }
 */
router.post('/set-default', async (req, res) => {
  try {
    const { email, addressId } = req.body;
    const storeConfig = req.storeConfig;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    if (!addressId) {
      return res.status(400).json({ success: false, error: 'Address ID is required' });
    }

    const customer = await findCustomerByEmail(email, storeConfig);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found in Shopify' });
    }

    console.log(`[Address][${storeConfig.storeName}] Setting default address for ${customer.id}: ${addressId}`);

    const numericId = String(addressId);
    const matchedAddress = customer.addresses.find(a =>
      a.id === addressId ||
      a.id.includes('/' + numericId + '?') ||
      a.id.endsWith('/' + numericId)
    );

    if (!matchedAddress) {
      return res.status(404).json({ success: false, error: 'Address not found for this customer' });
    }

    const result = await updateCustomerDefaultAddress(customer.id, matchedAddress.id, storeConfig);

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

/**
 * POST /api/address/update
 *
 * Body:
 * {
 *   "request_from": "kapittal",          // optional
 *   "email": "customer@example.com",
 *   "addressId": "12345678",
 *   "address": { ... }
 * }
 */
router.post('/update', async (req, res) => {
  try {
    const { email, addressId, address } = req.body;
    const storeConfig = req.storeConfig;

    if (!email)     return res.status(400).json({ success: false, error: 'Email is required' });
    if (!addressId) return res.status(400).json({ success: false, error: 'Address ID is required' });
    if (!address)   return res.status(400).json({ success: false, error: 'Address data is required' });

    const customer = await findCustomerByEmail(email, storeConfig);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found in Shopify' });
    }

    const numericId = String(addressId);
    const matched = customer.addresses.find(a =>
      a.id === addressId ||
      a.id.includes('/' + numericId + '?') ||
      a.id.endsWith('/' + numericId)
    );

    if (!matched) {
      return res.status(404).json({ success: false, error: 'Address not found for this customer' });
    }

    console.log(`[Address][${storeConfig.storeName}] Updating address ${matched.id} for customer ${customer.id}`);

    const result = await updateCustomerAddress(customer.id, matched.id, address, storeConfig);

    const userErrors = result?.data?.customerAddressUpdate?.userErrors;
    if (userErrors && userErrors.length > 0) {
      console.error('[Address] userErrors:', userErrors);
      return res.status(400).json({ success: false, error: userErrors[0].message, userErrors });
    }

    return res.json({
      success: true,
      address: result?.data?.customerAddressUpdate?.address,
    });
  } catch (err) {
    console.error('[Address] Error updating address:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/**
 * POST /api/address/delete
 *
 * Body:
 * {
 *   "request_from": "kapittal",          // optional
 *   "email": "customer@example.com",
 *   "addressId": "12345678"
 * }
 */
router.post('/delete', async (req, res) => {
  try {
    const { email, addressId } = req.body;
    const storeConfig = req.storeConfig;

    if (!email)     return res.status(400).json({ success: false, error: 'Email is required' });
    if (!addressId) return res.status(400).json({ success: false, error: 'Address ID is required' });

    const customer = await findCustomerByEmail(email, storeConfig);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found in Shopify' });
    }

    const numericId = String(addressId);
    const matched = customer.addresses.find(a =>
      a.id === addressId ||
      a.id.includes('/' + numericId + '?') ||
      a.id.endsWith('/' + numericId)
    );

    if (!matched) {
      return res.status(404).json({ success: false, error: 'Address not found for this customer' });
    }

    console.log(`[Address][${storeConfig.storeName}] Deleting address ${matched.id} for customer ${customer.id}`);

    const result = await deleteCustomerAddress(customer.id, matched.id, storeConfig);

    const userErrors = result?.data?.customerAddressDelete?.userErrors;
    if (userErrors && userErrors.length > 0) {
      console.error('[Address] userErrors:', userErrors);
      return res.status(400).json({ success: false, error: userErrors[0].message, userErrors });
    }

    return res.json({
      success: true,
      deletedId: result?.data?.customerAddressDelete?.deletedCustomerAddressId,
    });
  } catch (err) {
    console.error('[Address] Error deleting address:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

module.exports = router;
