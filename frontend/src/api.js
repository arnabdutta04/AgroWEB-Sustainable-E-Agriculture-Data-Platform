import axios from 'axios';

// ─────────────────────────────────────────────────────────────
// Base axios instance — points to Flask backend
// Vite proxy should forward /encoders, /predict, /weather → :5000
// ─────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.response.use(
  response => response,
  error => {
    const msg = error.response?.data?.errors?.join(', ')
              || error.response?.data?.error
              || error.message
              || 'Unknown API error';
    console.error('API Error:', error.response?.status, msg);
    throw error;
  }
);

// ─────────────────────────────────────────────────────────────
// Encoders
// ─────────────────────────────────────────────────────────────
export async function fetchEncoders(signal) {
  const { data } = await api.get('/encoders', { signal });
  return data;
}

// ─────────────────────────────────────────────────────────────
// Crop + Yield + Fertilizer prediction
// signal: AbortController.signal — pass it to cancel in-flight
// ─────────────────────────────────────────────────────────────
export async function predictCrop(payload, signal) {
  const { data } = await api.post('/predict', payload, { signal });
  return data;
}

// ─────────────────────────────────────────────────────────────
// Market price prediction
// ─────────────────────────────────────────────────────────────
export async function predictMarket(payload, signal) {
  const { data } = await api.post('/predict/market', payload, { signal });
  return data;
}

// ─────────────────────────────────────────────────────────────
// 7-day weather forecast from Flask backend
// Flask /weather calls Open-Meteo and handles elevation + caching
// lat/lon: 4 decimal places for per-district uniqueness
// signal: AbortController.signal
// ─────────────────────────────────────────────────────────────
export async function fetchForecast(lat, lon, signal) {
  const { data } = await api.get(
    `/weather?lat=${parseFloat(lat).toFixed(4)}&lon=${parseFloat(lon).toFixed(4)}`,
    { signal }
  );
  return data;  // { success, data: { dates, temp_max, temp_min, precipitation, current }, elevation }
}

export default api;