const dotenv = require('dotenv');
dotenv.config();

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOP = process.env.SHOP;
const API_VERSION = process.env.API_VERSION || '2026-01';

const GRAPHQL_URL = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

/**
 * Execute a Shopify Admin GraphQL query/mutation
 */
async function shopifyGraphQL(query, variables = {}) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
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
async function findCustomerByEmail(email) {
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

  const result = await shopifyGraphQL(query, { query: `email:${email}` });
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

  // Best-effort parsing — last part is usually Country
  const country = parts.length > 1 ? parts[parts.length - 1] : 'Indonesia';

  // Second-to-last often has "Province ZIP"
  const provinceZipRaw = parts.length > 2 ? parts[parts.length - 2] : '';
  const provinceZipMatch = provinceZipRaw.match(/^(.+?)\s+(\d{4,6})$/);
  const province = provinceZipMatch ? provinceZipMatch[1] : provinceZipRaw;
  const zip = provinceZipMatch ? provinceZipMatch[2] : '';

  // City is typically 3rd from end
  const city = parts.length > 3 ? parts[parts.length - 3] : '';

  // address1 = everything else joined
  const address1 = parts.slice(0, Math.max(parts.length - 3, 1)).join(', ');

  return { address1, city, province, country, zip };
}

/**
 * Create a new address for a customer and set it as default
 */
async function createCustomerAddress(customerId, addressData) {
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

  const parsed = parseFormattedAddress(addressData.formatted);

  // Store lat/lng + extra details in address2 for reference
  const address2Parts = [];
  if (addressData.lat && addressData.lng) {
    address2Parts.push(`[${addressData.lat},${addressData.lng}]`);
  }
  if (addressData.extra) {
    address2Parts.push(addressData.extra);
  }

  const variables = {
    customerId,
    address: {
      address1: parsed.address1 || addressData.formatted,
      address2: address2Parts.join(' | ') || '',
      city: parsed.city || '',
      province: parsed.province || '',
      country: parsed.country || 'Indonesia',
      zip: parsed.zip || '',
    },
  };

  console.log('[ShopifyGQL] createCustomerAddress variables:', JSON.stringify(variables, null, 2));
  const result = await shopifyGraphQL(mutation, variables);
  console.log('[ShopifyGQL] createCustomerAddress result:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Update the customer's default address
 */
async function updateCustomerDefaultAddress(customerId, addressId) {
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

  const result = await shopifyGraphQL(mutation, { customerId, addressId });
  return result;
}

/**
 * Update an existing address for a customer
 */
async function updateCustomerAddress(customerId, addressId, addressData) {
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

  const parsed = parseFormattedAddress(addressData.formatted);

  const address2Parts = [];
  if (addressData.lat && addressData.lng) {
    address2Parts.push(`[${addressData.lat},${addressData.lng}]`);
  }
  if (addressData.extra) {
    address2Parts.push(addressData.extra);
  }

  const variables = {
    customerId,
    addressId,
    address: {
      address1: parsed.address1 || addressData.formatted,
      address2: address2Parts.join(' | ') || '',
      city: parsed.city || '',
      province: parsed.province || '',
      country: parsed.country || 'Indonesia',
      zip: parsed.zip || '',
    },
  };

  console.log('[ShopifyGQL] updateCustomerAddress variables:', JSON.stringify(variables, null, 2));
  const result = await shopifyGraphQL(mutation, variables);
  console.log('[ShopifyGQL] updateCustomerAddress result:', JSON.stringify(result, null, 2));
  return result;
}

module.exports = {
  shopifyGraphQL,
  findCustomerByEmail,
  createCustomerAddress,
  updateCustomerAddress,
  updateCustomerDefaultAddress,
  parseFormattedAddress,
};