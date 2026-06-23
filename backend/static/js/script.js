/* ════════════════════════════════════════════════════════
   KrishiMind — Smart Agriculture Advisory Dashboard
   script.js  ·  Frontend ↔ Flask Backend Integration
   ════════════════════════════════════════════════════════

   Endpoints wired:
     POST /predict         → crop rec, yield, fertilizer
     POST /predict/market  → min/max/modal market price

   Response keys exactly mirror app.py jsonify() output.
   ════════════════════════════════════════════════════════ */

'use strict';

/* ────────────────────────────────────────────────────────
   1. NAVBAR — scroll class + active link + hamburger
──────────────────────────────────────────────────────── */
(function initNavbar() {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  const navLinks  = document.querySelectorAll('.nav-link, .mob-link');

  // Scroll shadow
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
    updateActiveLink();
  }, { passive: true });

  // Hamburger
  hamburger.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });

  // Close mobile menu on link click
  document.querySelectorAll('.mob-link').forEach(link => {
    link.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });

  // Active link tracking
  function updateActiveLink() {
    const sections = document.querySelectorAll('section[id]');
    let current = '';
    sections.forEach(sec => {
      if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
    });
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      link.classList.toggle('active', href === `#${current}`);
    });
  }
})();


/* ────────────────────────────────────────────────────────
   2. HERO CANVAS — animated floating particles
──────────────────────────────────────────────────────── */
(function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x    = Math.random() * W;
      this.y    = Math.random() * H;
      this.r    = Math.random() * 2.5 + 0.5;
      this.vx   = (Math.random() - 0.5) * 0.3;
      this.vy   = -Math.random() * 0.6 - 0.2;
      this.life = 1;
      this.decay = Math.random() * 0.003 + 0.001;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life -= this.decay;
      if (this.life <= 0 || this.y < 0) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(109, 220, 158, ${this.life * 0.35})`;
      ctx.fill();
    }
  }

  function init() {
    resize();
    particles = Array.from({ length: 90 }, () => new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    // Draw grid lines (subtle)
    ctx.strokeStyle = 'rgba(37, 168, 93, 0.04)';
    ctx.lineWidth = 1;
    const gSize = 60;
    for (let x = 0; x < W; x += gSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += gSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', resize, { passive: true });
  init();
  animate();
})();


/* ────────────────────────────────────────────────────────
   3. INTERSECTION OBSERVER — reveal on scroll
──────────────────────────────────────────────────────── */
(function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();


/* ────────────────────────────────────────────────────────
   4. NUTRIENT BAR — live fill while typing
──────────────────────────────────────────────────────── */
(function initNutrientBars() {
  const fields = [
    { id: 'N', bar: 'nBar', max: 300 },
    { id: 'P', bar: 'pBar', max: 300 },
    { id: 'K', bar: 'kBar', max: 300 },
  ];
  fields.forEach(({ id, bar, max }) => {
    const input = document.getElementById(id);
    const barEl = document.getElementById(bar);
    if (!input || !barEl) return;
    input.addEventListener('input', () => {
      const val = Math.min(parseFloat(input.value) || 0, max);
      barEl.style.width = `${(val / max) * 100}%`;
    });
  });
})();


/* ────────────────────────────────────────────────────────
   5. TOAST UTILITY
──────────────────────────────────────────────────────── */
const Toast = {
  el: document.getElementById('toast'),
  _timer: null,
  show(msg, type = 'success', duration = 3500) {
    clearTimeout(this._timer);
    const icon = type === 'error'
      ? '<i class="fa-solid fa-circle-exclamation"></i>'
      : '<i class="fa-solid fa-circle-check"></i>';
    this.el.innerHTML = icon + msg;
    this.el.className = `toast show${type === 'error' ? ' toast-error' : ''}`;
    this._timer = setTimeout(() => {
      this.el.classList.remove('show');
    }, duration);
  },
};


/* ────────────────────────────────────────────────────────
   6. ADVISORY ENGINE
   Pure JS logic — generates contextual advice from the
   model inputs (N, P, K, temp, humidity, rainfall, pH)
   and recommended crop.
──────────────────────────────────────────────────────── */
const Advisory = {

  irrigation(rainfall, humidity, crop) {
    const c = crop.toLowerCase();
    if (rainfall > 2000 || humidity > 85) {
      return `Rainfall (${rainfall} mm) and humidity (${humidity}%) are high. <strong>Minimal supplemental irrigation needed.</strong> Monitor drainage to prevent waterlogging around ${crop} roots.`;
    } else if (rainfall < 400) {
      const freq = c.includes('rice') ? 'daily' : c.includes('wheat') ? 'every 3–4 days' : 'every 2–3 days';
      return `Low rainfall (${rainfall} mm) detected. <strong>Irrigate ${freq}</strong> during critical growth stages of ${crop}. Drip or furrow irrigation recommended.`;
    } else {
      return `Moderate rainfall (${rainfall} mm). Schedule irrigation <strong>every 4–5 days</strong> depending on soil moisture. Check moisture at 15 cm depth before irrigating ${crop}.`;
    }
  },

  pest(crop, temp, humidity) {
    const c = crop.toLowerCase();
    const alerts = [];
    if (temp > 30 && humidity > 70) alerts.push(`High temperature (${temp}°C) + humidity (${humidity}%) — ideal conditions for <strong>fungal diseases</strong> on ${crop}.`);
    if (c.includes('rice'))   alerts.push('Monitor for <strong>brown planthopper</strong>, leaf blast, and sheath blight.');
    if (c.includes('wheat'))  alerts.push('Watch for <strong>rust (yellow/stem)</strong> and Karnal bunt in humid conditions.');
    if (c.includes('cotton')) alerts.push('Inspect for <strong>bollworm</strong> and whitefly infestation regularly.');
    if (c.includes('maize') || c.includes('corn')) alerts.push('Alert: <strong>Fall Armyworm</strong> risk — inspect whorl leaves at dawn.');
    if (alerts.length === 0) alerts.push(`No critical pest alerts for ${crop} under current conditions. Conduct <strong>weekly field scouting</strong> as a precaution.`);
    return alerts.join(' ');
  },

  fertilizer(N, P, K, crop, fertCost) {
    const lines = [];
    if (N < 40)  lines.push(`Low N (${N} kg/ha) — apply <strong>Urea (46-0-0)</strong> at 100–120 kg/ha in split doses.`);
    if (P < 20)  lines.push(`Low P (${P} kg/ha) — apply <strong>DAP (18-46-0)</strong> at 100 kg/ha as basal dose.`);
    if (K < 20)  lines.push(`Low K (${K} kg/ha) — apply <strong>MOP (0-0-60)</strong> at 50 kg/ha.`);
    if (lines.length === 0) lines.push(`NPK levels adequate for ${crop}. Maintain <strong>balanced nutrition</strong> schedule.`);
    lines.push(`Est. fertilizer cost ₹${fertCost.toFixed(0)}/50 kg bag — budget accordingly for the full season.`);
    return lines.join(' ');
  },

  weather(temp, humidity, rainfall) {
    let summary;
    if (temp > 35)      summary = `<strong>Heat stress alert</strong> — temperature ${temp}°C exceeds comfort zone for most crops.`;
    else if (temp < 10) summary = `<strong>Cold stress alert</strong> — temperature ${temp}°C may inhibit germination.`;
    else                summary = `Temperature ${temp}°C is within <strong>optimal crop growth range</strong>.`;

    const rainClass = rainfall > 1500 ? 'Heavy' : rainfall > 600 ? 'Moderate' : 'Low';
    return `${summary} ${rainClass} annual rainfall (${rainfall} mm) with humidity at ${humidity}%. Schedule field operations in morning hours to avoid midday heat stress.`;
  },

  soilHealth(N, P, K, ph) {
    let score = 50;
    // N scoring
    if      (N >= 60 && N <= 140) score += 15;
    else if (N >= 40 && N < 60)   score += 8;
    else if (N > 140)             score += 5;
    // P scoring
    if      (P >= 20 && P <= 60)  score += 15;
    else if (P >= 10 && P < 20)   score += 8;
    // K scoring
    if      (K >= 30 && K <= 80)  score += 15;
    else if (K >= 15 && K < 30)   score += 8;
    // pH scoring
    if      (ph >= 6.0 && ph <= 7.5) score += 15;
    else if (ph >= 5.5 && ph < 6.0)  score += 8;
    else if (ph > 7.5 && ph <= 8.0)  score += 8;

    score = Math.min(100, score);
    let label, emoji;
    if      (score >= 85) { label = 'Excellent'; emoji = '🌿'; }
    else if (score >= 70) { label = 'Good';      emoji = '✅'; }
    else if (score >= 55) { label = 'Fair';      emoji = '⚠️'; }
    else                  { label = 'Poor';      emoji = '🚨'; }
    return { score, label, emoji };
  },
};


/* ────────────────────────────────────────────────────────
   7. /predict  POST — Crop, Yield, Fertilizer
──────────────────────────────────────────────────────── */
(function initPredictForm() {
  const form       = document.getElementById('predictForm');
  const btn        = document.getElementById('predictBtn');
  const btnText    = btn.querySelector('.btn-text');
  const btnLoader  = btn.querySelector('.btn-loader');
  const errBanner  = document.getElementById('predictErrors');
  const resultsPanel = document.getElementById('resultsPanel');
  const formCard   = document.getElementById('predictFormCard');
  const resetBtn   = document.getElementById('resetBtn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const vals = getFormValues();
    const clientErrors = validatePredictInputs(vals);
    if (clientErrors.length) {
      showErrors(errBanner, clientErrors);
      return;
    }

    setLoading(true);
    errBanner.hidden = true;

    try {
      const resp = await fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          N:           vals.N,
          P:           vals.P,
          K:           vals.K,
          temperature: vals.temperature,
          humidity:    vals.humidity,
          ph:          vals.ph,
          rainfall:    vals.rainfall,
        }),
      });

      const data = await resp.json();

      if (!resp.ok || !data.success) {
        const errs = data.errors || [data.error || 'Prediction failed. Please check inputs.'];
        showErrors(errBanner, errs);
        Toast.show('Prediction failed', 'error');
        return;
      }

      renderResults(data, vals);
      resultsPanel.hidden = false;
      resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      Toast.show('<i class="fa-solid fa-circle-check"></i> Analysis complete!');

    } catch (err) {
      console.error('/predict error:', err);
      showErrors(errBanner, ['Network error — ensure Flask server is running on port 5000.']);
      Toast.show('Network error', 'error');
    } finally {
      setLoading(false);
    }
  });

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resultsPanel.hidden = true;
      form.reset();
      // Reset nutrient bars
      ['nBar', 'pBar', 'kBar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.width = '0%';
      });
      formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ── Helpers ── */
  function getFormValues() {
    const f = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    return {
      N:           f('N'),
      P:           f('P'),
      K:           f('K'),
      temperature: f('temperature'),
      humidity:    f('humidity'),
      ph:          f('ph'),
      rainfall:    f('rainfall'),
    };
  }

  function validatePredictInputs({ N, P, K, temperature, humidity, ph, rainfall }) {
    const errors = [];
    if (N === 0 && P === 0 && K === 0) errors.push('Please enter at least N, P, K values.');
    if (N < 0 || N > 300)              errors.push('N must be 0–300 kg/ha.');
    if (P < 0 || P > 300)              errors.push('P must be 0–300 kg/ha.');
    if (K < 0 || K > 300)              errors.push('K must be 0–300 kg/ha.');
    if (temperature < -10 || temperature > 60) errors.push('Temperature must be −10 to 60 °C.');
    if (humidity < 0 || humidity > 100)        errors.push('Humidity must be 0–100 %.');
    if (ph < 0 || ph > 14)                     errors.push('pH must be 0–14.');
    if (rainfall < 0 || rainfall > 5000)       errors.push('Rainfall must be 0–5000 mm.');
    return errors;
  }

  function setLoading(loading) {
    btn.disabled = loading;
    btnText.hidden  = loading;
    btnLoader.hidden = !loading;
    formCard.classList.toggle('processing', loading);
  }

  function showErrors(el, errors) {
    el.innerHTML = errors.map(e => `<div>⚠ ${e}</div>`).join('');
    el.hidden = false;
  }

  /* ── Main Render Function ── */
  function renderResults(data, rawInputs) {
    const p   = data.predictions;
    const inp = data.inputs; // values echoed by backend

    // Timestamp
    document.getElementById('resultTimestamp').textContent =
      `Generated ${new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })}`;

    // ── Input Echo ──
    const echoGrid = document.getElementById('inputEcho');
    const echoItems = [
      { label: 'N', value: `${inp.N} kg/ha` },
      { label: 'P', value: `${inp.P} kg/ha` },
      { label: 'K', value: `${inp.K} kg/ha` },
      { label: 'Temp', value: `${inp.temperature}°C` },
      { label: 'Humidity', value: `${inp.humidity}%` },
      { label: 'pH', value: inp.ph },
      { label: 'Rainfall', value: `${inp.rainfall} mm` },
    ];
    echoGrid.innerHTML = echoItems
      .map(i => `<span class="echo-chip"><strong>${i.label}</strong> ${i.value}</span>`)
      .join('');

    // ── Card 1: Recommended Crop ──
    const cropRec  = p.crop_recommendation;
    const recCrop  = cropRec.recommended_crop;
    const top3     = cropRec.top_3_crops;

    document.getElementById('rcCrop').textContent    = recCrop;
    document.getElementById('rcCropSub').textContent =
      `Confidence: ${top3[0]?.probability ?? '—'}%`;

    const top3El = document.getElementById('top3Crops');
    top3El.innerHTML = top3.map((c, i) => `
      <div class="top3-item">
        <span>${i + 1}. ${c.crop}</span>
        <div class="top3-bar-bg">
          <div class="top3-bar-fill" style="width:${c.probability}%"></div>
        </div>
        <span class="pct">${c.probability}%</span>
      </div>
    `).join('');

    // ── Card 2: Yield ──
    const yieldPred = p.yield_prediction.estimated_yield_tonnes_per_ha;
    document.getElementById('rcYield').textContent = yieldPred.toFixed(2);
    // Bar: scale 0–12 t/ha
    const yieldPct = Math.min((yieldPred / 12) * 100, 100);
    document.getElementById('yieldBarFill').style.width  = `${yieldPct}%`;
    document.getElementById('yieldBarLabel').textContent =
      yieldPct >= 75 ? 'High yield expected' :
      yieldPct >= 45 ? 'Average yield expected' : 'Low yield — check soil inputs';

    // ── Card 3: Fertilizer ──
    const fertPrice = p.fertilizer_price_prediction.estimated_price_inr;
    document.getElementById('rcFert').textContent = `₹ ${fertPrice.toFixed(0)}`;
    document.getElementById('fertAdvisory').innerHTML =
      Advisory.fertilizer(inp.N, inp.P, inp.K, recCrop, fertPrice);

    // ── Card 4: Soil Health ──
    const health = Advisory.soilHealth(inp.N, inp.P, inp.K, inp.ph);
    document.getElementById('soilHealthScore').textContent = `${health.emoji} ${health.score}`;
    document.getElementById('soilHealthLabel').textContent  = `${health.label} Soil Condition`;

    const meters = [
      { label: 'N', val: inp.N, max: 300, color: '#4ade80' },
      { label: 'P', val: inp.P, max: 300, color: '#fb923c' },
      { label: 'K', val: inp.K, max: 300, color: '#a78bfa' },
      { label: 'pH', val: inp.ph, max: 14, color: '#38bdf8' },
    ];
    document.getElementById('soilMeters').innerHTML = meters.map(m => `
      <div class="soil-meter-row">
        <span class="soil-meter-label">${m.label}</span>
        <div class="soil-meter-bar-bg">
          <div class="soil-meter-fill"
               style="width:${Math.min((m.val/m.max)*100,100)}%;background:${m.color}"></div>
        </div>
        <span class="soil-meter-val">${m.val}</span>
      </div>
    `).join('');

    // ── Advisory Cards ──
    document.getElementById('advIrrigationBody').innerHTML =
      Advisory.irrigation(inp.rainfall, inp.humidity, recCrop);
    document.getElementById('advPestBody').innerHTML =
      Advisory.pest(recCrop, inp.temperature, inp.humidity);
    document.getElementById('advFertilizerBody').innerHTML =
      Advisory.fertilizer(inp.N, inp.P, inp.K, recCrop, fertPrice);
    document.getElementById('advWeatherBody').innerHTML =
      Advisory.weather(inp.temperature, inp.humidity, inp.rainfall);

    // Animate result cards in
    document.querySelectorAll('.result-card, .advisory-card').forEach((card, i) => {
      card.style.opacity = 0;
      card.style.transform = 'translateY(20px)';
      setTimeout(() => {
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        card.style.opacity = 1;
        card.style.transform = 'translateY(0)';
      }, i * 80);
    });
  }

})();


/* ────────────────────────────────────────────────────────
   8. /predict/market  POST — Market Price
──────────────────────────────────────────────────────── */
(function initMarketForm() {
  const form      = document.getElementById('marketForm');
  const btn       = document.getElementById('marketBtn');
  if (!form || !btn) return;

  const btnText   = btn.querySelector('.btn-text');
  const btnLoader = btn.querySelector('.btn-loader');
  const errBanner = document.getElementById('marketErrors');
  const placeholder     = document.getElementById('marketPlaceholder');
  const resultsInner    = document.getElementById('marketResultsInner');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const district  = document.getElementById('district')?.value.trim();
    const market    = document.getElementById('market')?.value.trim();
    const commodity = document.getElementById('commodity')?.value.trim();
    const year      = parseInt(document.getElementById('year')?.value, 10);
    const month     = parseInt(document.getElementById('month')?.value, 10);

    // Client validation
    const errors = [];
    if (!district)  errors.push('Please select a District.');
    if (!market)    errors.push('Please select a Market.');
    if (!commodity) errors.push('Please select a Commodity.');
    if (!year || year < 2000 || year > 2100) errors.push('Year must be 2000–2100.');
    if (!month || month < 1 || month > 12)   errors.push('Month must be 1–12.');

    if (errors.length) {
      showErrors(errBanner, errors);
      return;
    }

    setMarketLoading(true);
    errBanner.hidden = true;

    try {
      const resp = await fetch('/predict/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ district, market, commodity, year, month }),
      });

      const data = await resp.json();

      if (resp.status === 503) {
        showErrors(errBanner, [data.error || 'Market model not loaded on server.']);
        Toast.show('Market model unavailable', 'error');
        return;
      }

      if (!resp.ok || !data.success) {
        const errs = data.errors || [data.error || 'Market prediction failed.'];
        showErrors(errBanner, errs);
        Toast.show('Market prediction failed', 'error');
        return;
      }

      renderMarketResults(data);
      placeholder.hidden    = true;
      resultsInner.hidden   = false;
      Toast.show('Market price predicted!');

    } catch (err) {
      console.error('/predict/market error:', err);
      showErrors(errBanner, ['Network error — check Flask server.']);
      Toast.show('Network error', 'error');
    } finally {
      setMarketLoading(false);
    }
  });

  function setMarketLoading(loading) {
    btn.disabled       = loading;
    btnText.hidden     = loading;
    btnLoader.hidden   = !loading;
  }

  function showErrors(el, errors) {
    el.innerHTML = errors.map(e => `<div>⚠ ${e}</div>`).join('');
    el.hidden = false;
  }

  function renderMarketResults(data) {
    const inp = data.inputs;
    const mp  = data.predictions.market_price;

    const min   = mp.min_price_inr_per_quintal;
    const max   = mp.max_price_inr_per_quintal;
    const modal = mp.modal_price_inr_per_quintal;

    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Header
    document.getElementById('mrTitle').textContent =
      `${inp.commodity} — ${inp.market}`;
    document.getElementById('mrDate').textContent =
      `${monthNames[inp.month]} ${inp.year}`;

    // Price values
    const fmt = (v) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
    document.getElementById('mrMin').textContent   = fmt(min);
    document.getElementById('mrMax').textContent   = fmt(max);
    document.getElementById('mrModal').textContent = fmt(modal);
    document.getElementById('mrMin2').textContent  = fmt(min);
    document.getElementById('mrMax2').textContent  = fmt(max);

    // Price range bar (modal as % between min and max)
    const range = max - min || 1;
    const modalPct  = ((modal - min) / range) * 100;
    const rangePct  = 80; // fill bar 80% of width visually
    document.getElementById('priceRangeFill').style.width  = `${rangePct}%`;
    document.getElementById('priceRangeModal').style.left  = `${10 + (modalPct * 0.8)}%`;

    // Market insight
    const trendVerb = modal > (min + max) / 2 ? 'leaning bullish' : 'near floor';
    const spreadPct = max > 0 ? (((max - min) / max) * 100).toFixed(1) : 0;
    document.getElementById('marketInsight').innerHTML = `
      <strong>${inp.commodity}</strong> in ${inp.district} is <strong>${trendVerb}</strong>
      for ${monthNames[inp.month]} ${inp.year}.
      Price spread is <strong>₹${(max - min).toLocaleString('en-IN')}/quintal (${spreadPct}%)</strong>
      between floor and ceiling. Modal price <strong>${fmt(modal)}</strong> is the
      AI-recommended benchmark for selling decisions.
      1 quintal = 100 kg · Prices in INR.
    `;

    // Animate prices in
    document.querySelectorAll('.price-card').forEach((card, i) => {
      card.style.opacity = 0;
      card.style.transform = 'translateY(16px)';
      setTimeout(() => {
        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        card.style.opacity = 1;
        card.style.transform = 'translateY(0)';
      }, i * 100);
    });
  }

})();


/* ────────────────────────────────────────────────────────
   9. WORKFLOW LAYER — animated entry on scroll
──────────────────────────────────────────────────────── */
(function initWorkflowAnimations() {
  const layers = document.querySelectorAll('.wf-layer');
  const arrows = document.querySelectorAll('.wf-arrow');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = 1;
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  [...layers, ...arrows].forEach((el, i) => {
    el.style.opacity = 0;
    el.style.transform = 'translateY(24px)';
    el.style.transition = `opacity 0.5s ${i * 0.08}s ease, transform 0.5s ${i * 0.08}s ease`;
    observer.observe(el);
  });
})();


/* ────────────────────────────────────────────────────────
   10. SMOOTH SCROLL for anchor links
──────────────────────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href');
    const target   = document.querySelector(targetId);
    if (!target) return;
    e.preventDefault();
    const offset = 80; // navbar height
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});


/* ────────────────────────────────────────────────────────
   11. SELECT SEARCH HELPER — filter long dropdowns
   Adds a live-search input above district/market/commodity
──────────────────────────────────────────────────────── */
(function initSelectSearch() {
  const selectIds = ['district', 'market', 'commodity'];

  selectIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel || sel.options.length < 20) return;

    // Wrap the select
    const wrapper = sel.parentElement; // .input-wrap
    const outer   = wrapper.parentElement; // .form-group

    // Create search input
    const searchInput = document.createElement('input');
    searchInput.type  = 'text';
    searchInput.placeholder = `Search ${id}…`;
    searchInput.className   = 'form-input select-search-input';
    searchInput.style.cssText = `
      padding-left: 2.4rem;
      border-radius: 8px 8px 0 0;
      border-bottom: none;
      font-size: 0.82rem;
    `;

    // Add icon
    const searchWrap = document.createElement('div');
    searchWrap.className = 'input-wrap';
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-magnifying-glass';
    searchWrap.appendChild(icon);
    searchWrap.appendChild(searchInput);

    outer.insertBefore(searchWrap, wrapper);

    // Style the select to look connected
    sel.style.borderRadius = '0 0 8px 8px';

    // Cache all options
    const allOptions = Array.from(sel.options);

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      Array.from(sel.options).forEach(opt => {
        opt.style.display = opt.text.toLowerCase().includes(q) ? '' : 'none';
      });
      // Show blank option always
      if (sel.options[0] && sel.options[0].value === '') {
        sel.options[0].style.display = '';
      }
    });
  });
})();


/* ────────────────────────────────────────────────────────
   12. DEMO DATA — fill predict form for quick testing
──────────────────────────────────────────────────────── */
(function addDemoButton() {
  const form = document.getElementById('predictForm');
  if (!form) return;

  const demoBtn = document.createElement('button');
  demoBtn.type = 'button';
  demoBtn.className = 'btn btn-ghost btn-sm';
  demoBtn.style.cssText = 'position:absolute;top:1.5rem;right:1.5rem;font-size:0.75rem;';
  demoBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Fill Demo Data';

  const card = document.getElementById('predictFormCard');
  if (card) {
    card.style.position = 'relative';
    card.appendChild(demoBtn);
  }

  const demoData = {
    N: 90, P: 42, K: 43, temperature: 20.9,
    humidity: 82.0, ph: 6.5, rainfall: 202.9,
    state: 'West Bengal', farmer_district: 'Bankura', soil_type: 'Alluvial',
  };

  demoBtn.addEventListener('click', () => {
    Object.entries(demoData).forEach(([key, val]) => {
      const el = document.getElementById(key) ||
                 document.querySelector(`[name="${key}"]`);
      if (el) el.value = val;
    });
    // Trigger nutrient bars
    ['N', 'P', 'K'].forEach(id => {
      document.getElementById(id)?.dispatchEvent(new Event('input'));
    });
    Toast.show('<i class="fa-solid fa-wand-magic-sparkles"></i> Demo data filled!');
  });
})();


/* ────────────────────────────────────────────────────────
   13. PAGE LOAD — gentle reveal of sections
──────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  // Stagger section-header reveals
  document.querySelectorAll('.section-header').forEach((el, i) => {
    el.style.opacity = 0;
    el.style.transform = 'translateY(20px)';
    setTimeout(() => {
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      el.style.opacity = 1;
      el.style.transform = 'translateY(0)';
    }, 200 + i * 150);
  });

  // Set current year default in market year input if not set by Flask
  const yearInput = document.getElementById('year');
  if (yearInput && !yearInput.value) {
    yearInput.value = new Date().getFullYear();
  }
});