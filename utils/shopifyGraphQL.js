const dotenv = require('dotenv');
dotenv.config();

const { DEFAULT_STORE } = require('./tenantResolver');

/**
 * Execute a Shopify Admin GraphQL query/mutation for a specific store.
 */
async function shopifyGraphQL(query, variables = {}, storeConfig = DEFAULT_STORE) {
  const { token, shop, apiVersion } = storeConfig;
  const url = `https://${shop}/admin/api/${apiVersion}/graphql.json`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify GraphQL error (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Look up a customer by email to get their Shopify GID
 */
async function findCustomerByEmail(email, storeConfig = DEFAULT_STORE) {
  const query = `
    query findCustomer($query: String!) {
      customers(first: 1, query: $query) {
        edges {
          node {
            id
            email
            firstName
            lastName
            defaultAddress {
              id
            }
            addresses {
              id
              firstName
              lastName
              company
              phone
              address1
              address2
              city
              province
              country
              zip
            }
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL(query, { query: `email:${email}` }, storeConfig);
  const edges = result?.data?.customers?.edges;
  if (!edges || edges.length === 0) return null;
  return edges[0].node;
}

/**
 * Parse a Google Maps formatted address into Shopify-compatible fields.
 * Google format example: "Jl. Raya Kuta No.1, Kuta, Kec. Kuta, Kabupaten Badung, Bali 80361, Indonesia"
 */
function parseFormattedAddress(formatted) {
  const parts = formatted.split(',').map((s) => s.trim());

  const country = parts.length > 1 ? parts[parts.length - 1] : 'Indonesia';

  const provinceZipRaw = parts.length > 2 ? parts[parts.length - 2] : '';
  const provinceZipMatch = provinceZipRaw.match(/^(.+?)\s+(\d{4,6})$/);
  const province = provinceZipMatch ? provinceZipMatch[1] : provinceZipRaw;
  const zip = provinceZipMatch ? provinceZipMatch[2] : '';

  const city = parts.length > 3 ? parts[parts.length - 3] : '';
  const address1 = parts.slice(0, Math.max(parts.length - 3, 1)).join(', ');

  return { address1, city, province, country, zip };
}

/**
 * Create a new address for a customer and set it as default
 */
async function createCustomerAddress(customerId, addressData, storeConfig = DEFAULT_STORE) {
  const mutation = `
    mutation customerAddressCreate($customerId: ID!, $address: MailingAddressInput!) {
      customerAddressCreate(customerId: $customerId, address: $address) {
        address {
          id
          address1
          address2
          city
          province
          country
          zip
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const hasParsedComponents = addressData.district || addressData.city || addressData.province;
  const parsed = hasParsedComponents ? null : parseFormattedAddress(addressData.formatted);

  let address1 = hasParsedComponents
    ? (addressData.formatted || '')
    : (parsed.address1 || addressData.formatted);

  if (addressData.extra) {
    address1 = address1 + ' | ' + addressData.extra;
  }

  const address2 = hasParsedComponents ? (addressData.district || '') : '';

  const variables = {
    customerId,
    address: {
      address1,
      address2,
      city:     (hasParsedComponents ? addressData.city     : parsed.city)     || '',
      province: (hasParsedComponents ? addressData.province : parsed.province) || '',
      country:  (hasParsedComponents ? addressData.country  : parsed.country)  || 'Indonesia',
      zip:      (hasParsedComponents ? addressData.zip      : parsed.zip)      || '',
    },
  };

  console.log('[ShopifyGQL] createCustomerAddress variables:', JSON.stringify(variables, null, 2));
  const result = await shopifyGraphQL(mutation, variables, storeConfig);
  console.log('[ShopifyGQL] createCustomerAddress result:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Update the customer's default address
 */
async function updateCustomerDefaultAddress(customerId, addressId, storeConfig = DEFAULT_STORE) {
  const mutation = `
    mutation customerUpdateDefaultAddress($customerId: ID!, $addressId: ID!) {
      customerUpdateDefaultAddress(customerId: $customerId, addressId: $addressId) {
        customer {
          id
          defaultAddress {
            id
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyGraphQL(mutation, { customerId, addressId }, storeConfig);
  return result;
}

/**
 * Update an existing address for a customer
 */
async function updateCustomerAddress(customerId, addressId, addressData, storeConfig = DEFAULT_STORE) {
  const mutation = `
    mutation customerAddressUpdate($customerId: ID!, $addressId: ID!, $address: MailingAddressInput!) {
      customerAddressUpdate(customerId: $customerId, addressId: $addressId, address: $address) {
        address {
          id
          address1
          address2
          city
          province
          country
          zip
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const hasParsedComponents = addressData.district || addressData.city || addressData.province;
  const parsed = hasParsedComponents ? null : parseFormattedAddress(addressData.formatted);

  let address1 = hasParsedComponents
    ? (addressData.formatted || '')
    : (parsed.address1 || addressData.formatted);

  if (addressData.extra) {
    address1 = address1 + ' | ' + addressData.extra;
  }

  const address2 = hasParsedComponents ? (addressData.district || '') : '';

  const variables = {
    customerId,
    addressId,
    address: {
      firstName: addressData.firstName || '',
      lastName:  addressData.lastName  || '',
      company:   addressData.company   || '',
      phone:     addressData.phone     || '',
      address1,
      address2,
      city:     (hasParsedComponents ? addressData.city     : parsed.city)     || '',
      province: (hasParsedComponents ? addressData.province : parsed.province) || '',
      country:  (hasParsedComponents ? addressData.country  : parsed.country)  || 'Indonesia',
      zip:      (hasParsedComponents ? addressData.zip      : parsed.zip)      || '',
    },
  };

  console.log('[ShopifyGQL] updateCustomerAddress variables:', JSON.stringify(variables, null, 2));
  const result = await shopifyGraphQL(mutation, variables, storeConfig);
  console.log('[ShopifyGQL] updateCustomerAddress result:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Delete a customer address by its Shopify GID
 */
async function deleteCustomerAddress(customerId, addressId, storeConfig = DEFAULT_STORE) {
  const mutation = `
    mutation customerAddressDelete($customerId: ID!, $addressId: ID!) {
      customerAddressDelete(customerId: $customerId, addressId: $addressId) {
        deletedAddressId
        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyGraphQL(mutation, { customerId, addressId }, storeConfig);
  console.log('[ShopifyGQL] deleteCustomerAddress result:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Set a metafield on a customer via the Admin API (metafieldsSet).
 * Storefront API cannot write metafields, so theme code must go through here.
 */
async function setCustomerMetafield(
  customerId,
  { namespace, key, value, type = 'single_line_text_field' },
  storeConfig = DEFAULT_STORE
) {
  const mutation = `
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          namespace
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    metafields: [{ ownerId: customerId, namespace, key, value, type }],
  };

  console.log('[ShopifyGQL] setCustomerMetafield variables:', JSON.stringify(variables, null, 2));
  const result = await shopifyGraphQL(mutation, variables, storeConfig);
  console.log('[ShopifyGQL] setCustomerMetafield result:', JSON.stringify(result, null, 2));
  return result;
}

module.exports = {
  shopifyGraphQL,
  findCustomerByEmail,
  createCustomerAddress,
  updateCustomerAddress,
  updateCustomerDefaultAddress,
  deleteCustomerAddress,
  setCustomerMetafield,
  parseFormattedAddress,
};
