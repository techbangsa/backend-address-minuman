// Shopify's canonical `province` values for Indonesia (from /services/countries.js).
// Most already match the Indonesian long-form name (e.g. "Jawa Barat"), but a few use
// an English or short form instead of the official government name that Google's
// Geocoding API returns for administrative_area_level_1 (e.g. "Daerah Khusus Ibukota
// Jakarta"). Sending an unrecognized string makes customerAddressCreate/Update fail
// with userErrors "Province is invalid".
const SHOPIFY_PROVINCES = [
  'Aceh', 'Bali', 'Bangka Belitung', 'Banten', 'Bengkulu', 'Gorontalo', 'Jakarta',
  'Jambi', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Kalimantan Barat',
  'Kalimantan Selatan', 'Kalimantan Tengah', 'Kalimantan Timur', 'Kalimantan Utara',
  'Kepulauan Riau', 'Lampung', 'Maluku', 'Maluku Utara', 'North Sumatra',
  'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Papua', 'Papua Barat', 'Riau',
  'South Sumatra', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tengah',
  'Sulawesi Tenggara', 'Sulawesi Utara', 'West Sumatra', 'Yogyakarta',
];

// Google long_name (and other common spellings) → Shopify's exact canonical value.
const ALIASES = {
  'daerah khusus ibukota jakarta': 'Jakarta',
  'dki jakarta': 'Jakarta',
  'special capital region of jakarta': 'Jakarta',
  'daerah istimewa yogyakarta': 'Yogyakarta',
  'special region of yogyakarta': 'Yogyakarta',
  'sumatera utara': 'North Sumatra',
  'sumatra utara': 'North Sumatra',
  'sumatera selatan': 'South Sumatra',
  'sumatra selatan': 'South Sumatra',
  'sumatera barat': 'West Sumatra',
  'sumatra barat': 'West Sumatra',
  'kepulauan bangka belitung': 'Bangka Belitung',
  'nanggroe aceh darussalam': 'Aceh',
  'daerah istimewa aceh': 'Aceh',
  // Newer Papua split provinces (2022) have no exact Shopify equivalent yet;
  // map to the nearest pre-2022 parent province so the address can still be saved.
  'papua selatan': 'Papua',
  'papua tengah': 'Papua',
  'papua pegunungan': 'Papua',
  'papua barat daya': 'Papua Barat',
};

const PREFIX_STRIP = [/^provinsi\s+/i, /^daerah khusus\s+/i, /^daerah istimewa\s+/i];

/**
 * Map a free-form Indonesian province name (as returned by Google's Geocoding
 * API, typed by a user, etc.) to the exact string Shopify's Admin API accepts.
 * Falls back to the trimmed input if no known mapping exists.
 */
function normalizeIndonesianProvince(rawProvince) {
  const value = (rawProvince || '').trim();
  if (!value) return value;

  const exact = SHOPIFY_PROVINCES.find((p) => p.toLowerCase() === value.toLowerCase());
  if (exact) return exact;

  const alias = ALIASES[value.toLowerCase()];
  if (alias) return alias;

  for (const pattern of PREFIX_STRIP) {
    if (!pattern.test(value)) continue;
    const stripped = value.replace(pattern, '').trim();
    const strippedExact = SHOPIFY_PROVINCES.find((p) => p.toLowerCase() === stripped.toLowerCase());
    if (strippedExact) return strippedExact;
    const strippedAlias = ALIASES[stripped.toLowerCase()];
    if (strippedAlias) return strippedAlias;
  }

  return value;
}

module.exports = { normalizeIndonesianProvince, SHOPIFY_PROVINCES };
