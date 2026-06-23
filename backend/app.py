import os
import math
import threading
import warnings
import numpy as np
import joblib
from datetime import datetime, date
from flask import Flask, render_template, request, jsonify
import requests
from functools import lru_cache
from flask_cors import CORS
# ── Suppress sklearn version mismatch warnings ──────────────────────────────
warnings.filterwarnings("ignore", category=UserWarning)

# ── App ──────────────────────────────────────────────────────────────────────
app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static",
)
CORS(app)
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")


# ── Loader helpers ────────────────────────────────────────────────────────────
def _load(filename: str):
    """Load a pkl from models/; raises FileNotFoundError if absent."""
    path = os.path.join(MODELS_DIR, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model not found: {path}")
    return joblib.load(path)


def _try_load(filename: str):
    """
    Like _load but returns None instead of raising.
    Used for the large market_price_model so the rest of the app still
    starts even when the file is not yet present on disk.
    """
    try:
        model = _load(filename)
        print(f"  ✓ {filename}")
        return model
    except FileNotFoundError:
        print(f"  ⚠  {filename} NOT FOUND — /predict/market will return 503 until the file is added.")
        return None


# ── Load at startup ───────────────────────────────────────────────────────────
print("Loading models …")
crop_model       = _load("crop_recommendation_model.pkl");  print("  ✓ crop_recommendation_model.pkl")
yield_model      = _load("yield_prediction_model.pkl");     print("  ✓ yield_prediction_model.pkl")
fertilizer_model = _try_load("fertilizer_price_model.pkl")
if fertilizer_model is None:
    print("  ⚠  fertilizer_price_model.pkl NOT FOUND — fertilizer price will use fallback")
fert_district_enc = _load("fertilizer_district_encoder.pkl")
print("  ✓ fertilizer_district_encoder.pkl")

print(
    f"  fert_district_enc classes count: "
    f"{len(fert_district_enc.classes_)}"
)

try:
    market_district_enc = _load("district_encoder.pkl")
    print("  ✓ district_encoder.pkl (for market predictions)")
    print(f"  market_district_enc classes count: {len(market_district_enc.classes_)}")
except FileNotFoundError:
    market_district_enc = None
    print(
        "  ⚠ district_encoder.pkl not found — /predict/market will return 503 "
        "until district_encoder.pkl is added to models/"
    )
market_enc       = _load("market_encoder.pkl");             print("  ✓ market_encoder.pkl")
commodity_enc    = _load("commodity_encoder.pkl");          print("  ✓ commodity_encoder.pkl")


# Large model — optional at startup
market_model = _try_load("market_price_model.pkl")

# Fertilizer type model (from dataset)
fert_type_model = _try_load("fertilizer_type_model.pkl")
fert_crop_enc2  = _try_load("fert_crop_encoder.pkl")
fert_soil_enc2  = _try_load("fert_soil_encoder.pkl")
fert_type_enc   = _try_load("fert_type_encoder.pkl")

# Startup feature-count checks
if fert_type_model is not None:
    expected = getattr(fert_type_model, 'n_features_in_', None)
    print(f"  fert_type_model expects {expected} features "
          f"(we supply 10: temp,moisture,rain,ph,N,P,K,carbon,crop_enc,soil_enc)")
    if expected is not None and expected != 10:
        print(f"  ⚠ MISMATCH — fert_type_model expects {expected}, we supply 10!")

if fertilizer_model is not None:
    expected = getattr(fertilizer_model, 'n_features_in_', None)
    print(f"  fertilizer_price_model expects {expected} features "
          f"(we supply 9: N,P,K,rain,temp,hum,yield,field_size,district_code)")
    if expected is not None and expected != 9:
        print(f"  ⚠ MISMATCH — fertilizer_price_model expects {expected}, we supply 9!")

print("Models ready.\n")

# ── Utilities ─────────────────────────────────────────────────────────────────
def safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def crop_label(raw):

    crop_mapping = {
    0:  "Apple",
    1:  "Banana",
    2:  "Blackgram",
    3:  "Chickpea",
    4:  "Coconut",
    5:  "Coffee",
    6:  "Cotton",
    7:  "Grapes",
    8:  "Jute",
    9:  "Kidneybeans",
    10: "Lentil",
    11: "Maize",
    12: "Mango",
    13: "Mothbeans",
    14: "Mungbean",
    15: "Muskmelon",
    16: "Orange",
    17: "Papaya",
    18: "Pigeonpeas",
    19: "Pomegranate",
    20: "Rice",
    21: "Watermelon"
    }

    # If prediction already string
    if isinstance(raw, str):
        return raw.capitalize()

    # Convert numpy.int64 → normal int
    raw = int(raw)

    return crop_mapping.get(raw, "Unknown")


def encode_label(encoder, label: str):

    original_classes = list(encoder.classes_)

    lower_map = {
        str(c).lower(): c
        for c in original_classes
    }

    matched = lower_map.get(label.lower())

    if matched is None:
        return None, (
            f"'{label}' not recognised. "
            f"Valid options: {list(lower_map.keys())[:5]} "
            f"... (total {len(lower_map)})"
        )

    return int(
        encoder.transform([matched])[0]
    ), None

# ── Fertilizer base prices (₹/bag) ───────────────────────────────────────────
FERT_PRICES = {
    'DAP':                          1350,
    'Urea':                         266,
    'Muriate of Potash':            1700,
    'Balanced NPK Fertilizer':      1100,
    'Compost':                      400,
    'Organic Fertilizer':           600,
    'Water Retaining Fertilizer':   800,
    'Gypsum':                       350,
    'Lime':                         200,
    'General Purpose Fertilizer':   900,
}

# ── 20 real fertilizer production/port hubs across India ─────────────────────
# Covers all directions: north, south, east, west, northeast, central
FERT_HUBS = [
    (17.0, 81.8),   # Kakinada port (AP)
    (13.1, 80.3),   # Chennai port (TN)
    (18.9, 72.8),   # Mumbai port (MH)
    (22.6, 88.4),   # Kolkata port (WB)
    (23.0, 72.6),   # Ahmedabad (GJ)
    (28.6, 77.2),   # Delhi (DL)
    (17.4, 78.5),   # Hyderabad (TS)
    (12.9, 77.6),   # Bengaluru (KA)
    (22.3, 73.2),   # Vadodara GSFC plant (GJ)
    (20.3, 85.8),   # Bhubaneswar (OD)
    (26.8, 80.9),   # Lucknow (UP)
    (30.9, 75.9),   # Ludhiana (PB)
    (25.6, 85.1),   # Patna (BR)
    (23.2, 77.4),   # Bhopal (MP)
    (26.9, 75.8),   # Jaipur (RJ)
    (21.1, 79.1),   # Nagpur (MH)
    (11.0, 77.0),   # Coimbatore (TN)
    (25.3, 83.0),   # Varanasi (UP)
    (26.1, 91.7),   # Guwahati (AS) — covers Northeast
    (15.5, 73.8),   # Panaji/Goa — covers coastal Karnataka/Goa
]

# ── In-memory geocode cache (district → (lat, lon) or None) ──────────────────
_coord_cache: dict = {}
_cache_lock = threading.Lock()


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Straight-line distance in km between two lat/lon points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _nearest_hub_km(lat: float, lon: float) -> float:
    """Return distance in km to the nearest fertilizer distribution hub."""
    return min(_haversine_km(lat, lon, h[0], h[1]) for h in FERT_HUBS)


# ── Hardcoded fallback coords for districts Open-Meteo cannot geocode ─────────
DISTRICT_HARDCODED_COORDS = {
    # Arunachal Pradesh
    "dibang valley":            (28.40, 95.90),
    "lower dibang valley":      (28.00, 95.70),
    "anjaw":                    (28.10, 96.80),
    "lohit":                    (27.90, 96.40),
    "tirap":                    (27.00, 95.50),
    "longding":                 (27.00, 95.30),
    "shi yomi":                 (28.60, 94.20),
    "pakke-kessang":            (27.20, 93.60),
    "pakke kessang":            (27.20, 93.60),
    "kamle":                    (27.90, 93.80),
    "kra daadi":                (28.00, 93.50),
    "leparada":                 (28.20, 94.70),
    "siang":                    (28.00, 94.80),
    "upper siang":              (28.60, 95.10),
    "lower siang":              (27.80, 94.60),
    # Nagaland
    "chumoukedima":             (25.70, 93.70),
    "chümoukedima":             (25.70, 93.70),
    "tseminyu":                 (25.80, 94.00),
    "tseminyü":                 (25.80, 94.00),
    "niuland":                  (25.70, 93.80),
    "shamator":                 (26.50, 94.90),
    "noklak":                   (26.30, 95.20),
    # Manipur
    "jiribam":                  (24.70, 93.10),
    "kakching":                 (24.50, 93.90),
    "kamjong":                  (24.90, 94.50),
    "kangpokpi":                (25.10, 93.90),
    "noney":                    (24.80, 93.70),
    "pherzawl":                 (24.30, 93.40),
    "tengnoupal":               (24.10, 94.00),
    # Mizoram
    "hnahthial":                (22.50, 92.90),
    "khawzawl":                 (23.40, 93.20),
    "saitual":                  (23.80, 92.90),
    # Meghalaya
    "eastern west khasi hills": (25.40, 91.40),
    # Sikkim
    "pakyong":                  (27.20, 88.60),
    "soreng":                   (27.10, 88.20),
    "gyalshing":                (27.30, 88.30),
    # Chhattisgarh
    "gaurela-pendra-marwahi":   (22.80, 81.90),
    "gaurella-pendra-marwahi":  (22.80, 81.90),
    "sakti":                    (21.90, 82.90),
    "sarangarh-bilaigarh":      (21.60, 83.10),
    "mohla-manpur-ambagarh chowki": (20.80, 80.90),
    "khairagarh-chhuikhadan-gandai": (21.40, 80.90),
    "manendragarh-chirmiri-bharatpur": (23.20, 82.50),
    # Rajasthan
    "anupgarh":                 (29.20, 73.20),
    "balotra":                  (25.80, 72.20),
    "beawar":                   (26.10, 74.30),
    "deeg":                     (27.50, 77.30),
    "didwana-kuchaman":         (27.40, 74.60),
    "dudu":                     (26.70, 75.70),
    "gangapur city":            (26.50, 76.70),
    "jaipur rural":             (26.90, 75.60),
    "jodhpur rural":            (26.30, 73.00),
    "kekri":                    (25.90, 75.10),
    "khairthal-tijara":         (27.80, 76.60),
    "kotputli-behror":          (27.70, 76.20),
    "neem ka thana":            (27.70, 75.80),
    "phalodi":                  (27.10, 72.40),
    "salumbar":                 (24.20, 74.10),
    "sanchore":                 (24.80, 71.80),
    "shahpura":                 (27.40, 75.90),
    # Madhya Pradesh
    "maihar":                   (24.30, 80.80),
    "pandhurna":                (21.70, 78.50),
    "narmadapuram":             (22.70, 77.70),
    # Uttar Pradesh
    "ayodhya":                  (26.80, 82.20),
    "prayagraj":                (25.40, 81.80),
    # Telangana
    "bhadradri kothagudem":     (17.60, 80.60),
    "jayashankar bhupalpally":  (18.50, 79.90),
    "jogulamba gadwal":         (16.20, 77.80),
    "medchal-malkajgiri":       (17.50, 78.50),
    "rajanna sircilla":         (18.40, 78.80),
    "yadadri bhuvanagiri":      (17.60, 79.50),
    "komaram bheem asifabad":   (19.40, 79.30),
    # Andhra Pradesh
    "anakapalli":               (17.70, 83.00),
    "annamayya":                (13.80, 79.00),
    "bapatla":                  (15.90, 80.50),
    "dr. b.r. ambedkar konaseema": (16.90, 81.90),
    "eluru":                    (16.70, 81.10),
    "kakinada":                 (16.90, 82.20),
    "nandyal":                  (15.50, 78.50),
    "ntr":                      (16.50, 80.60),
    "palnadu":                  (16.30, 79.60),
    "parvathipuram manyam":     (18.80, 83.40),
    "sri potti sriramulu nellore": (14.40, 79.90),
    "sri sathya sai":           (14.20, 77.80),
    "tirupati":                 (13.60, 79.40),
    # West Bengal
    "jhargram":                 (22.40, 86.90),
    "kalimpong":                (27.10, 88.50),
    "alipurduar":               (26.50, 89.50),
    # Assam
    "biswanath":                (26.70, 93.20),
    "charaideo":                (27.00, 94.80),
    "hojai":                    (26.00, 92.90),
    "majuli":                   (27.00, 94.20),
    "south salmara-mankachar":  (25.70, 89.90),
    "west karbi anglong":       (25.90, 92.60),
    # Jharkhand
    "saraikela-kharsawan":      (22.70, 85.90),
    "saraikela kharsawan":      (22.70, 85.90),
    # Karnataka
    "vijayanagara":             (15.10, 76.90),
    # Gujarat
    "devbhoomi dwarka":         (22.20, 69.00),
    "devbhumi dwarka":          (22.20, 69.00),
    "chhota udaipur":           (22.30, 74.00),
    "chhota udepur":            (22.30, 74.00),
    "gir somnath":              (20.90, 70.40),
    # Maharashtra
    "palghar":                  (19.70, 72.80),
}


def _geocode_district(name: str):
    """
    Convert district name → (lat, lon).
    Strategy:
      1. Check hardcoded fallback coords first (instant, no network)
      2. Try Open-Meteo with 3 progressive query strategies
      3. Cache result — each district geocoded at most ONCE per restart
    """
    key = name.lower().strip()

    with _cache_lock:
        if key in _coord_cache:
            return _coord_cache[key]

    # ── Strategy 1: hardcoded coords for known-problematic districts ──────
    if key in DISTRICT_HARDCODED_COORDS:
        coords = DISTRICT_HARDCODED_COORDS[key]
        with _cache_lock:
            _coord_cache[key] = coords
        return coords

    # ── Strategy 2: Open-Meteo with 3 progressive queries ─────────────────
    queries = [
        f"{name} India",
        f"{name} district India",
        name,
    ]

    coords = None
    for query in queries:
        try:
            encoded = requests.utils.quote(query)
            url = (
                f"https://geocoding-api.open-meteo.com/v1/search"
                f"?name={encoded}&count=5&language=en&format=json"
            )
            resp = requests.get(url, timeout=4)
            resp.raise_for_status()
            results = resp.json().get("results", [])
            if results:
                india = next(
                    (r for r in results if r.get("country_code") == "IN"),
                    results[0]
                )
                coords = (india["latitude"], india["longitude"])
                break
        except Exception as exc:
            print(f"  ⚠ geocode attempt failed for '{query}': {exc}")
            continue

    if not coords:
        print(f"  ⚠ geocode fully failed for '{name}' — using encoder fallback")

    with _cache_lock:
        _coord_cache[key] = coords

    return coords


def get_district_price_factor(district_name: str, district_code: int = None) -> float:
    """
    Return a fertilizer price multiplier for ANY Indian district
    without any hardcoded list.

    Algorithm:
      1. Geocode the district to real lat/lon (cached after first call).
      2. Compute distance to nearest fertilizer hub.
      3. Apply sigmoid curve:
            factor = 0.93 + 0.42 * (dist / (dist + 350))
         This gives:
            0 km   → 0.930  (port/hub city — cheapest)
            150 km → 0.975
            300 km → 1.020
            500 km → 1.076
            800 km → 1.143
            1200 km→ 1.197
            1800 km→ 1.244
            2500 km→ 1.275  (most remote — capped at 1.38)
      4. If geocoding fails, fall back to a gentle spread derived from
         the district encoder rank (0.97 → 1.15) — deterministic and
         still gives different values per district.
    """
    name = district_name.lower().strip()

    # ── Primary: geocode → real distance → sigmoid factor ─────────────────
    coords = _geocode_district(name)
    if coords:
        dist_km = _nearest_hub_km(coords[0], coords[1])
        factor  = 0.93 + 0.42 * (dist_km / (dist_km + 350.0))
        return round(min(factor, 1.38), 4)

    # ── Fallback: encoder rank as remoteness proxy ─────────────────────────
    if district_code is not None:
        total  = max(len(fert_district_enc.classes_) - 1, 1)
        factor = 0.97 + (district_code / total) * 0.18
        return round(factor, 4)

    return 1.05   # ultimate safe fallback


def predict_fert_internal(
    temperature, moisture, rainfall, ph,
    N, P, K, carbon, crop, soil,
    district_name: str = "",
    district_code: int = None,
):
    if fert_type_model is None:
        return None

    # ── Encode crop ────────────────────────────────────────────────────────
    crop_classes = list(fert_crop_enc2.classes_)
    crop_lower   = {c.lower(): c for c in crop_classes}
    _FERT_CROP_NAME_MAP = {
      'kidneybeans': 'kidney beans',
      'pigeonpeas':  'pigeon peas',
      'mothbeans':   'moth beans',
      'mungbean':    'mung bean',
      'blackgram':   'black gram',
    }
    crop_normalized = _FERT_CROP_NAME_MAP.get(crop.lower(), crop.lower())
    crop_matched = crop_lower.get(crop_normalized, crop_classes[0])
    crop_code_enc = int(fert_crop_enc2.transform([crop_matched])[0])

    # ── Encode soil ────────────────────────────────────────────────────────
    soil_classes = list(fert_soil_enc2.classes_)
    soil_lower   = {s.lower(): s for s in soil_classes}
    soil_matched = soil_lower.get(soil.lower(), soil_classes[2])
    soil_code_enc = int(fert_soil_enc2.transform([soil_matched])[0])

    # ── Model prediction ───────────────────────────────────────────────────
    feat      = np.array([[temperature, moisture, rainfall, ph,
                           N, P, K, carbon, crop_code_enc, soil_code_enc]])
    pred_code = int(fert_type_model.predict(feat)[0])
    fert_name = fert_type_enc.classes_[pred_code]

    # ── District price factor (works for ALL 723+ districts) ──────────────
    price_factor = get_district_price_factor(district_name, district_code)

    fert_price = round(FERT_PRICES.get(fert_name, 800) * price_factor)

    # ── Top-3 with district-adjusted prices ───────────────────────────────
    proba = fert_type_model.predict_proba(feat)[0]
    top3  = sorted(
        [{
            "fertilizer": fert_type_enc.classes_[i],
            "probability": round(float(p) * 100, 1),
            "price": round(FERT_PRICES.get(fert_type_enc.classes_[i], 800) * price_factor),
         }
         for i, p in enumerate(proba)],
        key=lambda x: x["probability"],
        reverse=True,
    )[:3]

    return {
        "recommended_fertilizer": fert_name,
        "price_per_bag_inr":      fert_price,
        "price_factor":           round(price_factor, 3),
        "top_3":                  top3,
        "soil_type":              soil_matched,
    }

# ── District name map: UI names → exact encoder class names ──────────────────
DISTRICT_NAME_MAP = {
    # Andhra Pradesh
    "dr. b.r. ambedkar konaseema": "east godavari",
    "ysr kadapa":                  "kadapa",
    "visakhapatnam":               "visakhapatanam",
    "ntr":                         "krishna",
    "sri potti sriramulu nellore": "nellore",
    "sri sathya sai":              "anantapur",
    "parvathipuram manyam":        "vizianagaram",
    "anakapalli":                  "visakhapatanam",
    "annamayya":                   "chittoor",
    "bapatla":                     "guntur",
    "eluru":                       "west godavari",
    "kakinada":                    "east godavari",
    "nandyal":                     "kurnool",
    "palnadu":                     "guntur",
    "tirupati":                    "chittoor",
    # Arunachal Pradesh
    "pakke-kessang":               "pakke kessang",
    # Assam
    "kamrup metropolitan":         "kamrup",
    "west karbi anglong":          "karbi anglong",
    "biswanath":                   "sonitpur",
    "majuli":                      "jorhat",
    "morigaon":                    "nagaon",
    "south salmara-mankachar":     "dhubri",
    # Bihar
    "east champaran":              "champaran",
    "west champaran":              "champaran",
    "kaimur":                      "kaimur (bhabua)",
    # Chhattisgarh
    "gaurela-pendra-marwahi":      "gaurella-pendra-marwahi",
    "koriya":                      "korea",
    "gariaband":                   "raipur",
    "khairagarh-chhuikhadan-gandai": "rajnandgaon",
    "manendragarh-chirmiri-bharatpur": "korea",
    "mohla-manpur-ambagarh chowki": "rajnandgaon",
    "sakti":                       "janjgir-champa",
    "sarangarh-bilaigarh":         "raigarh",
    # Gujarat
    "ahmedabad":                   "ahmadabad",
    "banaskantha":                 "banas kantha",
    "chhota udaipur":              "chhota udepur",
    "devbhoomi dwarka":            "devbhumi dwarka",
    "kutch":                       "kachchh",
    "mehsana":                     "mahesana",
    "panchmahal":                  "panch mahals",
    "sabarkantha":                 "sabar kantha",
    # Haryana
    "gurugram":                    "gurgaon",
    "nuh":                         "mewat",
    "charkhi dadri":               "bhiwani",
    # Himachal Pradesh
    "lahaul and spiti":            "lahul and spiti",
    # Jharkhand
    "east singhbhum":              "purbi singhbhum",
    "saraikela-kharsawan":         "saraikela kharsawan",
    "sahibganj":                   "sahebganj",
    # Karnataka
    "bengaluru rural":             "bangalore rural",
    "davanagere":                  "davangere",
    "vijayanagara":                "bellary",
    # Madhya Pradesh
    "narmadapuram":                "hoshangabad",
    "maihar":                      "satna",
    "pandhurna":                   "chhindwara",
    # Maharashtra
    "mumbai city":                 "mumbai",
    "mumbai suburban":             "mumbai",
    "osmanabad":                   "dharashiv",
    "amravati":                    "amravati",
    # Manipur
    "jiribam":                     "imphal east",
    "kakching":                    "thoubal",
    "kamjong":                     "ukhrul",
    "kangpokpi":                   "senapati",
    "noney":                       "tamenglong",
    "pherzawl":                    "churachandpur",
    "tengnoupal":                  "chandel",
    # Meghalaya
    "eastern west khasi hills":    "west khasi hills",
    "ri-bhoi":                     "ri bhoi",
    # Mizoram
    "hnahthial":                   "lunglei",
    "khawzawl":                    "champhai",
    "saitual":                     "aizawl",
    # Nagaland
    "chümoukedima":                "dimapur",
    "niuland":                     "dimapur",
    "noklak":                      "tuensang",
    "shamator":                    "tuensang",
    "tseminyü":                    "kohima",
    # Odisha
    "angul":                       "anugul",
    "balasore":                    "baleshwar",
    "jagatsinghpur":               "jagatsinghapur",
    "jajpur":                      "jajapur",
    "subarnapur":                  "sonepur",
    # Punjab
    "ferozepur":                   "firozpur",
    "mohali":                      "s.a.s nagar",
    "malerkotla":                  "sangrur",
    "shaheed bhagat singh nagar":  "shahid bhagat singh nagar",
    # Rajasthan
    "anupgarh":                    "sriganganagar",
    "balotra":                     "barmer",
    "beawar":                      "ajmer",
    "deeg":                        "bharatpur",
    "didwana-kuchaman":            "nagaur",
    "dudu":                        "jaipur",
    "gangapur city":               "sawai madhopur",
    "jaipur rural":                "jaipur",
    "jodhpur rural":               "jodhpur",
    "kekri":                       "ajmer",
    "khairthal-tijara":            "alwar",
    "kotputli-behror":             "jaipur",
    "neem ka thana":               "sikar",
    "phalodi":                     "jodhpur",
    "salumbar":                    "udaipur",
    "sanchore":                    "jalor",
    "shahpura":                    "jaipur",
    "sri ganganagar":              "sriganganagar",
    # Sikkim
    "gangtok":                     "east sikkim",
    "gyalshing":                   "west sikkim",
    "mangan":                      "north sikkim",
    "namchi":                      "south sikkim",
    "pakyong":                     "east sikkim",
    "soreng":                      "west sikkim",
    # Tamil Nadu
    "kanyakumari":                 "kanniyakumari",
    "mayiladuthurai":              "nagapattinam",
    "nilgiris":                    "the nilgiris",
    "tiruvallur":                  "thiruvallur",
    "tiruvarur":                   "thiruvarur",
    "viluppuram":                  "villupuram",
    # Telangana
    "bhadradri kothagudem":        "bhadradri",
    "hanamkonda":                  "warangal",
    "jagtial":                     "karimnagar",
    "jangaon":                     "warangal",
    "jayashankar bhupalpally":     "jayashankar",
    "jogulamba gadwal":            "jogulamba",
    "mahabubnagar":                "mahbubnagar",
    "medchal-malkajgiri":          "medchal malkajgiri",
    "narayanpet":                  "mahabubnagar",
    "rajanna sircilla":            "rajanna",
    "rangareddy":                  "rangareddi",
    "yadadri bhuvanagiri":         "yadadri",
    # Uttar Pradesh
    "ayodhya":                     "faizabad",
    "bhadohi":                     "sant ravidas nagar",
    "kushinagar":                  "kushi nagar",
    "prayagraj":                   "allahabad",
    "raebareli":                   "rae bareli",
    "sant kabir nagar":            "sant kabeer nagar",
    "siddharthnagar":              "siddharth nagar",
    # Uttarakhand
    "rudraprayag":                 "rudra prayag",
    "udham singh nagar":           "udam singh nagar",
    "uttarkashi":                  "uttar kashi",
    # West Bengal
    "cooch behar":                 "coochbehar",
    "dakshin dinajpur":            "dinajpur dakshin",
    "kolkata":                     "howrah",
    "malda":                       "maldah",
    "north 24 parganas":           "24 paraganas north",
    "south 24 parganas":           "24 paraganas south",
    "paschim medinipur":           "medinipur west",
    "purba medinipur":             "medinipur east",
    "uttar dinajpur":              "dinajpur uttar",
}

# ── Routes ────────────────────────────────────────────────────────────────────
STATE_DISTRICTS = {
    "Andhra Pradesh": [
    "Anakapalli",
    "Anantapur",
    "Annamayya",
    "Bapatla",
    "Chittoor",
    "Dr. B.R. Ambedkar Konaseema",
    "East Godavari",
    "Eluru",
    "Guntur",
    "Kakinada",
    "Krishna",
    "Kurnool",
    "Nandyal",
    "NTR",
    "Palnadu",
    "Parvathipuram Manyam",
    "Prakasam",
    "Sri Potti Sriramulu Nellore",
    "Sri Sathya Sai",
    "Srikakulam",
    "Tirupati",
    "Visakhapatnam",
    "Vizianagaram",
    "West Godavari",
    "YSR Kadapa"
],

"Arunachal Pradesh": [
    "Tawang",
    "West Kameng",
    "East Kameng",
    "Papum Pare",
    "Kurung Kumey",
    "Kra Daadi",
    "Lower Subansiri",
    "Upper Subansiri",
    "West Siang",
    "East Siang",
    "Siang",
    "Upper Siang",
    "Lower Siang",
    "Lower Dibang Valley",
    "Dibang Valley",
    "Anjaw",
    "Lohit",
    "Namsai",
    "Changlang",
    "Tirap",
    "Longding",
    "Leparada",
    "Pakke-Kessang",
    "Kamle",
    "Shi Yomi",
],

"Assam": [
    "Baksa",
    "Barpeta",
    "Biswanath",
    "Bongaigaon",
    "Cachar",
    "Charaideo",
    "Chirang",
    "Darrang",
    "Dhemaji",
    "Dhubri",
    "Dibrugarh",
    "Dima Hasao",
    "Goalpara",
    "Golaghat",
    "Hailakandi",
    "Hojai",
    "Jorhat",
    "Kamrup",
    "Kamrup Metropolitan",
    "Karbi Anglong",
    "Karimganj",
    "Kokrajhar",
    "Lakhimpur",
    "Majuli",
    "Morigaon",
    "Nagaon",
    "Nalbari",
    "Sivasagar",
    "Sonitpur",
    "South Salmara-Mankachar",
    "Tinsukia",
    "Udalguri",
    "West Karbi Anglong"
],

"Bihar": [
    "Araria",
    "Arwal",
    "Aurangabad",
    "Banka",
    "Begusarai",
    "Bhagalpur",
    "Bhojpur",
    "Buxar",
    "Darbhanga",
    "East Champaran",
    "Gaya",
    "Gopalganj",
    "Jamui",
    "Jehanabad",
    "Kaimur",
    "Katihar",
    "Khagaria",
    "Kishanganj",
    "Lakhisarai",
    "Madhepura",
    "Madhubani",
    "Munger",
    "Muzaffarpur",
    "Nalanda",
    "Nawada",
    "Patna",
    "Purnia",
    "Rohtas",
    "Saharsa",
    "Samastipur",
    "Saran",
    "Sheikhpura",
    "Sheohar",
    "Sitamarhi",
    "Siwan",
    "Supaul",
    "Vaishali",
    "West Champaran"
],

"Chhattisgarh": [
    "Balod",
    "Baloda Bazar",
    "Balrampur",
    "Bastar",
    "Bemetara",
    "Bijapur",
    "Bilaspur",
    "Dantewada",
    "Dhamtari",
    "Durg",
    "Gariaband",
    "Gaurela-Pendra-Marwahi",
    "Janjgir-Champa",
    "Jashpur",
    "Kabirdham",
    "Kanker",
    "Khairagarh-Chhuikhadan-Gandai",
    "Kondagaon",
    "Korba",
    "Koriya",
    "Mahasamund",
    "Manendragarh-Chirmiri-Bharatpur",
    "Mohla-Manpur-Ambagarh Chowki",
    "Mungeli",
    "Narayanpur",
    "Raigarh",
    "Raipur",
    "Rajnandgaon",
    "Sakti",
    "Sarangarh-Bilaigarh",
    "Sukma",
    "Surajpur",
    "Surguja"
],

"Goa": [
    "North Goa",
    "South Goa"
],

"Gujarat": [
    "Ahmedabad",
    "Amreli",
    "Anand",
    "Aravalli",
    "Banaskantha",
    "Bharuch",
    "Bhavnagar",
    "Botad",
    "Chhota Udaipur",
    "Dahod",
    "Dang",
    "Devbhoomi Dwarka",
    "Gandhinagar",
    "Gir Somnath",
    "Jamnagar",
    "Junagadh",
    "Kheda",
    "Kutch",
    "Mahisagar",
    "Mehsana",
    "Morbi",
    "Narmada",
    "Navsari",
    "Panchmahal",
    "Patan",
    "Porbandar",
    "Rajkot",
    "Sabarkantha",
    "Surat",
    "Surendranagar",
    "Tapi",
    "Vadodara",
    "Valsad"
],

"Haryana": [
    "Ambala",
    "Bhiwani",
    "Charkhi Dadri",
    "Faridabad",
    "Fatehabad",
    "Gurugram",
    "Hisar",
    "Jhajjar",
    "Jind",
    "Kaithal",
    "Karnal",
    "Kurukshetra",
    "Mahendragarh",
    "Nuh",
    "Palwal",
    "Panchkula",
    "Panipat",
    "Rewari",
    "Rohtak",
    "Sirsa",
    "Sonipat",
    "Yamunanagar"
],

"Himachal Pradesh": [
    "Bilaspur",
    "Chamba",
    "Hamirpur",
    "Kangra",
    "Kinnaur",
    "Kullu",
    "Lahaul and Spiti",
    "Mandi",
    "Shimla",
    "Sirmaur",
    "Solan",
    "Una"
],

"Jharkhand": [
    "Bokaro",
    "Chatra",
    "Deoghar",
    "Dhanbad",
    "Dumka",
    "East Singhbhum",
    "Garhwa",
    "Giridih",
    "Godda",
    "Gumla",
    "Hazaribagh",
    "Jamtara",
    "Khunti",
    "Koderma",
    "Latehar",
    "Lohardaga",
    "Pakur",
    "Palamu",
    "Ramgarh",
    "Ranchi",
    "Sahibganj",
    "Saraikela-Kharsawan",
    "Simdega",
    "West Singhbhum"
],

"Karnataka": [
    "Bagalkot",
    "Ballari",
    "Belagavi",
    "Bengaluru Rural",
    "Bengaluru Urban",
    "Bidar",
    "Chamarajanagar",
    "Chikballapur",
    "Chikkamagaluru",
    "Chitradurga",
    "Dakshina Kannada",
    "Davanagere",
    "Dharwad",
    "Gadag",
    "Hassan",
    "Haveri",
    "Kalaburagi",
    "Kodagu",
    "Kolar",
    "Koppal",
    "Mandya",
    "Mysuru",
    "Raichur",
    "Ramanagara",
    "Shivamogga",
    "Tumakuru",
    "Udupi",
    "Uttara Kannada",
    "Vijayapura",
    "Vijayanagara",
    "Yadgir"
],

"Kerala": [
    "Alappuzha",
    "Ernakulam",
    "Idukki",
    "Kannur",
    "Kasaragod",
    "Kollam",
    "Kottayam",
    "Kozhikode",
    "Malappuram",
    "Palakkad",
    "Pathanamthitta",
    "Thiruvananthapuram",
    "Thrissur",
    "Wayanad"
],

"Madhya Pradesh": [
    "Agar Malwa",
    "Alirajpur",
    "Anuppur",
    "Ashoknagar",
    "Balaghat",
    "Barwani",
    "Betul",
    "Bhind",
    "Bhopal",
    "Burhanpur",
    "Chhatarpur",
    "Chhindwara",
    "Damoh",
    "Datia",
    "Dewas",
    "Dhar",
    "Dindori",
    "Guna",
    "Gwalior",
    "Harda",
    "Indore",
    "Jabalpur",
    "Jhabua",
    "Katni",
    "Khandwa",
    "Khargone",
    "Maihar",
    "Mandla",
    "Mandsaur",
    "Morena",
    "Narmadapuram",
    "Narsinghpur",
    "Neemuch",
    "Niwari",
    "Pandhurna",
    "Panna",
    "Raisen",
    "Rajgarh",
    "Ratlam",
    "Rewa",
    "Sagar",
    "Satna",
    "Sehore",
    "Seoni",
    "Shahdol",
    "Shajapur",
    "Sheopur",
    "Shivpuri",
    "Sidhi",
    "Singrauli",
    "Tikamgarh",
    "Ujjain",
    "Umaria",
    "Vidisha"
],

"Maharashtra": [
    "Ahmednagar",
    "Akola",
    "Amravati",
    "Aurangabad",
    "Beed",
    "Bhandara",
    "Buldhana",
    "Chandrapur",
    "Dhule",
    "Gadchiroli",
    "Gondia",
    "Hingoli",
    "Jalgaon",
    "Jalna",
    "Kolhapur",
    "Latur",
    "Mumbai City",
    "Mumbai Suburban",
    "Nagpur",
    "Nanded",
    "Nandurbar",
    "Nashik",
    "Osmanabad",
    "Palghar",
    "Parbhani",
    "Pune",
    "Raigad",
    "Ratnagiri",
    "Sangli",
    "Satara",
    "Sindhudurg",
    "Solapur",
    "Thane",
    "Wardha",
    "Washim",
    "Yavatmal"
],

"Manipur": [
    "Bishnupur",
    "Chandel",
    "Churachandpur",
    "Imphal East",
    "Imphal West",
    "Jiribam",
    "Kakching",
    "Kamjong",
    "Kangpokpi",
    "Noney",
    "Pherzawl",
    "Senapati",
    "Tamenglong",
    "Tengnoupal",
    "Thoubal",
    "Ukhrul"
],

"Meghalaya": [
    "East Garo Hills",
    "East Jaintia Hills",
    "East Khasi Hills",
    "Eastern West Khasi Hills",
    "North Garo Hills",
    "Ri-Bhoi",
    "South Garo Hills",
    "South West Garo Hills",
    "South West Khasi Hills",
    "West Garo Hills",
    "West Jaintia Hills",
    "West Khasi Hills"
],

"Mizoram": [
    "Aizawl",
    "Champhai",
    "Hnahthial",
    "Khawzawl",
    "Kolasib",
    "Lawngtlai",
    "Lunglei",
    "Mamit",
    "Saiha",
    "Saitual",
    "Serchhip"
],

"Nagaland": [
    "Chümoukedima",
    "Dimapur",
    "Kiphire",
    "Kohima",
    "Longleng",
    "Mokokchung",
    "Mon",
    "Niuland",
    "Noklak",
    "Peren",
    "Phek",
    "Shamator",
    "Tuensang",
    "Tseminyü",
    "Wokha",
    "Zunheboto"
],

"Odisha": [
    "Angul",
    "Balangir",
    "Balasore",
    "Bargarh",
    "Bhadrak",
    "Boudh",
    "Cuttack",
    "Deogarh",
    "Dhenkanal",
    "Gajapati",
    "Ganjam",
    "Jagatsinghpur",
    "Jajpur",
    "Jharsuguda",
    "Kalahandi",
    "Kandhamal",
    "Kendrapara",
    "Kendujhar",
    "Khordha",
    "Koraput",
    "Malkangiri",
    "Mayurbhanj",
    "Nabarangpur",
    "Nayagarh",
    "Nuapada",
    "Puri",
    "Rayagada",
    "Sambalpur",
    "Subarnapur",
    "Sundargarh"
],

"Punjab": [
    "Amritsar",
    "Barnala",
    "Bathinda",
    "Faridkot",
    "Fatehgarh Sahib",
    "Fazilka",
    "Ferozepur",
    "Gurdaspur",
    "Hoshiarpur",
    "Jalandhar",
    "Kapurthala",
    "Ludhiana",
    "Malerkotla",
    "Mansa",
    "Moga",
    "Mohali",
    "Muktsar",
    "Pathankot",
    "Patiala",
    "Rupnagar",
    "Sangrur",
    "Shaheed Bhagat Singh Nagar",
    "Tarn Taran"
],

"Rajasthan": [
    "Ajmer",
    "Alwar",
    "Anupgarh",
    "Balotra",
    "Banswara",
    "Baran",
    "Barmer",
    "Beawar",
    "Bharatpur",
    "Bhilwara",
    "Bikaner",
    "Bundi",
    "Chittorgarh",
    "Churu",
    "Dausa",
    "Deeg",
    "Dholpur",
    "Didwana-Kuchaman",
    "Dudu",
    "Dungarpur",
    "Gangapur City",
    "Hanumangarh",
    "Jaipur",
    "Jaipur Rural",
    "Jaisalmer",
    "Jalore",
    "Jhalawar",
    "Jhunjhunu",
    "Jodhpur",
    "Jodhpur Rural",
    "Karauli",
    "Kekri",
    "Khairthal-Tijara",
    "Kota",
    "Kotputli-Behror",
    "Nagaur",
    "Neem Ka Thana",
    "Pali",
    "Phalodi",
    "Pratapgarh",
    "Rajsamand",
    "Salumbar",
    "Sanchore",
    "Sawai Madhopur",
    "Shahpura",
    "Sikar",
    "Sirohi",
    "Sri Ganganagar",
    "Tonk",
    "Udaipur"
],

"Sikkim": [
    "Gangtok",
    "Gyalshing",
    "Mangan",
    "Namchi",
    "Pakyong",
    "Soreng"
],

"Tamil Nadu": [
    "Ariyalur",
    "Chengalpattu",
    "Chennai",
    "Coimbatore",
    "Cuddalore",
    "Dharmapuri",
    "Dindigul",
    "Erode",
    "Kallakurichi",
    "Kanchipuram",
    "Kanyakumari",
    "Karur",
    "Krishnagiri",
    "Madurai",
    "Mayiladuthurai",
    "Nagapattinam",
    "Namakkal",
    "Nilgiris",
    "Perambalur",
    "Pudukkottai",
    "Ramanathapuram",
    "Ranipet",
    "Salem",
    "Sivaganga",
    "Tenkasi",
    "Thanjavur",
    "Theni",
    "Thoothukudi",
    "Tiruchirappalli",
    "Tirunelveli",
    "Tirupathur",
    "Tiruppur",
    "Tiruvallur",
    "Tiruvannamalai",
    "Tiruvarur",
    "Vellore",
    "Viluppuram",
    "Virudhunagar"
],

"Telangana": [
    "Adilabad",
    "Bhadradri Kothagudem",
    "Hanamkonda",
    "Hyderabad",
    "Jagtial",
    "Jangaon",
    "Jayashankar Bhupalpally",
    "Jogulamba Gadwal",
    "Kamareddy",
    "Karimnagar",
    "Khammam",
    "Komaram Bheem Asifabad",
    "Mahabubabad",
    "Mahabubnagar",
    "Mancherial",
    "Medak",
    "Medchal-Malkajgiri",
    "Mulugu",
    "Nagarkurnool",
    "Nalgonda",
    "Narayanpet",
    "Nirmal",
    "Nizamabad",
    "Peddapalli",
    "Rajanna Sircilla",
    "Rangareddy",
    "Sangareddy",
    "Siddipet",
    "Suryapet",
    "Vikarabad",
    "Wanaparthy",
    "Warangal",
    "Yadadri Bhuvanagiri"
],

"Tripura": [
    "Dhalai",
    "Gomati",
    "Khowai",
    "North Tripura",
    "Sepahijala",
    "South Tripura",
    "Unakoti",
    "West Tripura"
],

"Uttar Pradesh": [
    "Agra",
    "Aligarh",
    "Ambedkar Nagar",
    "Amethi",
    "Amroha",
    "Auraiya",
    "Ayodhya",
    "Azamgarh",
    "Baghpat",
    "Bahraich",
    "Ballia",
    "Balrampur",
    "Banda",
    "Barabanki",
    "Bareilly",
    "Basti",
    "Bhadohi",
    "Bijnor",
    "Budaun",
    "Bulandshahr",
    "Chandauli",
    "Chitrakoot",
    "Deoria",
    "Etah",
    "Etawah",
    "Farrukhabad",
    "Fatehpur",
    "Firozabad",
    "Gautam Buddha Nagar",
    "Ghaziabad",
    "Ghazipur",
    "Gonda",
    "Gorakhpur",
    "Hamirpur",
    "Hapur",
    "Hardoi",
    "Hathras",
    "Jalaun",
    "Jaunpur",
    "Jhansi",
    "Kannauj",
    "Kanpur Dehat",
    "Kanpur Nagar",
    "Kasganj",
    "Kaushambi",
    "Kheri",
    "Kushinagar",
    "Lalitpur",
    "Lucknow",
    "Maharajganj",
    "Mahoba",
    "Mainpuri",
    "Mathura",
    "Mau",
    "Meerut",
    "Mirzapur",
    "Moradabad",
    "Muzaffarnagar",
    "Pilibhit",
    "Pratapgarh",
    "Prayagraj",
    "Raebareli",
    "Rampur",
    "Saharanpur",
    "Sambhal",
    "Sant Kabir Nagar",
    "Shahjahanpur",
    "Shamli",
    "Shravasti",
    "Siddharthnagar",
    "Sitapur",
    "Sonbhadra",
    "Sultanpur",
    "Unnao",
    "Varanasi"
],

"Uttarakhand": [
    "Almora",
    "Bageshwar",
    "Chamoli",
    "Champawat",
    "Dehradun",
    "Haridwar",
    "Nainital",
    "Pauri Garhwal",
    "Pithoragarh",
    "Rudraprayag",
    "Tehri Garhwal",
    "Udham Singh Nagar",
    "Uttarkashi"
],

"West Bengal": [
    "Alipurduar",
    "Bankura",
    "Birbhum",
    "Cooch Behar",
    "Dakshin Dinajpur",
    "Darjeeling",
    "Hooghly",
    "Howrah",
    "Jalpaiguri",
    "Jhargram",
    "Kalimpong",
    "Kolkata",
    "Malda",
    "Murshidabad",
    "Nadia",
    "North 24 Parganas",
    "Paschim Bardhaman",
    "Paschim Medinipur",
    "Purba Bardhaman",
    "Purba Medinipur",
    "Purulia",
    "South 24 Parganas",
    "Uttar Dinajpur"
]

}
# ── Coordinates for all 269 market-encoder-supported districts ───────────────
# Used exclusively for nearest-neighbour fallback in /predict/market.
# Generated from district_encoder.pkl classes. Do not edit manually.
_MARKET_DISTRICT_COORDS = {
    "Agar Malwa": (23.71, 76.01), "Agra": (27.18, 78.01), "Ahmedabad": (23.03, 72.57),
    "Ajmer": (26.45, 74.64), "Alappuzha": (9.49, 76.33), "Aligarh": (27.88, 78.08),
    "Alipurduar": (26.49, 89.53), "Alirajpur": (22.31, 74.36), "Alwar": (27.56, 76.61),
    "Ambedkarnagar": (26.47, 82.46), "Amethi": (26.15, 81.70), "Amreli": (21.60, 71.22),
    "Amritsar": (31.63, 74.87), "Amroha": (28.90, 78.46), "Anand": (22.56, 72.95),
    "Anantapur": (14.68, 77.60), "Anupgarh": (29.20, 73.21), "Anupur": (23.12, 81.70),
    "Ashoknagar": (24.58, 77.73), "Auraiya": (26.47, 79.51), "Ayodhya": (26.79, 82.20),
    "Azamgarh": (26.07, 83.18), "Badaun": (28.04, 79.12), "Badwani": (22.00, 74.89),
    "Baghpat": (28.95, 77.22), "Bahraich": (27.57, 81.59), "Balaghat": (21.81, 80.19),
    "Ballia": (25.76, 84.15), "Balotra": (25.83, 72.24), "Balrampur": (27.43, 82.19),
    "Banaskanth": (24.17, 72.42), "Banda": (25.47, 80.34), "Bankura": (23.23, 87.07),
    "Barabanki": (26.94, 81.19), "Baran": (25.10, 76.52), "Bareilly": (28.36, 79.41),
    "Barmer": (25.75, 71.39), "Barnala": (30.38, 75.55), "Basti": (26.80, 82.73),
    "Beawar": (26.10, 74.32), "Betul": (21.91, 77.90), "Bhadohi(Sant Ravi Nagar)": (25.39, 82.57),
    "Bharatpur": (27.22, 77.49), "Bharuch": (21.71, 73.00), "Bhatinda": (30.21, 74.95),
    "Bhavnagar": (21.76, 72.15), "Bhilwara": (25.35, 74.63), "Bhind": (26.56, 78.79),
    "Bhopal": (23.26, 77.41), "Bijnor": (29.37, 78.14), "Bikaner": (28.02, 73.31),
    "Birbhum": (23.89, 87.53), "Botad": (22.17, 71.66), "Bulandshahar": (28.41, 77.85),
    "Bundi": (25.44, 75.64), "Burhanpur": (21.31, 76.23), "Chandauli": (25.27, 83.27),
    "Chhatarpur": (24.92, 79.60), "Chhindwara": (22.06, 78.94), "Chhota Udaipur": (22.30, 74.01),
    "Chitrakut": (25.20, 81.01), "Chittor": (13.21, 79.10), "Chittorgarh": (24.89, 74.62),
    "Churu": (28.30, 74.96), "Coochbehar": (26.32, 89.45), "Cuddapah": (14.47, 78.82),
    "Dahod": (22.83, 74.25), "Dakshin Dinajpur": (25.62, 88.76), "Damoh": (23.83, 79.44),
    "Dang": (20.76, 73.69), "Darjeeling": (27.03, 88.26), "Datia": (25.67, 78.46),
    "Dausa": (26.89, 76.34), "Deedwana Kuchaman": (27.40, 74.59), "Deeg": (27.47, 77.32),
    "Deoria": (26.51, 83.78), "Devbhumi Dwarka": (22.23, 69.01), "Dewas": (22.97, 76.05),
    "Dhar": (22.60, 75.30), "Dholpur": (26.70, 77.89), "Dindori": (22.94, 81.08),
    "Dudu": (26.73, 75.72), "Dungarpur": (23.84, 73.72), "East Godavari": (17.00, 82.00),
    "Ernakulam": (9.98, 76.29), "Etah": (27.56, 78.66), "Etawah": (26.79, 79.01),
    "Faridkot": (30.67, 74.75), "Farukhabad": (27.39, 79.58), "Fatehgarh": (27.37, 79.63),
    "Fatehpur": (25.93, 80.82), "Fazilka": (30.40, 74.03), "Ferozpur": (30.93, 74.61),
    "Firozabad": (27.15, 78.39), "Gandhinagar": (23.22, 72.65), "Ganganagar": (29.92, 73.88),
    "Gangapur City": (26.47, 76.72), "Gautam Budh Nagar": (28.57, 77.33), "Ghaziabad": (28.67, 77.45),
    "Ghazipur": (25.58, 83.57), "Gir Somnath": (20.91, 70.36), "Gonda": (27.13, 81.96),
    "Gorakhpur": (26.76, 83.37), "Guna": (24.65, 77.31), "Guntur": (16.30, 80.44),
    "Gurdaspur": (32.04, 75.41), "Gwalior": (26.22, 78.18), "Hamirpur": (25.95, 80.15),
    "Hanumangarh": (29.58, 74.33), "Harda": (22.34, 77.10), "Hardoi": (27.39, 80.13),
    "Hathras": (27.60, 78.05), "Hooghly": (22.90, 88.39), "Hoshangabad": (22.75, 77.73),
    "Hoshiarpur": (31.53, 75.91), "Howrah": (22.59, 88.31), "Idukki": (9.85, 77.10),
    "Indore": (22.72, 75.86), "Jabalpur": (23.18, 79.95), "Jaipur": (26.91, 75.79),
    "Jaipur Rural": (26.83, 75.60), "Jaisalmer": (26.91, 70.91), "Jalandhar": (31.33, 75.57),
    "Jalaun (Orai)": (25.98, 79.45), "Jalore": (25.35, 72.61), "Jalpaiguri": (26.52, 88.73),
    "Jamnagar": (22.47, 70.06), "Jaunpur": (25.73, 82.69), "Jhabua": (22.77, 74.59),
    "Jhalawar": (24.59, 76.16), "Jhansi": (25.45, 78.57), "Jhargram": (22.45, 86.99),
    "Jhunjhunu": (28.13, 75.39), "Jodhpur": (26.29, 73.02), "Jodhpur Rural": (26.17, 73.11),
    "Junagarh": (21.52, 70.46), "Kachchh": (23.20, 69.78), "Kalimpong": (27.06, 88.47),
    "Kannuj": (27.05, 79.92), "Kannur": (11.87, 75.37), "Kanpur": (26.46, 80.35),
    "Kanpur Dehat": (26.42, 79.82), "Karauli": (26.49, 77.01), "Kasargod": (12.50, 74.98),
    "Kasganj": (27.81, 78.64), "Katni": (23.83, 80.40), "Kaushambi": (25.53, 81.38),
    "Kekri": (25.97, 75.16), "Khairthal Tijara": (27.82, 76.65), "Khandwa": (21.83, 76.35),
    "Khargone": (21.82, 75.61), "Kheda": (22.75, 72.68), "Khiri (Lakhimpur)": (27.95, 80.77),
    "Kolkata": (22.57, 88.36), "Kollam": (8.89, 76.60), "Kota": (25.18, 75.84),
    "Kotputli- Behror": (27.70, 76.20), "Kottayam": (9.59, 76.52), "Kozhikode(Calicut)": (11.25, 75.77),
    "Krishna": (16.61, 81.03), "Kurnool": (15.83, 78.04), "Kushinagar": (26.74, 83.89),
    "Lakhimpur": (27.95, 80.77), "Lalitpur": (24.69, 78.41), "Lucknow": (26.85, 80.95),
    "Ludhiana": (30.90, 75.85), "Maharajganj": (27.15, 83.56), "Mahoba": (25.29, 79.87),
    "Mainpuri": (27.23, 79.01), "Malappuram": (11.07, 76.07), "Malda": (25.00, 88.14),
    "Mandla": (22.60, 80.38), "Mandsaur": (24.07, 75.07), "Mansa": (29.99, 75.39),
    "Mathura": (27.50, 77.67), "Mau(Maunathbhanjan)": (25.94, 83.56), "Medinipur(E)": (22.43, 87.32),
    "Medinipur(W)": (22.42, 87.27), "Meerut": (28.98, 77.71), "Mehsana": (23.59, 72.38),
    "Mirzapur": (25.14, 82.57), "Moga": (30.82, 75.17), "Mohali": (30.71, 76.69),
    "Morbi": (22.82, 70.84), "Morena": (26.50, 77.99), "Muktsar": (30.47, 74.52),
    "Murshidabad": (24.18, 88.27), "Muzaffarnagar": (29.47, 77.70), "Nadia": (23.47, 88.55),
    "Nagaur": (27.20, 73.73), "Narmada": (21.87, 73.49), "Narsinghpur": (22.95, 79.19),
    "Navsari": (20.95, 72.92), "Nawanshahr": (31.12, 76.12), "Neem Ka Thana": (27.74, 75.79),
    "Neemuch": (24.47, 74.87), "Nellore": (14.44, 79.99), "North 24 Parganas": (22.74, 88.39),
    "Palakad": (10.78, 76.65), "Pali": (25.77, 73.32), "Panchmahals": (22.73, 73.58),
    "Panna": (24.72, 80.19), "Paschim Bardhaman": (23.23, 87.08), "Patan": (23.85, 72.12),
    "Pathanamthitta": (9.27, 76.77), "Pathankot": (32.27, 75.65), "Patiala": (30.34, 76.38),
    "Phalodi": (27.13, 72.37), "Pillibhit": (28.63, 79.80), "Porbandar": (21.64, 69.61),
    "Pratapgarh": (25.54, 81.96), "Prayagraj": (25.44, 81.84), "Purba Bardhaman": (23.23, 87.85),
    "Puruliya": (23.34, 86.37), "Raebarelli": (26.23, 81.24), "Raisen": (23.33, 77.79),
    "Rajgarh": (24.03, 76.73), "Rajkot": (22.30, 70.80), "Rajsamand": (25.07, 73.88),
    "Rampur": (28.80, 79.02), "Ratlam": (23.33, 75.04), "Rewa": (24.53, 81.30),
    "Ropar (Rupnagar)": (30.97, 76.53), "Sabarkantha": (23.58, 73.02), "Sagar": (23.84, 78.74),
    "Saharanpur": (29.97, 77.55), "Sambhal": (28.59, 78.57), "Sanchore": (24.75, 71.79),
    "Sangrur": (30.24, 75.84), "Sant Kabir Nagar": (26.79, 83.04), "Satna": (24.60, 80.83),
    "Sehore": (23.20, 77.09), "Seoni": (22.09, 79.54), "Shahjahanpur": (27.88, 79.91),
    "Shajapur": (23.43, 76.28), "Shamli": (29.45, 77.31), "Shehdol": (23.29, 81.35),
    "Sheopur": (25.67, 76.71), "Shivpuri": (25.43, 77.66), "Shravasti": (27.51, 82.04),
    "Siddharth Nagar": (27.26, 83.08), "Sidhi": (24.42, 81.88), "Sikar": (27.61, 75.14),
    "Singroli": (24.20, 82.67), "Sirohi": (24.88, 72.86), "Sitapur": (27.57, 80.68),
    "Sonbhadra": (24.68, 83.08), "Sounth 24 Parganas": (22.16, 88.51), "Surat": (21.17, 72.83),
    "Surendranagar": (22.73, 71.65), "Swai Madhopur": (26.02, 76.35), "Tarntaran": (31.45, 74.93),
    "Thirssur": (10.52, 76.21), "Thiruvananthapuram": (8.52, 76.94), "Tikamgarh": (24.74, 78.84),
    "Tonk": (26.17, 75.79), "Udaipur": (24.58, 73.69), "Ujjain": (23.18, 75.78),
    "Umariya": (23.52, 80.84), "Unnao": (26.54, 80.50), "Uttar Dinajpur": (26.34, 88.07),
    "Vadodara(Baroda)": (22.30, 73.19), "Valsad": (20.59, 72.93), "Varanasi": (25.32, 83.00),
    "Vidisha": (23.53, 77.82), "Visakhapatnam": (17.69, 83.22), "Wayanad": (11.61, 76.08),
    "West Godavari": (16.91, 81.34), "kapurthala": (31.38, 75.38),
}

def _find_nearest_market_district(district_name: str) -> str | None:
    """
    Given any Indian district name, return the nearest district that IS
    in district_encoder.pkl, using Haversine distance.

    Steps:
      1. Geocode the requested district (uses existing _geocode_district cache)
      2. Compare to all 269 supported-district coords in _MARKET_DISTRICT_COORDS
      3. Return the closest one by great-circle distance

    Returns None only if geocoding completely fails AND no hardcoded coords exist.
    """
    coords = _geocode_district(district_name)
    if not coords:
        print(f"  ⚠ _find_nearest_market_district: geocode failed for '{district_name}'")
        return None, None

    lat, lon = coords
    best_dist   = float("inf")
    best_name   = None

    for enc_name, (elat, elon) in _MARKET_DISTRICT_COORDS.items():
        d = _haversine_km(lat, lon, elat, elon)
        if d < best_dist:
            best_dist = d
            best_name = enc_name

    print(f"  ↻ Nearest market district to '{district_name}': '{best_name}' ({best_dist:.0f} km)")
    return best_name, best_dist

@app.route("/", methods=["GET"])
def home():
    now = datetime.now()
    return render_template(
        "index.html",
        districts=list(fert_district_enc.classes_),
        markets=list(market_enc.classes_),
        commodities=list(commodity_enc.classes_),
        current_year=now.year,
        current_month=now.month,
        market_model_available=(market_model is not None),
    )


@app.route("/encoders", methods=["GET"])
def encoders():
    return jsonify(

        state_districts=STATE_DISTRICTS,

        districts=sorted(
            fert_district_enc.classes_.tolist()
        ),

        markets=list(market_enc.classes_),

        commodities=list(commodity_enc.classes_),

        market_model_available=(market_model is not None),
    )

_weather_cache: dict = {}
_weather_cache_lock = threading.Lock()
_elevation_cache: dict = {}
 
def _get_elevation(lat: float, lon: float) -> float:
    """Fetch elevation in meters — free Open-Meteo API, cached per 0.01° grid."""
    key = (round(lat, 2), round(lon, 2))
    if key in _elevation_cache:
        return _elevation_cache[key]
    elevation = 0.0
    try:
        url = f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}"
        resp = requests.get(url, timeout=4)
        resp.raise_for_status()
        elevation = float(resp.json().get("elevation", [0.0])[0])
    except Exception as exc:
        print(f"  ⚠ elevation fetch failed ({lat},{lon}): {exc}")
    _elevation_cache[key] = elevation
    return elevation
 
def _fetch_forecast_uncached(lat: float, lon: float) -> dict | None:
    """Raw Open-Meteo call — NO caching here, caller owns the cache."""
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,relative_humidity_2m,precipitation_probability,"
        f"precipitation,wind_speed_10m,apparent_temperature"
        f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum"
        f"&timezone=auto&forecast_days=7"
    )
    try:
        response = requests.get(url, timeout=6)
        response.raise_for_status()
        data = response.json()
        daily = data.get("daily", {})
        return {
            "dates":         daily.get("time", []),
            "temp_max":      daily.get("temperature_2m_max", []),
            "temp_min":      daily.get("temperature_2m_min", []),
            "precipitation": daily.get("precipitation_sum", []),
            "current":       data.get("current", {}),
        }
    except Exception as e:
        print(f"Error fetching weather for ({lat},{lon}): {e}")
        return None
 
 
@app.route("/weather", methods=["GET"])
def get_weather():
    lat_raw = request.args.get("lat")
    lon_raw = request.args.get("lon")
    if not lat_raw or not lon_raw:
        return jsonify(success=False, error="lat and lon are required"), 400

    lat = round(safe_float(lat_raw), 4)
    lon = round(safe_float(lon_raw), 4)

    if lat == 0.0 and lon == 0.0:
        return jsonify(success=False, error="Invalid coordinates"), 400

    today = date.today().isoformat()
    cache_key = (lat, lon, today)

    with _weather_cache_lock:
        cached = _weather_cache.get(cache_key)
    if cached:
        print(f"  ✓ Weather cache HIT  ({lat},{lon})")
        return jsonify(success=True, data=cached["forecast"], elevation=cached["elevation"])

    print(f"  ↻ Weather cache MISS ({lat},{lon}) — fetching from Open-Meteo…")

    forecast  = _fetch_forecast_uncached(lat, lon)
    elevation = _get_elevation(lat, lon)

    if not forecast:
        return jsonify(success=False, error="Failed to fetch weather data", elevation=elevation), 502

    with _weather_cache_lock:
        _weather_cache[cache_key] = {"forecast": forecast, "elevation": elevation}
        stale = [k for k in _weather_cache if k[2] != today]
        for k in stale:
            del _weather_cache[k]

    return jsonify(success=True, data=forecast, elevation=elevation)

def calculate_soil_health(ph, N, P, K, temp):
    # Weighted formula: 30% pH + 25% N + 20% P + 15% K + 10% Climate
    ph_score = max(0, 100 - abs(ph - 6.5) * 20)
    n_score = min(100, (N / 120) * 100) if N > 0 else 50
    p_score = min(100, (P / 60) * 100) if P > 0 else 50
    k_score = min(100, (K / 60) * 100) if K > 0 else 50
    temp_score = max(0, 100 - abs(temp - 25) * 3)
    
    overall_score = round((0.30 * ph_score) + (0.25 * n_score) + (0.20 * p_score) + (0.15 * k_score) + (0.10 * temp_score))
    return {"score": overall_score, "ph_score": round(ph_score), "n_score": round(n_score), "p_score": round(p_score), "k_score": round(k_score)}


@app.route("/predict", methods=["POST"])
def predict():
    """
    Soil + weather → crop recommendation, yield, fertilizer price.

    JSON / form fields: N, P, K, temperature, humidity, ph, rainfall
    """
    data = request.get_json(silent=True) or request.form

    N           = safe_float(data.get("N"))
    P           = safe_float(data.get("P"))
    K           = safe_float(data.get("K"))
    temperature = safe_float(data.get("temperature"))
    humidity    = safe_float(data.get("humidity"))
    ph          = safe_float(data.get("ph"))
    rainfall    = safe_float(data.get("rainfall"))
    district    = str(data.get("district", "")).strip().lower()
    selected_crop = str(
      data.get("selectedCrop", "")
    ).strip().lower()

    print(
    f"📥 REQUEST: "
    f"N={N}, P={P}, K={K}, "
    f"temp={temperature}, hum={humidity}, "
    f"ph={ph}, rain={rainfall}, "
    f"district={district}, "
    f"selected_crop={selected_crop}"
    )

    # Validation
    errors = []
    if not (0 <= N <= 300):      errors.append("N (Nitrogen) must be 0–300 kg/ha.")
    if not (0 <= P <= 300):      errors.append("P (Phosphorus) must be 0–300 kg/ha.")
    if not (0 <= K <= 300):      errors.append("K (Potassium) must be 0–300 kg/ha.")
    if not (-10 <= temperature <= 60): errors.append("Temperature must be −10 to 60 °C.")
    if not (0 <= humidity <= 100):     errors.append("Humidity must be 0–100 %.")
    if not (0 <= ph <= 14):            errors.append("pH must be 0–14.")
    rainfall = max(0.0, float(rainfall))
    if not (0 <= rainfall): errors.append("Rainfall must be 0 or above.")
    if errors:
        return jsonify(success=False, errors=errors), 400

    # 1. Crop recommendation  [N, P, K, temperature, humidity, ph, rainfall]
    crop_feat  = np.array([[N, P, K, temperature, humidity, ph, rainfall]])
    crop_proba = crop_model.predict_proba(crop_feat)[0]

    crop_scores = {}
    selected_crop_score = 0        # ← moved BEFORE the loop

    for crop, prob in zip(crop_model.classes_, crop_proba):

        crop_name = crop_label(crop)

        score = float(prob * 100)
        crop_scores[crop_name] = score

    for crop, prob in zip(crop_model.classes_, crop_proba):

       crop_name = crop_label(crop)

       if crop_name.lower() == selected_crop:

           selected_crop_score = round(
            float(prob * 100),
            4          # 4dp: preserves 0.003% instead of rounding to 0.00
            )

           break
    
    print(f"🌾 MODEL INPUT: {crop_feat.tolist()}")
    
    sorted_crops = sorted(
      crop_scores.items(),
      key=lambda x: x[1],
      reverse=True
      )

    recommended_crop = sorted_crops[0][0]
    top3_crops = [
        {
           "crop": crop,
           "probability": round(score, 2)
        }
        for crop, score in sorted_crops[:3]
    ]
    all_crop_scores = [
       {
        "crop": crop,
        "probability": round(score, 2)
       }
       for crop, score in sorted_crops
    ]

    all_crop_scores = sorted(
      all_crop_scores,
      key=lambda x: x["probability"],
      reverse=True
    )

    # Feature order must match yield_model training schema exactly:
    # [N, P, K, rainfall, temperature, humidity] — 6 features
    # If model crashes here, check: yield_model.n_features_in_ and training column order
    yield_feat = np.array([[N, P, K, rainfall, temperature, humidity]])

    _raw_yield = float(yield_model.predict(yield_feat)[0])

    # Crop-specific realistic yield ranges (t/ha) for sanity clamping
    CROP_YIELD_RANGES = {
    "Rice": (1.5, 8.0), "Wheat": (1.5, 7.0), "Maize": (2.0, 10.0),
    "Chickpea": (0.5, 3.0), "Kidneybeans": (0.5, 3.0), "Pigeonpeas": (0.4, 2.5),
    "Mothbeans": (0.3, 1.8), "Mungbean": (0.4, 2.0), "Blackgram": (0.4, 2.0),
    "Lentil": (0.5, 2.5), "Pomegranate": (5.0, 25.0), "Banana": (20.0, 60.0),
    "Mango": (5.0, 20.0), "Grapes": (8.0, 35.0), "Watermelon": (15.0, 50.0),
    "Muskmelon": (10.0, 35.0), "Apple": (5.0, 25.0), "Orange": (8.0, 30.0),
    "Papaya": (20.0, 60.0), "Coconut": (5.0, 18.0), "Cotton": (0.3, 2.0),
    "Jute": (1.5, 4.0), "Coffee": (0.5, 3.0),
    }

    # Model outputs in kg/ha — convert to t/ha
    _yield_t_ha = _raw_yield / 1000.0

    # If raw output is suspiciously tiny (model returned t/ha already or tiny value),
    # treat the raw value itself as t/ha
    if _yield_t_ha < 0.1:
       _yield_t_ha = _raw_yield

    # Apply crop-specific clamp
    crop_name = crop_label(recommended_crop)
    y_min, y_max = CROP_YIELD_RANGES.get(crop_name, (0.5, 15.0))
    estimated_yield = round(max(y_min, min(_yield_t_ha, y_max)), 2)

    print(f"🌾 YIELD DEBUG: raw={_raw_yield} kg/ha → {_yield_t_ha} t/ha → clamped={estimated_yield} t/ha")
    
    # Apply name mapping before encoding
    district_lookup = DISTRICT_NAME_MAP.get(district, district)
    district_code, err = encode_label(fert_district_enc, district_lookup)
    if err:
      district_code = len(fert_district_enc.classes_) // 2
      print(f"⚠ District '{district}' not found in encoder, using median fallback code {district_code}")
    
   # Weather-adjusted NPK
    rain_factor     = 1.0 + (rainfall - 1000) * 0.00008
    temp_factor     = 1.0 + (temperature - 25) * 0.006
    humidity_factor = 1.0 + (humidity - 70) * 0.003
    field_size  = safe_float(data.get("field_size", 1.0))

    adjusted_N = round(N * temp_factor * (1 + (rainfall - 1000) * 0.00005), 1)
    adjusted_P = round(P * rain_factor, 1)
    adjusted_K = round(K * humidity_factor, 1)

    # fertilizer_price_model feature order (9 features):
    # [N_adj, P_adj, K_adj, rainfall, temperature, humidity,
    #  yield_t_per_ha, field_size_ha, district_code]
    # Verify against: fertilizer_model.n_features_in_ (should be 9)
    fert_feat = np.array([[
        adjusted_N,
        adjusted_P,
        adjusted_K,
        rainfall,
        temperature,
        humidity,
        estimated_yield,
        field_size,
        district_code
    ]])
    if fertilizer_model is not None:
       base_price = float(fertilizer_model.predict(fert_feat)[0])
       fertilizer_price = round(base_price, 2)
    else:
       fertilizer_price = 1200.0  # sensible fallback ₹/bag
    
    print(f"🌾 RESULT: {recommended_crop}")

    # 4. Soil health
    soil_health = calculate_soil_health(ph, N, P, K, temperature)
    
    # 5. Fertilizer type — pass district for dynamic price calculation
    fert_type = predict_fert_internal(
    temperature, round(humidity / 100, 4), rainfall, ph,
    adjusted_N, adjusted_P, adjusted_K, 1.5,
    recommended_crop.lower(), "Loamy Soil",
    district_name=district_lookup,
    district_code=district_code,
    )
    return jsonify(
    success=True,
    inputs=dict(
        N=adjusted_N,
        P=adjusted_P,
        K=adjusted_K,
        temperature=temperature,
        humidity=humidity,
        ph=ph,
        rainfall=rainfall,
        district=district,
        fieldSize=field_size,
    ),

    predictions=dict(

        crop_recommendation=dict(
          recommended_crop=recommended_crop,
          selected_crop=selected_crop,
          selected_crop_score=selected_crop_score,
          top_3_crops=top3_crops,
          all_crop_scores=all_crop_scores
        ),

        yield_prediction=dict(
            estimated_yield_tonnes_per_ha=estimated_yield,
            unit="tonnes/hectare",
        ),

        fertilizer_price_prediction=dict(
            estimated_price_inr=fertilizer_price,
            unit="INR per 50 kg bag",
        ),

        fertilizer_type=fert_type,

        soil_health={**soil_health, "method": "rule_based"},

      ),
  )


@app.route("/predict/market", methods=["POST"])
def predict_market():
    """
    Market price prediction → min / max / modal price (₹ / quintal).

    JSON / form fields
    ──────────────────
    district   – district name (string, must match district_encoder classes)
    market     – market name   (string, must match market_encoder classes)
    commodity  – commodity     (string, must match commodity_encoder classes)
    year       – 4-digit year  (int, e.g. 2025)
    month      – month number  (int, 1–12)
    """
    # Guard: model not yet on disk
    if market_model is None:
        return jsonify(
            success=False,
            error=(
                "market_price_model.pkl is not loaded. "
                "Place the file in the models/ folder and restart the server."
            ),
        ), 503

    data = request.get_json(silent=True) or request.form

    district_name  = str(data.get("district", "")).strip()
    market_name    = str(data.get("market",   "")).strip()
    commodity_name = str(data.get("commodity","")).strip()
    year           = safe_int(data.get("year"),  datetime.now().year)
    month          = safe_int(data.get("month"), datetime.now().month)

    print(f"📥 MARKET REQUEST: district={district_name}, market={market_name}, commodity={commodity_name}")

    # Validate required strings
    errors = []
    if not district_name:  errors.append("district is required.")
    if not market_name:    errors.append("market is required.")
    if not commodity_name: errors.append("commodity is required.")
    if not (1 <= month <= 12):    errors.append("month must be 1–12.")
    if not (2000 <= year <= 2100): errors.append("year must be 2000–2100.")
    if errors:
        return jsonify(success=False, errors=errors), 400

    # Encode labels
    if market_district_enc is None:
        return jsonify(
            success=False,
            error="district_encoder.pkl is not loaded. Add it to models/ and restart."
        ), 503

    # ── Step 1: normalise alias names (same pattern as /predict) ────────────
    MARKET_DISTRICT_NAME_MAP = {
        # UI name                       → exact encoder class
        "ambedkar nagar":               "Ambedkarnagar",
        "bhadohi":                      "Bhadohi(Sant Ravi Nagar)",
        "jalaun":                       "Jalaun (Orai)",
        "kheri":                        "Khiri (Lakhimpur)",
        "lakhimpur":                    "Lakhimpur",
        "kozhikode":                    "Kozhikode(Calicut)",
        "mau":                          "Mau(Maunathbhanjan)",
        "purba medinipur":              "Medinipur(E)",
        "paschim medinipur":            "Medinipur(W)",
        "north 24 parganas":            "North 24 Parganas",
        "south 24 parganas":            "Sounth 24 Parganas",
        "rupnagar":                     "Ropar (Rupnagar)",
        "vadodara":                     "Vadodara(Baroda)",
        "kapurthala":                   "kapurthala",
        "thrissur":                     "Thirssur",
        "thiruvananthapuram":           "Thiruvananthapuram",
        "prayagraj":                    "Prayagraj",
        "kushinagar":                   "Kushinagar",
        "kushi nagar":                  "Kushinagar",
        "sant kabir nagar":             "Sant Kabir Nagar",
        "sant kabeer nagar":            "Sant Kabir Nagar",
        "raebareli":                    "Raebarelli",
        "rae bareli":                   "Raebarelli",
        "farrukhabad":                  "Farukhabad",
        "fatehgarh sahib":              "Fatehgarh",
        "ferozepur":                    "Ferozpur",
        "mohali":                       "Mohali",
        "shaheed bhagat singh nagar":   "Nawanshahr",
        "bulandshahr":                  "Bulandshahar",
        "gautam buddha nagar":          "Gautam Budh Nagar",
        "kanpur nagar":                 "Kanpur",
        "singrauli":                    "Singroli",
        "anuppur":                      "Anupur",
        "kutch":                        "Kachchh",
        "banaskantha":                  "Banaskanth",
        "panchmahal":                   "Panchmahals",
        "sabarkantha":                  "Sabarkantha",
        "mehsana":                      "Mehsana",
        "kanyakumari":                  "Kanyakumari",   # not in encoder, will fallback
        "sri ganganagar":               "Ganganagar",
        "sawai madhopur":               "Swai Madhopur",
        "didwana-kuchaman":             "Deedwana Kuchaman",
        "khairthal-tijara":             "Khairthal Tijara",
        "kotputli-behror":              "Kotputli- Behror",
        "kolkata":                      "Kolkata",
        "dakshin dinajpur":             "Dakshin Dinajpur",
        "uttar dinajpur":               "Uttar Dinajpur",
        "purba bardhaman":              "Purba Bardhaman",
        "paschim bardhaman":            "Paschim Bardhaman",
        "purulia":                      "Puruliya",
        "malda":                        "Malda",
        "palakkad":                     "Palakad",
        "kasaragod":                    "Kasargod",
        "thrissur":                     "Thirssur",
        "cuddapah":                     "Cuddapah",
        "ys r kadapa":                  "Cuddapah",
        "ysr kadapa":                   "Cuddapah",
        "visakhapatnam":                "Visakhapatnam",
        "west godavari":                "West Godavari",
        "east godavari":                "East Godavari",
        "guntur":                       "Guntur",
        "krishna":                      "Krishna",
        "nellore":                      "Nellore",
        "kurnool":                      "Kurnool",
        "chittoor":                     "Chittor",
        "anantapur":                    "Anantapur",
    }

    is_fallback         = False
    fallback_district   = None
    fallback_confidence_penalty = 0   # subtracted from confidence in response

    district_lookup = MARKET_DISTRICT_NAME_MAP.get(
        district_name.lower(), district_name
    )

    district_code, err = encode_label(market_district_enc, district_lookup)

    # ── Step 3: if still not found → nearest-supported-district fallback ─────
    if err:
        result = _find_nearest_market_district(district_name)
        if result is None or result[0] is None:
            return jsonify(success=False, errors=[f"District: {err}"]), 400
        nearest, fallback_dist_km = result
        district_lookup  = nearest
        district_code, _ = encode_label(market_district_enc, nearest)
        is_fallback              = True
        fallback_district        = nearest
        # Scale penalty: 0 pts at 0km, 12 pts at 200km, 25 pts at 600km+
        fallback_confidence_penalty = min(25, round(fallback_dist_km / 200 * 12))
        print(f"⚠ Market fallback: '{district_name}' → '{nearest}' (nearest supported)")

    market_code, err = encode_label(market_enc, market_name)
    if err: return jsonify(success=False, errors=[f"Market: {err}"]), 400

    commodity_code, err = encode_label(commodity_enc, commodity_name)
    if err: return jsonify(success=False, errors=[f"Commodity: {err}"]), 400

    # Feature vector: [District_Code, Market_Code, Commodity_Code, Year, Month]
    # CORRECT — month at index 3, year at index 4
    features = np.array([[district_code, market_code, commodity_code, month, year]])
    prediction = market_model.predict(features)[0]

    # Model may output a single value or an array of three [min, max, modal]
    if hasattr(prediction, "__len__") and len(prediction) == 3:
        min_price, max_price, modal_price = (round(float(v), 2) for v in prediction)
    else:
        # Single-output model — derive a ±10 % range as a sensible fallback
        modal_price = round(float(prediction), 2)
        min_price   = round(modal_price * 0.90, 2)
        max_price   = round(modal_price * 1.10, 2)

    print(f"💰 MARKET RESULT: min={min_price}, modal={modal_price}, max={max_price}")

    return jsonify(
        success=True,
        is_fallback=is_fallback,
        fallback_district=fallback_district,
        fallback_confidence_penalty=fallback_confidence_penalty,
        inputs=dict(
            district=district_name,
            market=market_name,
            commodity=commodity_name,
            year=year,
            month=month,
        ),
        predictions=dict(
            market_price=dict(
                min_price_inr_per_quintal=min_price,
                max_price_inr_per_quintal=max_price,
                modal_price_inr_per_quintal=modal_price,
                unit="INR per quintal (100 kg)",
            )
        ),
    )

@app.route("/predict/fertilizer-type", methods=["POST"])
def predict_fertilizer_type():
    if fert_type_model is None:
        return jsonify(success=False, error="fertilizer_type_model.pkl not loaded."), 503

    data        = request.get_json(silent=True) or request.form
    temperature = safe_float(data.get("temperature", 27))
    moisture = safe_float(data.get("moisture", 60)) / 100.0
    rainfall    = safe_float(data.get("rainfall", 1000))
    ph          = safe_float(data.get("ph", 6.5))
    N           = safe_float(data.get("N", 80))
    P           = safe_float(data.get("P", 40))
    K           = safe_float(data.get("K", 40))
    carbon      = safe_float(data.get("carbon", 1.5))
    crop        = str(data.get("crop", "rice")).strip().lower()
    soil        = str(data.get("soil", "Loamy Soil")).strip()

    # Encode crop
    crop_classes = list(fert_crop_enc2.classes_)
    crop_lower   = {c.lower(): c for c in crop_classes}
    _FERT_CROP_NAME_MAP = {
       'kidneybeans': 'kidney beans',
       'pigeonpeas':  'pigeon peas',
       'mothbeans':   'moth beans',
       'mungbean':    'mung bean',
       'blackgram':   'black gram',
    }
    crop_normalized = _FERT_CROP_NAME_MAP.get(crop.lower(), crop.lower())
    crop_matched = crop_lower.get(crop_normalized, crop_classes[0])
    crop_code    = int(fert_crop_enc2.transform([crop_matched])[0])

    # Encode soil
    soil_classes = list(fert_soil_enc2.classes_)
    soil_lower   = {s.lower(): s for s in soil_classes}
    soil_matched = soil_lower.get(soil.lower(), soil_classes[2])
    soil_code    = int(fert_soil_enc2.transform([soil_matched])[0])

    feat      = np.array([[temperature, moisture, rainfall, ph, N, P, K, carbon, crop_code, soil_code]])
    pred_code = int(fert_type_model.predict(feat)[0])
    fert_name = fert_type_enc.classes_[pred_code]
    fert_price = FERT_PRICES.get(fert_name, 800)

    proba = fert_type_model.predict_proba(feat)[0]
    top3  = sorted(
        [{"fertilizer": fert_type_enc.classes_[i],
          "probability": round(float(p) * 100, 1),
          "price": FERT_PRICES.get(fert_type_enc.classes_[i], 800)}
         for i, p in enumerate(proba)],
        key=lambda x: x["probability"], reverse=True
    )[:3]

    return jsonify(
        success=True,
        recommended_fertilizer=fert_name,
        price_per_bag_inr=fert_price,
        top_3=top3,
        soil_type=soil_matched,
    )

@app.route("/status", methods=["GET"])
def status():
    """Returns which models are loaded so the frontend can disable unavailable features."""
    return jsonify(
        crop_model=crop_model is not None,
        yield_model=yield_model is not None,
        fertilizer_price_model=fertilizer_model is not None,
        fertilizer_type_model=fert_type_model is not None,
        market_price_model=market_model is not None,
        market_district_encoder=market_district_enc is not None,
    )


if __name__ == "__main__":
    app.run(debug=True)