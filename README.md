# AgroWEB — Sustainable E-Agriculture Data Platform

<div align="center">

![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5+-646CFF?style=flat-square&logo=vite&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0+-000000?style=flat-square&logo=flask&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-1.4+-F7931E?style=flat-square&logo=scikit-learn&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

**A full-stack agricultural intelligence platform delivering ML-powered crop advisory, yield prediction, fertilizer strategy, irrigation scheduling, pest and disease intelligence, and market price forecasting — covering 23 crops across 723 Indian districts.**

[Modules](#modules) · [Architecture](#architecture) · [ML Models](#ml-models) · [Setup](#setup) · [API Reference](#api-reference) · [Deployment](#deployment)

</div>

---

## Overview

AgroWEB is a data-driven e-agriculture platform built to help Indian farmers and agronomists make evidence-based decisions at every stage of the farming cycle. It integrates a suite of scikit-learn ML models with real-time weather data from the Open-Meteo API, district-level soil data, and Haversine-based nearest-neighbour fallback for unrecognised locations.

The platform covers the full agricultural lifecycle — from pre-season crop selection and fertilizer planning, through in-season irrigation and pest monitoring, to post-harvest market price prediction and season-end reporting.

---

## Modules

| Module | Description |
|---|---|
| **Crop Recommendation** | Recommends the best-fit crop from 23 varieties based on soil NPK, pH, rainfall, and climate zone |
| **Yield Prediction** | Predicts expected yield (t/ha) using district, crop type, area, and weather-adjusted historical data |
| **Fertilizer Strategy** | Prescribes NPK dosage and fertilizer type based on soil deficiency analysis and crop requirements |
| **Irrigation Management** | Generates weekly irrigation schedules using FAO-56 Penman-Monteith proxy calculations and 7-day Open-Meteo forecasts |
| **Pest & Disease Intelligence** | Estimates crop-specific pest/disease risk using multi-variable weather and agro-climatic zone analysis |
| **Market Price Prediction** | Forecasts mandi price trends using historical patterns with Haversine nearest-neighbour fallback for unsupported districts |
| **Scenario Analysis** | Runs comparative what-if simulations across different input combinations for planning decisions |
| **Full Season Report** | Generates a consolidated season-end advisory report aggregating outputs from all modules |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    React + Vite Frontend                         │
│         Tailwind CSS · 8 Module UIs · District Selector          │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTP (REST / JSON)
┌──────────────────────────────▼───────────────────────────────────┐
│                        Flask Backend                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │                    ML Model Layer                       │     │
│  │  Crop Recommendation  │  Yield Prediction               │     │
│  │  Fertilizer Strategy  │  Market Price Prediction        │     │
│  │  Pest/Disease Risk    │  Irrigation Scheduling          │     │
│  │  (scikit-learn: Random Forest · Gradient Boosting)      │     │
│  └──────────────────────────┬──────────────────────────────┘     │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐     │
│  │                   Data Layer                            │     │
│  │  Open-Meteo API (real-time weather + 7-day forecasts)   │     │
│  │  District soil database (723 districts)                 │     │
│  │  Haversine nearest-neighbour fallback                   │     │
│  │  Elevation-based temperature/rainfall correction        │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

**Stack:**

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Python 3.10+, Flask |
| ML Models | scikit-learn (Random Forest, Gradient Boosting) |
| Weather API | Open-Meteo (free, no key required) |
| Geocoding | Nominatim (OpenStreetMap) with district name normalisation |
| Geospatial fallback | Haversine distance-based nearest-neighbour |

---

## ML Models

All models are trained and serialised as `.pkl` files, loaded at server startup. Training was done in Google Colab with scikit-learn.

| Model | Algorithm | Coverage |
|---|---|---|
| Crop Recommendation | Random Forest Classifier | 23 crops, soil + climate features |
| Yield Prediction | Gradient Boosting Regressor | District × crop × area × weather |
| Fertilizer Advisory | Rule-augmented Classifier | Soil NPK deficit analysis |
| Market Price Prediction | Gradient Boosting Regressor | 723 districts with Haversine fallback |
| Pest/Disease Risk | Multi-variable scoring function | Weather + agro-climatic zone |

### Irrigation scheduling

The irrigation module does not use a pre-trained model. Instead it computes weekly water requirements using a **FAO-56 Penman-Monteith proxy** calibrated against the Open-Meteo 7-day forecast (temperature, humidity, wind speed, solar radiation), adjusted for crop growth stage and soil water-holding capacity.

### Geographic coverage

- **723 Indian districts** with district-level soil and historical climate data
- **Haversine nearest-neighbour fallback** for district names not found in the database (geocodes the input, computes great-circle distance to all known district centroids, returns the closest match)
- **Elevation correction** — automatic temperature lapse rate (−6.5°C/1000m) and rainfall adjustment for hill-station districts (Darjeeling, Shimla, Ooty, etc.)

---

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+

### 1. Clone the repository

```bash
git clone https://github.com/arnabdutta04/AgroWEB-Sustainable-E-Agriculture-Data-Platform.git
cd AgroWEB-Sustainable-E-Agriculture-Data-Platform
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Start the Flask server:

```bash
python app.py
```

The backend runs at `http://localhost:5000`.

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

> The frontend proxies API calls to `http://localhost:5000` via Vite's `server.proxy` config — no additional CORS setup needed in development.

---

## API Reference

All endpoints accept and return JSON. Base URL: `http://localhost:5000`

### `POST /api/crop-recommendation`

```json
{
  "nitrogen": 80,
  "phosphorus": 40,
  "potassium": 40,
  "temperature": 25.5,
  "humidity": 70,
  "ph": 6.5,
  "rainfall": 200,
  "district": "Murshidabad"
}
```

Returns the recommended crop with match score and top-3 alternatives.

### `POST /api/yield-prediction`

```json
{
  "district": "Bardhaman",
  "crop": "Rice",
  "area_hectares": 5.0,
  "season": "Kharif"
}
```

Returns predicted yield in t/ha with confidence interval.

### `POST /api/fertilizer`

```json
{
  "crop": "Wheat",
  "nitrogen": 30,
  "phosphorus": 10,
  "potassium": 50,
  "ph": 7.2,
  "district": "Ludhiana"
}
```

Returns NPK prescription with recommended fertilizer types and application schedule.

### `POST /api/irrigation`

```json
{
  "crop": "Tomato",
  "district": "Pune",
  "growth_stage": "flowering",
  "soil_type": "loamy"
}
```

Returns a 7-day irrigation schedule (litres/day/hectare) computed from the Open-Meteo forecast.

### `POST /api/pest-disease`

```json
{
  "crop": "Rice",
  "district": "Thanjavur",
  "season": "Kharif"
}
```

Returns pest and disease risk probabilities with recommended preventive actions.

### `POST /api/market-price`

```json
{
  "crop": "Onion",
  "district": "Nashik",
  "forecast_weeks": 4
}
```

Returns weekly mandi price forecast. Uses Haversine fallback if the district is not in the primary database.

### `POST /api/scenario`

Runs a what-if scenario comparing two or more input configurations across any module.

### `GET /api/districts`

Returns the full list of 723 supported districts with state and centroid coordinates.

---

## Project Structure

```
AgroWEB-Sustainable-E-Agriculture-Data-Platform/
├── backend/
│   ├── app.py                        # Flask app, route registration
│   ├── models/
│   │   ├── crop_recommendation.pkl
│   │   ├── yield_prediction.pkl
│   │   ├── fertilizer.pkl
│   │   └── market_price.pkl
│   ├── modules/
│   │   ├── crop.py                   # Crop recommendation logic
│   │   ├── yield_pred.py             # Yield prediction logic
│   │   ├── fertilizer.py             # Fertilizer advisory logic
│   │   ├── irrigation.py             # FAO-56 irrigation scheduler
│   │   ├── pest_disease.py           # Pest/disease risk scoring
│   │   ├── market.py                 # Market price prediction + fallback
│   │   └── scenario.py              # Scenario analysis engine
│   ├── data/
│   │   ├── districts.json            # 723 districts with centroids
│   │   └── soil_data.json            # District-level soil profiles
│   ├── utils/
│   │   ├── weather.py                # Open-Meteo API client
│   │   ├── geocoding.py              # Nominatim + Haversine fallback
│   │   └── elevation.py             # Elevation-based correction
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/                    # One page per module
│   │   ├── components/               # Shared UI components
│   │   └── api/                      # Axios API client
│   ├── package.json
│   └── vite.config.js
├── .vscode/
├── .gitignore
└── README.md
```

---

## Supported Crops

Rice · Wheat · Maize · Jute · Cotton · Sugarcane · Tobacco · Coconut · Papaya · Orange · Apple · Muskmelon · Watermelon · Grapes · Mango · Banana · Pomegranate · Lentil · Blackgram · Mungbean · Mothbeans · Pigeonpeas · Kidneybeans

---

## Deployment

### Frontend — Vercel (free)

1. Import the repo on [vercel.com](https://vercel.com), set **Root Directory** to `frontend`.
2. Add environment variable: `VITE_API_URL=<your_backend_url>`.
3. Deploy.

### Backend — Render (free tier)

The Flask backend with pre-loaded `.pkl` models sits comfortably within Render's free 512 MB RAM limit (no large transformer models involved).

1. Create a new **Web Service** on [render.com](https://render.com), connect the repo.
2. Set **Root Directory** to `backend`, **Build Command** to `pip install -r requirements.txt`, **Start Command** to `gunicorn app:app`.
3. Deploy.

> **Note:** On Render's free tier the server spins down after 15 minutes of inactivity. First request after idle takes ~30 seconds to cold start.

### Local production build

```bash
# Frontend
cd frontend && npm run build

# Backend
cd backend && gunicorn app:app --bind 0.0.0.0:5000
```

---

## Key Design Decisions

**Why Open-Meteo?** It's free, requires no API key, supports 7-day hourly forecasts, and returns solar radiation data needed for the Penman-Monteith irrigation calculation — making it ideal for agricultural applications with no budget overhead.

**Why Haversine fallback?** India has 766 districts but many farmers refer to their location by taluk, block, or colloquial name rather than the official district. Geocoding the input string and finding the nearest known district centroid is more robust than requiring exact name matching.

**Why scikit-learn over deep learning?** The tabular, district-level agricultural datasets available publicly are in the thousands-of-rows range — well within the regime where gradient boosting and random forests outperform neural networks and are far easier to deploy without GPU requirements.

---

## Author

**Arnab Dutta**  
B.Tech CSE — Department of Computer Science and Engineering  
IEM, University of Engineering and Management, Kolkata  
📧 arnabdutta453@gmail.com  
🔗 [GitHub: arnabdutta04](https://github.com/arnabdutta04) · [LinkedIn: arnabdutta04](https://linkedin.com/in/arnabdutta04)

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
#   F a r m H e l p  
 