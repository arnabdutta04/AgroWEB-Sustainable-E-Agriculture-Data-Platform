# AgroSense — Sustainable E-Agriculture Platform

A premium, highly responsive React web application powered by **Vite**, **Tailwind CSS v4**, **React Router v7**, **Context API**, and **Chart.js** that connects directly to the Flask backend running on `http://localhost:5000`.

## Key Features
- **District-Centric Analytics**: Restricts all predictions, local weather, and Mandi price calculations strictly to the selected district. State dropdown only filters districts cascadingly.
- **11 Regional Indian Languages**: Fully localized supporting English, Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada, Malayalam, Punjabi, and Odia.
- **8 Dedicated Modules**:
  1. **Farm Overview**: Main soil input, 22-crop parameter selections, crop alternatives, and weather indicators.
  2. **Fertilizer & Soil Strategy**: Stage-based application timelines, nutrient ratios, and soil health scores.
  3. **Pest & Disease Intelligence**: Humidity-based pathological risks, diagnostics, and urgent biosafety protocols.
  4. **Irrigation & Water**: Animated moisture profiles, growth timelines, and seasonal budgets.
  5. **Weather Advisory**: Agro-climatic indices, GDD trackers, evapotranspiration rates, and forecast grids.
  6. **Market Intelligence**: Wholesale spot comparison charts, AI hold/sell recommendation meters, and transport overheads.
  7. **Yield Calculator**: Projected revenues, break-even risk margins, and profit scenarios.
  8. **Full Season Report**: Circular SVG efficiency charts, chronological milestones, and crop rotation advisories.

## Refactored File Structure (Under 10 Files Total!)
- `vite.config.js` — Core bundler setup (includes CORS api proxy configurations)
- `package.json` — Dependecies (React 19, Chart.js, Tailwind v4)
- `index.html` — HTML index and meta parameters
- `src/main.jsx` — React bootstrap
- `src/index.css` — Modern dark glassmorphic design system
- `src/api.js` — Consolidated API axios requests
- `src/components.jsx` — Shared UI inputs, weather panels, and Chart.js graphs
- `src/App.jsx` — Root router shell containing AppContext, LanguageContext, and all 8 page modules!

## Setup Instructions

### 1. Boot up the Flask Backend
Navigate to the root `backend` directory, install requirements, and run the server:
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # On Windows
pip install -r requirements.txt
python app.py
```
*The server will start on `http://localhost:5000`.*

### 2. Boot up the Frontend React Server
Ensure you are in the `frontend` folder, install modules, and run the developer server:
```bash
cd frontend
npm install
npm run dev
```
*Vite will start the dev server locally. The built-in proxy will automatically route all requests seamlessly to the backend to prevent CORS issues.*
