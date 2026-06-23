// src/marketCommoditySupport.js
//
// Single source of truth for crop ↔ commodity encoder compatibility.
//
// Generated from pkl audit:
//   crop_recommendation_model.pkl  → 22 integer classes (0-21)
//   commodity_encoder.pkl          → 23 string classes
//
// RESULT: only 9 of 22 crops have a valid commodity encoder entry.
// The other 13 must be blocked from the /predict/market endpoint.

// ─── Corrected crop → exact encoder class string ────────────────────────────
// Keys: lowercase crop name (matches selectedCrop in AppContext)
// Values: exact string as stored in commodity_encoder.pkl classes_
//
//  Crop           Old (broken) JS mapping       Corrected encoder string
//  ─────────────────────────────────────────────────────────────────────
//  maize          'Maize'                        'Maize'               ✅ (unchanged)
//  banana         'Banana'                       'Banana'              ✅ (unchanged)
//  mango          'Mango'                        'Mango'               ✅ (unchanged)
//  apple          'Apple'                        'Apple'               ✅ (unchanged)
//  cotton         'Cotton'                       'Cotton'              ✅ (unchanged)
//  kidneybeans    'Moong(Green Gram)'            'Green Gram (Moong)(Whole)' ✅ FIXED
//  pigeonpeas     'Arhar (Tur/Red Gram)'         'Arhar (Tur/Red Gram)(Whole)' ✅ FIXED
//  mungbean       'Moong(Green Gram)'            'Green Gram (Moong)(Whole)' ✅ FIXED
//  lentil         'Masur Dal'                    'Lentil (Masur)(Whole)' ✅ FIXED

export const CROP_TO_COMMODITY = {
  maize:       'Maize',
  kidneybeans: 'Green Gram (Moong)(Whole)',
  pigeonpeas:  'Arhar (Tur/Red Gram)(Whole)',
  mungbean:    'Green Gram (Moong)(Whole)',
  lentil:      'Lentil (Masur)(Whole)',
  banana:      'Banana',
  mango:       'Mango',
  apple:       'Apple',
  cotton:      'Cotton',
};

// ─── Crops with NO commodity encoder entry ──────────────────────────────────
// These 13 crops cannot be sent to /predict/market — the encoder will throw.
// Reason: commodity_encoder.pkl was trained on Agmarknet wholesale data that
// does not include: Rice, most pulses, most fruits, Jute, Coffee.
//
//  rice          → 'Rice'        not in encoder
//  chickpea      → 'Gram'        not in encoder (nearest: 'Arhar...' — wrong commodity)
//  mothbeans     → 'Moth'        not in encoder
//  blackgram     → 'Urad'        not in encoder
//  pomegranate   → 'Pomegranate' not in encoder
//  grapes        → 'Grapes'      not in encoder
//  watermelon    → 'Water Melon' not in encoder
//  muskmelon     → 'Musk Melon'  not in encoder
//  orange        → 'Orange'      not in encoder
//  papaya        → 'Papaya'      not in encoder
//  coconut       → 'Coconut'     not in encoder
//  jute          → 'Jute'        not in encoder
//  coffee        → 'Coffee'      not in encoder

export const MARKET_UNSUPPORTED_CROPS = new Set([
  'rice',
  'chickpea',
  'mothbeans',
  'blackgram',
  'pomegranate',
  'grapes',
  'watermelon',
  'muskmelon',
  'orange',
  'papaya',
  'coconut',
  'jute',
  'coffee',
]);

// ─── Helper functions ────────────────────────────────────────────────────────

/**
 * Returns true if the selected crop has a valid commodity encoder mapping.
 * @param {string} cropName  - lowercase crop key (e.g. 'rice', 'maize')
 */
export function isCropMarketSupported(cropName) {
  if (!cropName) return false;
  return !MARKET_UNSUPPORTED_CROPS.has(cropName.toLowerCase().trim());
}

/**
 * Returns the exact commodity encoder string for a crop, or null.
 * Use this to auto-select the commodity dropdown in MarketIntelligence.
 * @param {string} cropName  - lowercase crop key
 * @returns {string|null}
 */
export function getCommodityForCrop(cropName) {
  if (!cropName) return null;
  return CROP_TO_COMMODITY[cropName.toLowerCase().trim()] ?? null;
}
export const CROP_COMMODITY_APPROXIMATE = new Set([
  'kidneybeans',  
]);