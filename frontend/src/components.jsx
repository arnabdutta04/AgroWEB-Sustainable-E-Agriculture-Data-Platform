import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useApp, useLanguage } from './App';
import { fetchForecast } from './api';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, ArcElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import {
  FaMapMarkerAlt, FaFilter, FaLeaf, FaRulerCombined,
  FaTemperatureHigh, FaTint, FaCloudShowersHeavy, FaCloudSun,
  FaExchangeAlt, FaWind, FaThermometerHalf
} from 'react-icons/fa';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, BarElement, Title, Tooltip, Legend, Filler
);
// ─── Disease Prediction Engine (inline — no extra import needed) ────────────
// Stable per-district fingerprint: 0–1 float, deterministic
function districtSeed(district) {
  const s = (district || "").toLowerCase().trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return (h % 1000) / 1000;
}
 
// Maths helpers
function sig(x, c, w)  { return 1 / (1 + Math.exp(-(x - c) / w)); }
function rsig(x, c, w) { return 1 - sig(x, c, w); }
function bell(x, opt, s) { return Math.exp(-0.5 * Math.pow((x - opt) / s, 2)); }
 
// All disease candidates per crop
// riskFn(env) returns 0-100; higher = more risk
const DISEASE_CANDIDATES = {
  rice: [
    { name: "Rice Blast (Magnaporthe oryzae)",
      riskFn: e => 60*sig(e.hum,75,8) + 20*bell(e.tmp,26,5) + 10*sig(e.rain/52,5,3) + 5*sig(e.wind,15,8) + 5*(0.3+0.7*e.ds),
      tip: "Apply Tricyclazole 0.1% at first lesion; drain fields to 2–3 cm." },
    { name: "Brown Plant Hopper (BPH)",
      riskFn: e => 45*sig(e.hum,72,10) + 25*bell(e.tmp,28,6) + 15*sig(e.rain/52,4,3) + 10*rsig(e.wind,20,8) + 5*(0.2+0.8*(1-e.ds)),
      tip: "Install light traps 1 m above canopy; apply buprofezin 25 SC." },
    { name: "Bacterial Leaf Blight (Xanthomonas)",
      riskFn: e => 50*sig(e.hum,80,6) + 20*bell(e.tmp,30,5) + 20*sig(e.wind,18,6) + 5*sig(e.rain/52,6,3) + 5*e.ds,
      tip: "Drain fields; spray copper hydroxide at first water-soaked margin signs." },
    { name: "Sheath Rot (Sarocladium oryzae)",
      riskFn: e => 55*sig(e.hum,78,7) + 20*bell(e.tmp,29,5) + 15*sig(e.rain/52,5,3) + 5*e.ds + 5*sig(e.wind,12,6),
      tip: "Apply carbendazim 0.1% at booting stage; reduce excessive nitrogen." },
  ],
  maize: [
    { name: "Fall Armyworm (Spodoptera frugiperda)",
      riskFn: e => 50*sig(e.tmp,28,5) + 25*bell(e.hum,65,12) + 15*sig(e.rain/52,4,3) + 5*e.ds + 5*sig(e.wind,12,6),
      tip: "Apply emamectin benzoate 1.9 EC in whorl at early larval stage." },
    { name: "Downy Mildew (Peronosclerospora sorghi)",
      riskFn: e => 55*sig(e.hum,80,7) + 25*bell(e.tmp,24,6) + 10*sig(e.rain/52,5,3) + 5*rsig(e.wind,8,5) + 5*e.ds,
      tip: "Use metalaxyl seed treatment; avoid waterlogging; scout at 3-leaf stage." },
    { name: "Stem Borer (Chilo partellus)",
      riskFn: e => 45*bell(e.tmp,30,7) + 30*sig(e.hum,65,10) + 15*sig(e.rain/52,3,2) + 5*(1-e.ds) + 5*rsig(e.wind,10,5),
      tip: "Release Trichogramma parasitoids at egg stage; apply carbofuran 3G in whorl." },
  ],
  cotton: [
    { name: "Pink Bollworm (Pectinophora gossypiella)",
      riskFn: e => 50*bell(e.tmp,32,6) + 25*rsig(e.hum,60,10) + 15*sig(e.rain/52,3,2) + 5*e.ds + 5*rsig(e.wind,12,6),
      tip: "Use pheromone traps; apply spinosad at first adult catch; use Bt cotton." },
    { name: "Whitefly (Bemisia tabaci)",
      riskFn: e => 45*sig(e.tmp,30,6) + 30*rsig(e.hum,55,10) + 15*rsig(e.wind,15,8) + 5*(1-e.ds) + 5*sig(e.rain/52,2,2),
      tip: "Apply buprofezin 25 SC 1 ml/L; avoid excess nitrogen fertilization." },
    { name: "Cotton Leaf Curl Virus",
      riskFn: e => 50*sig(e.tmp,28,7) + 20*rsig(e.hum,50,10) + 20*rsig(e.wind,15,8) + 5*e.ds + 5*sig(e.rain/52,2,2),
      tip: "Control whitefly vector; remove infected plants; grow virus-tolerant varieties." },
  ],
  banana: [
    { name: "Panama Wilt (Fusarium oxysporum f.sp. cubense)",
      riskFn: e => 55*sig(e.hum,75,8) + 25*bell(e.tmp,28,6) + 10*sig(e.rain/52,6,3) + 5*rsig(e.wind,8,5) + 5*e.ds,
      tip: "No chemical cure; isolate affected plants; use resistant varieties + soil solarization." },
    { name: "Sigatoka Leaf Spot (Mycosphaerella musicola)",
      riskFn: e => 60*sig(e.hum,80,6) + 20*bell(e.tmp,26,5) + 10*sig(e.rain/52,5,3) + 5*e.ds + 5*sig(e.wind,18,7),
      tip: "Spray mancozeb 0.25% fortnightly during monsoon; remove infected leaves." },
    { name: "Banana Weevil (Cosmopolites sordidus)",
      riskFn: e => 45*bell(e.tmp,28,7) + 30*sig(e.hum,70,10) + 15*sig(e.rain/52,4,3) + 5*(1-e.ds) + 5*rsig(e.wind,10,5),
      tip: "Apply chlorpyrifos in soil at planting; remove and destroy dead pseudostems." },
  ],
  mango: [
    { name: "Anthracnose (Colletotrichum gloeosporioides)",
      riskFn: e => 55*sig(e.hum,78,7) + 25*bell(e.tmp,28,6) + 12*sig(e.rain/52,4,3) + 5*e.ds + 3*sig(e.wind,15,7),
      tip: "Apply carbendazim 0.1% at flowering and fruit set; avoid overhead irrigation." },
    { name: "Mango Hopper (Idioscopus clypealis)",
      riskFn: e => 45*bell(e.tmp,30,7) + 30*rsig(e.hum,55,12) + 15*rsig(e.wind,15,8) + 5*(1-e.ds) + 5*sig(e.rain/52,2,2),
      tip: "Spray imidacloprid 0.5 ml/L at panicle emergence to stop hopper flush." },
    { name: "Powdery Mildew (Oidium mangiferae)",
      riskFn: e => 50*sig(e.hum,55,10) + 25*bell(e.tmp,25,6) + 15*rsig(e.rain/52,3,2) + 5*e.ds + 5*sig(e.wind,10,6),
      tip: "Spray sulphur 0.3% WP at panicle initiation; repeat at 14-day intervals." },
  ],
  grapes: [
    { name: "Downy Mildew (Plasmopara viticola)",
      riskFn: e => 60*sig(e.hum,78,6) + 20*bell(e.tmp,22,5) + 12*sig(e.rain/52,5,3) + 5*rsig(e.wind,8,5) + 3*e.ds,
      tip: "Spray metalaxyl + mancozeb 0.2% fortnightly during humid spells; prune canopy." },
    { name: "Powdery Mildew (Uncinula necator)",
      riskFn: e => 55*sig(e.hum,60,12) + 25*bell(e.tmp,26,6) + 10*rsig(e.rain/52,3,2) + 5*sig(e.wind,12,6) + 5*e.ds,
      tip: "Apply sulphur 0.3% WP at bud burst; spray karathane 0.1% at berry set." },
    { name: "Botrytis Bunch Rot",
      riskFn: e => 50*sig(e.hum,85,5) + 25*bell(e.tmp,18,5) + 15*sig(e.rain/52,5,3) + 5*rsig(e.wind,6,4) + 5*e.ds,
      tip: "Thin bunches at berry set; apply iprodione 0.2% at veraison." },
  ],
  chickpea: [
    { name: "Fusarium Wilt (Fusarium oxysporum f.sp. ciceri)",
      riskFn: e => 55*sig(e.hum,65,8) + 25*bell(e.tmp,28,6) + 10*sig(e.rain/52,3,2) + 5*e.ds + 5*rsig(e.wind,10,5),
      tip: "Soil drench Trichoderma viride 5 g/L; use wilt-resistant varieties; rotate crops." },
    { name: "Pod Borer (Helicoverpa armigera)",
      riskFn: e => 50*bell(e.tmp,28,7) + 25*sig(e.hum,60,10) + 15*sig(e.rain/52,3,2) + 5*(1-e.ds) + 5*rsig(e.wind,12,6),
      tip: "Apply chlorantraniliprole 18.5 SC at 50% flowering; install pheromone traps." },
    { name: "Botrytis Grey Mould",
      riskFn: e => 50*sig(e.hum,85,5) + 25*bell(e.tmp,18,5) + 15*sig(e.rain/52,4,3) + 5*rsig(e.wind,6,4) + 5*e.ds,
      tip: "Apply iprodione 0.2% at early flowering; improve row spacing for air circulation." },
  ],
  kidneybeans: [
    { name: "Bean Common Mosaic Virus",
      riskFn: e => 50*sig(e.tmp,26,6) + 25*rsig(e.hum,55,10) + 15*rsig(e.wind,15,8) + 5*e.ds + 5*sig(e.rain/52,2,2),
      tip: "Remove infected plants; control aphid vector with imidacloprid seed treatment." },
    { name: "Anthracnose (Colletotrichum lindemuthianum)",
      riskFn: e => 55*sig(e.hum,78,7) + 25*bell(e.tmp,20,5) + 12*sig(e.rain/52,4,3) + 5*e.ds + 3*sig(e.wind,12,6),
      tip: "Spray mancozeb 0.25% at first lesion; avoid overhead irrigation." },
    { name: "Bean Fly (Ophiomyia phaseoli)",
      riskFn: e => 45*bell(e.tmp,28,6) + 30*sig(e.hum,65,10) + 15*sig(e.rain/52,3,2) + 5*(1-e.ds) + 5*rsig(e.wind,10,5),
      tip: "Apply carbofuran 3G granules in soil furrow at sowing." },
  ],
  pigeonpeas: [
    { name: "Sterility Mosaic Virus",
      riskFn: e => 50*sig(e.hum,70,8) + 25*bell(e.tmp,28,6) + 15*rsig(e.wind,12,6) + 5*e.ds + 5*sig(e.rain/52,3,2),
      tip: "Spray acaricide to kill mite vector; use mosaic-resistant varieties." },
    { name: "Fusarium Wilt",
      riskFn: e => 55*sig(e.hum,65,8) + 25*bell(e.tmp,30,6) + 10*sig(e.rain/52,3,2) + 5*(1-e.ds) + 5*rsig(e.wind,10,5),
      tip: "Grow wilt-resistant ICPH variety; practice 3-year crop rotation." },
  ],
  mothbeans: [
    { name: "Powdery Mildew",
      riskFn: e => 55*sig(e.hum,65,10) + 25*bell(e.tmp,28,7) + 10*rsig(e.rain/52,3,2) + 5*e.ds + 5*sig(e.wind,10,6),
      tip: "Spray karathane 0.1% or wettable sulphur 0.3% at first white colony." },
    { name: "Jassid / Leafhopper",
      riskFn: e => 45*bell(e.tmp,32,6) + 30*rsig(e.hum,55,10) + 15*rsig(e.wind,18,8) + 5*(1-e.ds) + 5*sig(e.rain/52,2,2),
      tip: "Spray imidacloprid 0.3 ml/L to control leafhopper and prevent virus spread." },
  ],
  mungbean: [
    { name: "Yellow Mosaic Virus (Whitefly-borne)",
      riskFn: e => 50*sig(e.tmp,30,6) + 25*sig(e.hum,68,8) + 15*rsig(e.wind,15,8) + 5*e.ds + 5*sig(e.rain/52,3,2),
      tip: "Spray thiamethoxam 25 WG 0.2 g/L; remove mosaic-infected plants immediately." },
    { name: "Cercospora Leaf Spot",
      riskFn: e => 55*sig(e.hum,80,6) + 25*bell(e.tmp,28,5) + 12*sig(e.rain/52,4,3) + 5*e.ds + 3*sig(e.wind,10,5),
      tip: "Spray mancozeb 0.25% at first spot appearance; improve plant spacing." },
  ],
  blackgram: [
    { name: "Yellow Mosaic Virus",
      riskFn: e => 55*sig(e.hum,72,8) + 25*bell(e.tmp,30,6) + 10*rsig(e.wind,15,8) + 5*e.ds + 5*sig(e.rain/52,3,2),
      tip: "Control whitefly vector with imidacloprid; destroy infected plants promptly." },
    { name: "Cercospora Leaf Spot",
      riskFn: e => 50*sig(e.hum,78,7) + 25*bell(e.tmp,28,5) + 15*sig(e.rain/52,4,3) + 5*e.ds + 5*sig(e.wind,10,5),
      tip: "Spray mancozeb 0.25%; avoid overhead irrigation during fruiting stage." },
  ],
  lentil: [
    { name: "Rust (Uromyces viciae-fabae)",
      riskFn: e => 55*sig(e.hum,68,7) + 25*bell(e.tmp,20,5) + 12*sig(e.wind,18,7) + 5*sig(e.rain/52,3,2) + 3*e.ds,
      tip: "Apply propiconazole 25 EC at first orange pustule; thin canopy for air flow." },
    { name: "Stemphylium Blight",
      riskFn: e => 50*sig(e.hum,80,6) + 25*bell(e.tmp,22,5) + 15*sig(e.rain/52,4,3) + 5*e.ds + 5*rsig(e.wind,8,5),
      tip: "Spray iprodione 0.2% during humid conditions; avoid dense planting." },
  ],
  pomegranate: [
    { name: "Bacterial Blight (Xanthomonas axonopodis)",
      riskFn: e => 55*sig(e.hum,72,8) + 25*bell(e.tmp,30,6) + 12*sig(e.rain/52,4,3) + 5*e.ds + 3*sig(e.wind,15,6),
      tip: "Spray copper oxychloride 0.3% fortnightly; prune infected branches." },
    { name: "Fruit Borer (Virachola isocrates)",
      riskFn: e => 45*bell(e.tmp,32,7) + 30*sig(e.hum,60,10) + 15*sig(e.rain/52,3,2) + 5*(1-e.ds) + 5*rsig(e.wind,12,6),
      tip: "Install pheromone traps at 5/ha; apply chlorantraniliprole at fruit set." },
  ],
  watermelon: [
    { name: "Fusarium Crown Rot",
      riskFn: e => 55*sig(e.hum,75,8) + 25*bell(e.tmp,30,6) + 12*sig(e.rain/52,5,3) + 5*e.ds + 3*rsig(e.wind,8,5),
      tip: "Use grafted seedlings on resistant rootstock; drench soil with carbendazim 0.1%." },
    { name: "Powdery Mildew",
      riskFn: e => 50*sig(e.hum,60,12) + 30*bell(e.tmp,28,6) + 10*rsig(e.rain/52,3,2) + 5*e.ds + 5*sig(e.wind,12,6),
      tip: "Spray wettable sulphur 0.3% at first white patch; improve plant spacing." },
  ],
  muskmelon: [
    { name: "Downy Mildew",
      riskFn: e => 55*sig(e.hum,78,7) + 25*bell(e.tmp,24,5) + 12*sig(e.rain/52,4,3) + 5*e.ds + 3*rsig(e.wind,8,5),
      tip: "Spray metalaxyl 0.2% at weekly intervals during rainy weather." },
    { name: "Cucumber Mosaic Virus",
      riskFn: e => 50*sig(e.tmp,28,7) + 25*rsig(e.hum,55,10) + 15*rsig(e.wind,15,8) + 5*e.ds + 5*sig(e.rain/52,2,2),
      tip: "Control aphid vectors with mineral oil spray; remove infected plants immediately." },
  ],
  apple: [
    { name: "Apple Scab (Venturia inaequalis)",
      riskFn: e => 60*sig(e.hum,75,7) + 20*bell(e.tmp,18,5) + 12*sig(e.rain/52,4,3) + 5*rsig(e.wind,8,5) + 3*e.ds,
      tip: "Spray mancozeb at green tip, pink bud and petal fall; remove leaf litter." },
    { name: "Fire Blight (Erwinia amylovora)",
      riskFn: e => 55*sig(e.hum,80,6) + 25*bell(e.tmp,24,6) + 12*sig(e.wind,20,8) + 5*sig(e.rain/52,4,3) + 3*e.ds,
      tip: "Prune shepherd-crook shoots with sterilised tools; apply copper spray at bloom." },
    { name: "Woolly Aphid (Eriosoma lanigerum)",
      riskFn: e => 45*bell(e.tmp,20,6) + 30*sig(e.hum,65,10) + 15*rsig(e.wind,15,8) + 5*(1-e.ds) + 5*sig(e.rain/52,2,2),
      tip: "Apply chlorpyrifos spray; prune heavily infested shoots; release parasitoids." },
  ],
  orange: [
    { name: "Citrus Canker (Xanthomonas axonopodis pv. citri)",
      riskFn: e => 55*sig(e.hum,75,7) + 25*bell(e.tmp,28,6) + 12*sig(e.rain/52,5,3) + 5*sig(e.wind,20,8) + 3*e.ds,
      tip: "Spray copper oxychloride 0.3% after every rain event; remove infected twigs." },
    { name: "Huanglongbing / Greening (CLas)",
      riskFn: e => 50*bell(e.tmp,26,7) + 25*sig(e.hum,68,8) + 15*rsig(e.wind,15,8) + 5*e.ds + 5*sig(e.rain/52,3,2),
      tip: "Control psylla vector with imidacloprid; remove and destroy infected trees." },
    { name: "Fruit Fly (Bactrocera dorsalis)",
      riskFn: e => 50*bell(e.tmp,30,6) + 25*sig(e.hum,65,8) + 15*rsig(e.wind,12,6) + 5*(1-e.ds) + 5*sig(e.rain/52,3,2),
      tip: "Use methyl eugenol traps; protein bait spray near harvest; collect fallen fruits." },
  ],
  papaya: [
    { name: "Papaya Ring Spot Virus",
      riskFn: e => 55*sig(e.tmp,30,6) + 25*sig(e.hum,70,8) + 12*rsig(e.wind,15,8) + 5*e.ds + 3*sig(e.rain/52,3,2),
      tip: "Remove ring-spot-infected plants; spray mineral oil to deter aphid vectors." },
    { name: "Phytophthora Foot Rot",
      riskFn: e => 55*sig(e.hum,85,6) + 25*bell(e.tmp,26,5) + 15*sig(e.rain/52,6,3) + 3*rsig(e.wind,5,4) + 2*e.ds,
      tip: "Ensure good drainage; soil drench with metalaxyl 0.1% at first crown symptoms." },
  ],
  coconut: [
    { name: "Root Wilt Disease (Phytoplasma)",
      riskFn: e => 55*sig(e.hum,78,7) + 25*bell(e.tmp,28,6) + 12*sig(e.rain/52,6,3) + 5*e.ds + 3*rsig(e.wind,8,5),
      tip: "Apply Trichoderma-enriched compost; ensure proper drainage; foliar nutrition." },
    { name: "Red Palm Weevil (Rhynchophorus ferrugineus)",
      riskFn: e => 50*bell(e.tmp,32,7) + 25*sig(e.hum,65,10) + 15*rsig(e.wind,15,8) + 5*(1-e.ds) + 5*sig(e.rain/52,3,2),
      tip: "Install pheromone traps; apply chlorpyrifos solution in crown region monthly." },
    { name: "Bud Rot (Phytophthora palmivora)",
      riskFn: e => 55*sig(e.hum,85,6) + 25*bell(e.tmp,26,5) + 15*sig(e.rain/52,7,3) + 3*rsig(e.wind,6,4) + 2*e.ds,
      tip: "Remove rotting spear leaf; drench crown with metalaxyl; avoid crown wounding." },
  ],
  jute: [
    { name: "Stem Rot (Macrophomina phaseolina)",
      riskFn: e => 55*sig(e.hum,82,6) + 25*bell(e.tmp,32,6) + 12*sig(e.rain/52,5,3) + 5*e.ds + 3*rsig(e.wind,8,5),
      tip: "Apply carbendazim 0.1% at stem elongation; avoid waterlogging in field." },
    { name: "Yellow Mite (Polyphagotarsonemus latus)",
      riskFn: e => 50*rsig(e.hum,55,10) + 30*bell(e.tmp,34,6) + 12*rsig(e.wind,15,8) + 5*(1-e.ds) + 3*sig(e.rain/52,2,2),
      tip: "Spray dicofol 0.05% or neem oil 3 ml/L on leaf undersides during dry spells." },
    { name: "Semilooper (Anomis sabulifera)",
      riskFn: e => 45*bell(e.tmp,30,7) + 30*sig(e.hum,70,10) + 15*sig(e.rain/52,4,3) + 5*e.ds + 5*rsig(e.wind,10,5),
      tip: "Apply carbaryl 0.2% or Bt spray at early larval infestation stage." },
  ],
  coffee: [
    { name: "Coffee Berry Borer (Hypothenemus hampei)",
      riskFn: e => 50*bell(e.tmp,27,6) + 25*sig(e.hum,72,8) + 15*rsig(e.wind,12,6) + 5*e.ds + 5*sig(e.rain/52,5,3),
      tip: "Apply endosulfan or Beauveria bassiana; use red-eyed fly traps in plantation." },
    { name: "Coffee Leaf Rust (Hemileia vastatrix)",
      riskFn: e => 55*sig(e.hum,78,7) + 25*bell(e.tmp,24,5) + 12*sig(e.rain/52,5,3) + 5*sig(e.wind,18,7) + 3*e.ds,
      tip: "Spray copper oxychloride 0.3% at 3-week intervals; maintain canopy air flow." },
    { name: "Green Scale (Coccus viridis)",
      riskFn: e => 45*sig(e.hum,80,7) + 30*bell(e.tmp,26,6) + 15*rsig(e.wind,8,5) + 5*e.ds + 5*sig(e.rain/52,4,3),
      tip: "Apply dimethoate spray; release Coccophagus parasitoids for biological control." },
  ],
};
 
const DEFAULT_CANDIDATES = [
  { name: "Downy Mildew",
    riskFn: e => 50*sig(e.hum,78,7) + 25*bell(e.tmp,24,5) + 15*sig(e.rain/52,4,3) + 5*e.ds + 5*rsig(e.wind,8,5),
    tip: "Spray metalaxyl + mancozeb 0.2% fortnightly; improve field drainage." },
  { name: "Red Spider Mite",
    riskFn: e => 50*rsig(e.hum,50,10) + 30*bell(e.tmp,34,6) + 12*rsig(e.wind,15,8) + 5*(1-e.ds) + 3*sig(e.rain/52,2,2),
    tip: "Apply acaricide only if >5 mites/leaf; maintain adequate irrigation." },
  { name: "Aphid Colony",
    riskFn: e => 45*sig(e.hum,65,10) + 30*bell(e.tmp,22,6) + 15*rsig(e.wind,18,8) + 5*(1-e.ds) + 5*sig(e.rain/52,2,2),
    tip: "Spray neem oil 3 ml/L fortnightly; introduce ladybird beetle as biocontrol." },
];
 
// Symptom data keyed by disease name (partial match on first word)
const DISEASE_SYMPTOMS = {
  "Rice Blast":      [{ title: "Diamond-Shaped Lesions", desc: "Grey-white diamond lesions with brown borders on leaves and nodes." }, { title: "Neck Rot", desc: "Brown-black lesion on panicle neck causing whiteear (blank grain)." }, { title: "Collar Rot", desc: "Rotting at collar region of leaf leading to leaf fall." }, { title: "Node Blast", desc: "Black nodes that break and topple the plant in severe cases." }],
  "Brown Plant":     [{ title: "Hopper Burn", desc: "Yellowing then browning patches from base upward; plant wilts." }, { title: "Hopperburn Halo", desc: "Circular patches of dead plants surrounded by yellowing ring." }, { title: "Honeydew Deposits", desc: "Sticky black sooty mould on leaf surface from hopper excreta." }, { title: "Stem Darkening", desc: "Dark brown staining at base of tillers where hoppers cluster." }],
  "Bacterial Leaf":  [{ title: "Water-Soaked Margins", desc: "Translucent water-soaked lesions at leaf tips or margins." }, { title: "Kresek Phase", desc: "Wilting of young seedlings as if drought-stressed in seedbed." }, { title: "Milky Ooze", desc: "Milky-white bacterial exudate visible when cut stem submerged." }, { title: "Pale Yellow Stripe", desc: "Yellow stripe running along length of leaf from infected margin." }],
  "Sheath Rot":      [{ title: "Brown Sheath Lesion", desc: "Irregular brown lesions on flag leaf sheath near heading." }, { title: "Spotted Glumes", desc: "Discoloured partially-empty grains inside infected sheath." }, { title: "Foul Odour", desc: "Characteristic unpleasant smell from rotting infected sheath." }, { title: "Stunted Panicle", desc: "Panicle partially trapped or emerges bent inside infected sheath." }],
  "Brown Rust":      [{ title: "Orange-Brown Pustules", desc: "Small circular orange-brown uredinia scattered on leaf surface." }, { title: "Chlorotic Halo", desc: "Yellow-green halo surrounding each rust pustule on upper surface." }, { title: "Black Telia", desc: "Dark teliospore masses replacing uredinia in late season." }, { title: "Premature Senescence", desc: "Heavily infected leaves turn yellow and die prematurely." }],
  "Yellow Rust":     [{ title: "Yellow Stripe Pattern", desc: "Yellow-orange pustules arranged in stripes along leaf veins." }, { title: "Powdery Yellow Dust", desc: "Easily rubbed yellow powder from stripe pustules on fingers." }, { title: "Glume Infection", desc: "Yellow pustules on glumes causing shrivelled grain." }, { title: "Cool-Weather Spread", desc: "Disease spreads rapidly in cool foggy mornings." }],
  "Aphids":          [{ title: "Dense Green Colony", desc: "Clusters of pale green insects on flag leaf and ear." }, { title: "Sticky Honeydew", desc: "Shiny sticky deposits on leaves attracting ants and sooty mould." }, { title: "Curled Leaf Tips", desc: "Leaf tips curl downward due to feeding pressure." }, { title: "Stunted Grain Fill", desc: "Heads with few filled grains due to nutrient drain." }],
  "Karnal Bunt":     [{ title: "Fishy-Smelling Grain", desc: "Partially-bunted grains with fishy trimethylamine odour." }, { title: "Black Spore Mass", desc: "Dark powdery spore mass replacing part of kernel inside glume." }, { title: "Discoloured Glumes", desc: "Brown-black staining on glume surface at maturity." }, { title: "Normal Appearance", desc: "Most grains appear normal; bunt found only on inspection." }],
  "Fall Armyworm":   [{ title: "Whorl Damage with Frass", desc: "Ragged holes and sawdust-like frass inside maize whorl." }, { title: "Window-Pane Feeding", desc: "Thin transparent window panes left by young larvae on leaves." }, { title: "Tassel Damage", desc: "Larvae bore into tassel causing ear with few kernels." }, { title: "Entry Hole on Cob", desc: "Circular entry hole at silk end; frass visible at bore point." }],
  "Downy Mildew":    [{ title: "Oily Yellow Spots", desc: "Pale yellow oily spots on upper leaf surface; downy growth below." }, { title: "White Sporulation", desc: "Greyish-white sporulation on underside in humid mornings." }, { title: "Stunted Shoots", desc: "New shoots remain stunted and pale with distorted leaves." }, { title: "Systemic Infection", desc: "Entire shoot yellows; plant stunted from basal systemic infection." }],
  "Stem Borer":      [{ title: "Dead Heart", desc: "Central shoot dies while outer tillers remain green." }, { title: "Frass in Gallery", desc: "Fine frass visible inside stem when broken at bore point." }, { title: "Pin-Hole Entry", desc: "Tiny circular entry hole on outer leaf sheath near base." }, { title: "White Ear", desc: "Infested panicle turns white; grains are empty." }],
  "Pink Bollworm":   [{ title: "Rosette Flower", desc: "Petals fused into rosette shape by larva boring into bud." }, { title: "Entry Hole on Boll", desc: "Circular entry hole on boll surface; lint stained pink." }, { title: "Pink Larva Inside", desc: "Pink caterpillar found tunnelling through seed in opened boll." }, { title: "Premature Boll Drop", desc: "Infested young bolls drop prematurely before opening." }],
  "Whitefly":        [{ title: "White Insect Cloud", desc: "Tiny white insects rise in cloud when plant is disturbed." }, { title: "Sooty Mould", desc: "Black sooty coating on upper leaf from honeydew deposits below." }, { title: "Yellowing Leaf", desc: "Chlorotic yellowing of leaf due to feeding on phloem sap." }, { title: "Virus Symptoms", desc: "Leaf curl and mosaic patterns from virus transmitted by whitefly." }],
  "Panama Wilt":     [{ title: "Outer Leaf Yellowing", desc: "Oldest outer leaves turn yellow progressively toward centre." }, { title: "Vascular Brown Ring", desc: "Cross-section of pseudostem shows brown vascular ring inside." }, { title: "Plant Collapse", desc: "Entire plant collapses as pseudostem splits or falls over." }, { title: "Root Rot", desc: "Roots show brown-black discolouration from base upward." }],
  "Sigatoka":        [{ title: "Yellow Streak", desc: "Pale yellow streaks parallel to veins on younger leaves." }, { title: "Brown Necrotic Patch", desc: "Streaks enlarge to brown necrotic patches on older leaves." }, { title: "Leaf Death", desc: "Severely infected leaves dry out and hang down from plant." }, { title: "Premature Ripening", desc: "Infected bunches ripen unevenly and before expected time." }],
  "Anthracnose":     [{ title: "Dark Sunken Spots", desc: "Dark brown sunken lesions on fruit with orange spore masses." }, { title: "Twig Die-back", desc: "Tips of shoots die back showing black lesions in humid weather." }, { title: "Blossom Blight", desc: "Flower clusters turn brown and fail to set fruit." }, { title: "Post-harvest Rot", desc: "Lesions appear on stored fruit turning soft and rotten." }],
  "Hopper":          [{ title: "Curled Panicle", desc: "Flower panicles wither and curl due to hopper punctures." }, { title: "Sticky Exudate", desc: "Honeydew deposits on leaves cause black sooty mould below." }, { title: "Blossom Drop", desc: "Infested flowers drop before setting any fruit." }, { title: "Nymph Colony", desc: "Dense pale nymph colonies at base of flower cluster." }],
  "Powdery Mildew":  [{ title: "White Powdery Coating", desc: "White talcum-like powder on leaves, shoots and young fruit." }, { title: "Stunted New Growth", desc: "New leaves emerge distorted and covered in white mycelium." }, { title: "Berry Split (Grapes)", desc: "Infected berries harden then split open exposing seeds." }, { title: "Premature Leaf Drop", desc: "Severely infected leaves turn brown and drop prematurely." }],
  "Fusarium Wilt":   [{ title: "Yellowing from Base", desc: "Yellowing starts from older leaves and progresses upward." }, { title: "Vascular Browning", desc: "Brown discolouration visible in vascular tissue when stem cut." }, { title: "Wilting Midday", desc: "Plant wilts during hot afternoon even with adequate moisture." }, { title: "Root Rot", desc: "Root system shows dark brown-black rot from soil line down." }],
  "Pod Borer":       [{ title: "Entry Hole on Pod", desc: "Circular entry hole on pod surface; seeds destroyed inside." }, { title: "Frass at Bore Point", desc: "Powdery frass visible around hole where larva entered pod." }, { title: "Caterpillar Inside", desc: "Green or brown caterpillar found when infected pod is opened." }, { title: "Terminal Shoot Damage", desc: "Young larvae feed on tender terminal shoots before moving to pods." }],
  "Mosaic Virus":    [{ title: "Yellow-Green Mosaic", desc: "Irregular yellow and green mosaic pattern on leaf blade." }, { title: "Leaf Distortion", desc: "Leaves crinkled, puckered or show downward curling at margins." }, { title: "Stunted Growth", desc: "Affected plants are shorter with smaller leaves and fewer pods." }, { title: "No Flower Set", desc: "Infested plants may flower but fail to set pods normally." }],
  "Rust":            [{ title: "Orange Pustules", desc: "Small orange to rust-coloured pustules on lower leaf surface." }, { title: "Yellow Halo", desc: "Pale yellow halo surrounds each pustule on upper surface." }, { name: "Premature Defoliation", desc: "Heavily infected leaves drop before normal senescence." }, { title: "Stem Pustules", desc: "Pustules also appear on stem and petiole in severe cases." }],
  "Bacterial Blight":[{ title: "Water-Soaked Spots", desc: "Dark water-soaked angular spots on leaves and fruit." }, { title: "Gum Exudation", desc: "Gummy amber exudate from cracks on infected fruit surface." }, { title: "Shoot Blight", desc: "New shoots show brown-black lesion and die from tip down." }, { title: "Fruit Cracking", desc: "Infected fruit develop cracks with secondary rot entry." }],
  "Fruit Borer":     [{ title: "Entry Hole on Fruit", desc: "Circular entry hole on fruit surface; frass visible at entry." }, { title: "Premature Drop", desc: "Infested young fruits drop prematurely before ripening." }, { title: "Caterpillar Inside", desc: "Worm found tunnelling through flesh when fruit is cut open." }, { title: "Dark Track Inside", desc: "Brown tunnels visible through fruit flesh to seed cavity." }],
  "Apple Scab":      [{ title: "Olive-Green Velvety Spots", desc: "Olive-green velvety spots on leaves and young fruit." }, { title: "Russet Scab on Fruit", desc: "Corky russet scab lesions on fruit surface at harvest." }, { title: "Leaf Distortion", desc: "Severely infected leaves pucker and drop in mid-season." }, { title: "Fruit Cracking", desc: "Scab lesions on fruit cause cracking as fruit expands." }],
  "Fire Blight":     [{ title: "Shepherd Crook", desc: "Shoot tips wilt and bend into distinctive shepherd crook shape." }, { title: "Blighted Blossoms", desc: "Flowers turn brown-black and remain attached to spur." }, { title: "Amber Ooze", desc: "Amber-brown bacterial ooze from lesions in humid weather." }, { title: "Bark Canker", desc: "Sunken dark canker on branch at junction of blighted shoot." }],
  "Woolly Aphid":    [{ title: "White Waxy Wool", desc: "White cottony waxy wool covering colonies on shoots and roots." }, { title: "Gall Formation", desc: "Swollen gall-like growths on woody parts where colonies feed." }, { title: "Root Colonies", desc: "White woolly colonies on roots causing stunted tree growth." }, { title: "Sooty Mould", desc: "Black sooty mould on leaves from honeydew deposits." }],
  "Citrus Canker":   [{ title: "Brown Raised Lesion", desc: "Brown raised corky lesion with yellow halo on leaves and fruit." }, { title: "Water-Soaked Margin", desc: "Water-soaked margin around fresh lesion visible in early stages." }, { title: "Fruit Blemish", desc: "Raised corky spots on fruit reduce market value but not edible." }, { title: "Twig Die-back", desc: "Severely infected twigs die back from tip downward." }],
  "Greening":        [{ title: "Asymmetric Yellowing", desc: "Irregular blotchy mottle on one side of leaf only (diagnostic)." }, { title: "Zinc-Like Deficiency", desc: "Symptoms mimic zinc deficiency but on only one side." }, { title: "Lopsided Fruit", desc: "Fruit turns small, lopsided with green colour at stylar end." }, { title: "Bitter Juice", desc: "Fruit from infected tree has bitter, acrid-tasting juice." }],
  "Citrus Canker (": [{ title: "Raised Corky Lesion", desc: "Rough corky raised lesion with oily water-soaked yellow halo." }, { title: "Fruit Spotting", desc: "Lesions on fruit skin reduce market grade and shelf life." }, { title: "Twig Lesion", desc: "Canker lesions girdle twig causing shoot die-back." }, { title: "Wind-Rain Spread", desc: "Disease spreads fastest after windy rain events in humid weather." }],
  "Ring Spot":       [{ title: "Yellow Mosaic on Leaf", desc: "Bright yellow mosaic mottling on papaya leaf blade." }, { title: "Ring Marks on Fruit", desc: "C-shaped or ring-shaped marks on green and ripe fruit skin." }, { title: "Stem Streaks", desc: "Water-soaked oily streaks on petiole and upper stem." }, { title: "Distorted Leaves", desc: "Young leaves emerge severely distorted and filiform." }],
  "Foot Rot":        [{ title: "Crown Lesion", desc: "Dark water-soaked lesion at stem base or graft union." }, { title: "Gum Exudation", desc: "Amber gum oozes from lesion at crown or root collar." }, { title: "Bark Peeling", desc: "Infected bark peels off revealing brown dead tissue beneath." }, { title: "Rapid Wilt", desc: "Entire plant wilts suddenly as vascular tissue is girdled." }],
  "Root Wilt":       [{ title: "Flaccid Leaflets", desc: "Leaflets turn yellow and hang limp without obvious pest damage." }, { title: "Yellowing Fronds", desc: "Lower fronds yellow progressively from outer to inner." }, { title: "Stunted Bunches", desc: "Nut size and number per bunch reduced significantly." }, { title: "Slow Decline", desc: "Tree declines over years; no rapid knockdown symptom." }],
  "Red Palm Weevil": [{ title: "Entry Hole at Crown", desc: "Bore hole with brown frass at crown base or trunk." }, { title: "Rotting Smell", desc: "Characteristic fermentation smell from infested crown." }, { title: "Wilted Spear Leaf", desc: "Young spear leaf wilts and falls before expanding." }, { title: "Larval Tunnels", desc: "Tunnels with white creamy grubs found when trunk is opened." }],
  "Bud Rot":         [{ title: "Yellowing Spear Leaf", desc: "Youngest spear leaf turns yellow then brown and falls." }, { title: "Rotting Growing Point", desc: "Soft brown rotten tissue at growing point with bad odour." }, { title: "Ladder Pattern", desc: "Successive spear leaves die in ladder pattern if mild." }, { title: "Black Exudate", desc: "Blackish exudate from decayed crown tissue in wet weather." }],
  "Stem Rot":        [{ title: "Water-Soaked Basal Lesion", desc: "Dark water-soaked lesion at stem base at soil level." }, { title: "Plant Toppling", desc: "Plant topples at base due to rotting of basal stem tissue." }, { title: "Internal Discolouration", desc: "Brown discolouration of pith when stem cross-section cut." }, { title: "Webby Mycelium", desc: "Fine cobweb-like mycelium visible inside stem at lesion site." }],
  "Yellow Mite":     [{ title: "Silver Streaks on Leaves", desc: "Silver-bronze streaks on upper leaf surface from mite feeding." }, { title: "Leaf Curl", desc: "Leaf margins roll upward; young leaves remain stunted." }, { title: "Fine Webbing", desc: "Fine silky webbing on leaf underside in heavy infestation." }, { title: "Shoot Tip Death", desc: "Shoot tips dry out and die in severe untreated infestation." }],
  "Semilooper":      [{ title: "Leaf Skeleton", desc: "Leaves eaten from margins leaving only midrib skeleton." }, { title: "Looping Movement", desc: "Caterpillar moves in looping gait; visible on stem and leaves." }, { title: "Defoliation", desc: "Rapid defoliation of field in outbreak conditions." }, { title: "Frass on Ground", desc: "Green pellet-shaped frass found on soil below infested plants." }],
  "Berry Borer":     [{ title: "Tiny Entry Hole on Berry", desc: "Tiny circular entry hole at disc end of coffee berry." }, { title: "Empty Seedy Berry", desc: "Infested berries lighter and hollow or webbed inside." }, { title: "White Larva Inside", desc: "Tiny white cylindrical larva found inside hollowed seed." }, { title: "Premature Berry Drop", desc: "Infested green berries drop before reaching maturity." }],
  "Leaf Rust":       [{ title: "Orange Powder Patches", desc: "Orange powdery uredinia patches on lower leaf surface." }, { title: "Yellow Halo on Top", desc: "Pale yellow spots on upper surface correspond to sporulation below." }, { title: "Premature Defoliation", desc: "Heavily infected leaves drop causing bare stems." }, { title: "Reduced Berry Yield", desc: "Defoliated plants produce fewer smaller berries next season." }],
  "Green Scale":     [{ title: "Oval Flat Green Insects", desc: "Oval flat green scale insects on stems and leaf undersides." }, { title: "Sooty Mould", desc: "Black sooty mould covers leaves from scale honeydew excretion." }, { title: "Stunted New Growth", desc: "New flush stunted and distorted due to scale feeding." }, { title: "Stem Encrustation", desc: "Stems completely encrusted with scale in heavy infestation." }],
  // fallback
  "default":         [{ title: "Abnormal Leaf Spots", desc: "Irregular spots or lesions on leaf surface of varying colour." }, { title: "Wilting", desc: "Plant wilts even with adequate soil moisture in root zone." }, { title: "Discolouration", desc: "Yellowing or browning of leaf tissue or vascular tissue inside." }, { title: "Pest Feeding Signs", desc: "Chewing damage, frass, honeydew or sooty mould on plant parts." }],
};
 
export function getSymptomsForDisease(diseaseName) {
  const key = Object.keys(DISEASE_SYMPTOMS).find(k => diseaseName.startsWith(k));
  return DISEASE_SYMPTOMS[key] || DISEASE_SYMPTOMS["default"];
}
 
// Urgent action templates keyed by disease name prefix
const URGENT_ACTIONS_MAP = {
  "Rice Blast":     [{ step:"1", title:"Fungicide Spray",       desc:"Apply Tricyclazole 0.1% (Beam/Baan) immediately at first grey lesion sighting." }, { step:"2", title:"Field Water Management",    desc:"Reduce standing water to 2–3 cm; drain if temperature drops below 20°C." }, { step:"3", title:"Potassium Boost",            desc:"Top-dress 20 kg/ha MOP to strengthen cell walls against blast penetration." }],
  "Brown Plant":    [{ step:"1", title:"Light Trap Deployment",  desc:"Install incandescent traps 1 m above canopy; collect hoppers nightly." }, { step:"2", title:"Buprofezin Application",     desc:"Spray buprofezin 25 SC at 1.25 ml/L; avoid spraying parasitoids directly." }, { step:"3", title:"Drain Field Perimeter",       desc:"Drain water from field edges where BPH tends to aggregate first." }],
  "Bacterial Leaf": [{ step:"1", title:"Field Drainage",         desc:"Drain standing water immediately; avoid overhead irrigation to reduce spread." }, { step:"2", title:"Copper Bactericide",          desc:"Spray copper hydroxide 0.3% at first water-soaked margin lesion." }, { step:"3", title:"Resistant Variety Plan",      desc:"Mark affected plots; plan resistant variety planting next season." }],
  "Brown Rust":     [{ step:"1", title:"Propiconazole Spray",    desc:"Apply propiconazole 25 EC at 0.1% immediately at first orange pustule sighting." }, { step:"2", title:"Irrigation Switch",           desc:"Stop overhead irrigation; switch to furrow to reduce leaf wetness." }, { step:"3", title:"Scout Flag Leaf Daily",       desc:"Monitor flag leaf and ear — rust here directly causes grain yield loss." }],
  "Yellow Rust":    [{ step:"1", title:"Mancozeb Preventive",    desc:"Apply mancozeb 0.25% at boot stage preventively in cool foggy weather." }, { step:"2", title:"Propiconazole Curative",       desc:"Switch to propiconazole 25 EC if stripes already forming on leaves." }, { step:"3", title:"Ventilation Check",           desc:"Ensure plant spacing allows adequate air circulation around crop canopy." }],
  "Aphids (":       [{ step:"1", title:"Imidacloprid Spray",     desc:"Apply imidacloprid 0.5 ml/L at flag leaf stage if >10 aphids/tiller detected." }, { step:"2", title:"Aphid Count Monitoring",      desc:"Scout 20 random plants per hectare; spray only at threshold." }, { step:"3", title:"Natural Enemy Check",         desc:"Look for ladybird beetles and lacewings before deciding to spray." }],
  "Karnal Bunt":    [{ step:"1", title:"Seed Treatment",         desc:"Use certified disease-free seed; treat with tebuconazole 2% WS before sowing." }, { step:"2", title:"Fungicide at Heading",         desc:"Apply tebuconazole 25.9 EC at boot stage to flowering stage." }, { step:"3", title:"Quarantine Infected Lot",      desc:"Separate infected grain; do not use as seed; sanitize farm equipment." }],
  "Fall Armyworm":  [{ step:"1", title:"Whorl Application",      desc:"Apply sand + carbofuran 3G mixture in whorl, or spray emamectin benzoate 1 g/L." }, { step:"2", title:"Pheromone Trap Setup",         desc:"Install FAW pheromone traps at 5/hectare to monitor adult population." }, { step:"3", title:"Bt Spray Option",              desc:"Spray Bacillus thuringiensis (Bt) formulation at early larval stage." }],
  "Downy Mildew":   [{ step:"1", title:"Metalaxyl + Mancozeb",   desc:"Spray metalaxyl + mancozeb 0.2% immediately at first oily spot sighting." }, { step:"2", title:"Canopy Air Flow",              desc:"Prune dense foliage; ensure adequate row spacing for air circulation." }, { step:"3", title:"Avoid Overhead Irrigation",   desc:"Switch to drip system to keep foliage dry and prevent spore spread." }],
  "Stem Borer":     [{ step:"1", title:"Trichogramma Release",   desc:"Release Trichogramma chilonis parasitoids at 50,000/hectare at egg stage." }, { step:"2", title:"Carbofuran in Whorl",          desc:"Apply carbofuran 3G at 15–20 kg/ha in whorl at early borer detection." }, { step:"3", title:"Light Trap at Night",          desc:"Deploy light traps to catch adult moths and reduce egg-laying population." }],
  "Pink Bollworm":  [{ step:"1", title:"Pheromone Traps",        desc:"Deploy delta traps with Z7Z11-16Ald lure at 5/ha; check weekly." }, { step:"2", title:"Spinosad Spray",               desc:"Apply spinosad 45 SC at 0.3 ml/L at first pheromone trap catch of season." }, { step:"3", title:"Boll Inspection",              desc:"Open bolls weekly; if >5% infestation spray chlorantraniliprole 18.5 SC." }],
  "Whitefly":       [{ step:"1", title:"Buprofezin Spray",       desc:"Apply buprofezin 25 SC 1 ml/L or thiamethoxam 25 WG 0.2 g/L immediately." }, { step:"2", title:"Yellow Sticky Traps",          desc:"Install yellow sticky traps at 25/ha to monitor and reduce population." }, { step:"3", title:"Neem Oil Spray",               desc:"Alternate with neem oil 3 ml/L to slow resistance development." }],
  "Panama Wilt":    [{ step:"1", title:"Immediate Isolation",    desc:"Excavate and isolate infected plant; do not replant same spot for 5 years." }, { step:"2", title:"Tool Disinfection",            desc:"Sterilize all cutting tools with 10% bleach solution between plants." }, { step:"3", title:"Resistant Variety Planning",  desc:"Replant with Fusarium-resistant Cavendish or FHIA hybrid varieties." }],
  "Sigatoka":       [{ step:"1", title:"Mancozeb Fortnightly",   desc:"Spray mancozeb 0.25% at 14-day intervals during rainy and humid season." }, { step:"2", title:"Remove Infected Leaves",       desc:"Prune and remove yellow-spotted leaves from base; do not compost them." }, { step:"3", title:"Improve Drainage",             desc:"Ensure field drainage channels are clear to prevent waterlogging." }],
  "Anthracnose":    [{ step:"1", title:"Carbendazim Spray",      desc:"Apply carbendazim 0.1% at first dark sunken spot on leaves or shoot tips." }, { step:"2", title:"Copper Protective Spray",      desc:"Follow up with copper oxychloride 0.3% after rain events." }, { step:"3", title:"Pre-harvest Spray",            desc:"Spray mancozeb 7–10 days before harvest to protect fruit from storage rot." }],
  "Mango Hopper":   [{ step:"1", title:"Imidacloprid Spray",     desc:"Apply imidacloprid 0.5 ml/L at panicle emergence before flowering starts." }, { step:"2", title:"Kaolin Clay Spray",            desc:"Spray kaolin particle film to physically deter hopper feeding on panicles." }, { step:"3", title:"Panicle Monitoring",           desc:"Check 10 panicles per tree; spray if >25 hoppers per panicle observed." }],
  "Powdery Mildew": [{ step:"1", title:"Sulphur Dust / WP",      desc:"Apply wettable sulphur 0.3% at first white powdery patch on shoot tips." }, { step:"2", title:"Karathane Spray",              desc:"Spray karathane 0.1% (dinocap) as alternative; do not apply above 32°C." }, { step:"3", title:"Prune Infected Shoots",        desc:"Prune heavily infected shoot tips; dispose away from orchard." }],
  "Fusarium Wilt":  [{ step:"1", title:"Trichoderma Drench",     desc:"Drench soil with Trichoderma viride 5 g/L around root zone of affected plants." }, { step:"2", title:"Remove Infected Plants",       desc:"Uproot and destroy infected plants; do not compost; burn or bury deep." }, { step:"3", title:"Carbendazim Soil Drench",      desc:"Drench with carbendazim 0.1% around adjacent healthy plants preventively." }],
  "Pod Borer":      [{ step:"1", title:"Chlorantraniliprole",    desc:"Apply chlorantraniliprole 18.5 SC at 0.3 ml/L at 50% flowering stage." }, { step:"2", title:"Pheromone Traps",              desc:"Install Helicoverpa pheromone traps at 5/ha; monitor adult catch weekly." }, { step:"3", title:"Bt Spray",                     desc:"Apply Bt (Bacillus thuringiensis) 1 g/L as eco-friendly alternative." }],
  "Bacterial Blight":[{ step:"1", title:"Copper Oxychloride",    desc:"Spray copper oxychloride 0.3% at first angular water-soaked lesion sighting." }, { step:"2", title:"Prune Infected Parts",          desc:"Prune and destroy infected twigs and fruit with sterilized tools." }, { step:"3", title:"Avoid Overhead Watering",      desc:"Stop overhead irrigation; switch to drip or basin system immediately." }],
  "Fruit Borer":    [{ step:"1", title:"Chlorantraniliprole",    desc:"Apply chlorantraniliprole 18.5 SC at 0.3 ml/L at first adult sighting." }, { step:"2", title:"Pheromone Traps",              desc:"Install pheromone traps at 5/ha around orchard perimeter." }, { step:"3", title:"Fruit Bagging",                desc:"Bag developing fruits with perforated paper bags to prevent oviposition." }],
  "Apple Scab":     [{ step:"1", title:"Mancozeb at Bud Break",  desc:"Spray mancozeb 0.25% at green tip stage before first infection period." }, { step:"2", title:"Post-Rain Spray",              desc:"Apply protectant spray within 24 hours of any rainfall event." }, { step:"3", title:"Rake and Destroy Leaves",      desc:"Collect and destroy fallen leaves to eliminate overwintering spore source." }],
  "Fire Blight":    [{ step:"1", title:"Prune Infected Shoots",  desc:"Prune shoots 30 cm below visible infection; sterilize tools in bleach." }, { step:"2", title:"Copper Bactericide",            desc:"Spray copper hydroxide 0.3% at bloom stage preventively." }, { step:"3", title:"Avoid Excess Nitrogen",         desc:"Stop all nitrogen fertilization to avoid soft growth susceptible to blight." }],
  "Woolly Aphid":   [{ step:"1", title:"Chlorpyrifos Spray",     desc:"Apply chlorpyrifos 20 EC at 2 ml/L directly on woolly aphid colonies." }, { step:"2", title:"Prune Infested Wood",           desc:"Prune heavily infested small branches; burn prunings away from orchard." }, { step:"3", title:"Release Parasitoids",          desc:"Introduce Aphelinus mali parasitoid wasps if available at 500/ha." }],
  "Citrus Canker":  [{ step:"1", title:"Copper Spray After Rain",desc:"Apply copper oxychloride 0.3% within 24 hours of any rain event." }, { step:"2", title:"Remove Infected Twigs",         desc:"Prune canker-infected twigs; seal cuts with Bordeaux paste." }, { step:"3", title:"Windbreak Planting",            desc:"Plant windbreaks on windward side to reduce rain-splash transmission." }],
  "Ring Spot":      [{ step:"1", title:"Rogue Infected Plants",  desc:"Remove mosaic-infected plants immediately before whitefly spreads virus further." }, { step:"2", title:"Mineral Oil Spray",            desc:"Spray white mineral oil 2% to deter aphid probing and virus inoculation." }, { step:"3", title:"Resistant Variety",            desc:"Replant with virus-tolerant red-fleshed papaya variety in next planting." }],
  "Foot Rot":       [{ step:"1", title:"Metalaxyl Soil Drench",  desc:"Drench soil with metalaxyl 0.1% around stem base at first sunken lesion." }, { step:"2", title:"Remove Infected Bark",          desc:"Scrape off infected bark; paint wound with Bordeaux paste or copper paint." }, { step:"3", title:"Improve Drainage",             desc:"Ensure water does not pond around stem base; add organic mulch away from stem." }],
  "Root Wilt":      [{ step:"1", title:"Trichoderma Compost",    desc:"Apply Trichoderma-enriched compost 25 kg/palm around root zone monthly." }, { step:"2", title:"Foliar Nutrition",              desc:"Spray micronutrient mix including Mg and B; deficiency worsens phytoplasma." }, { step:"3", title:"Control Vector Insects",        desc:"Spray imidacloprid to reduce vector insect population in plantation." }],
  "Red Palm Weevil":[{ step:"1", title:"Pheromone Traps",        desc:"Install FERROLURE pheromone traps at 1/hectare; check and refresh monthly." }, { step:"2", title:"Chlorpyrifos Crown Drench",    desc:"Pour chlorpyrifos 0.05% solution into crown leaf axils monthly." }, { step:"3", title:"Remove Breeding Sites",         desc:"Clear all dead palm trunks and decaying organic matter near plantation." }],
  "Bud Rot":        [{ step:"1", title:"Metalaxyl Crown Spray",  desc:"Spray metalaxyl 0.1% directly into crown region at first spear yellowing." }, { step:"2", title:"Remove Rotten Tissue",          desc:"Remove all rotting tissue from crown with sterilized tools; apply Bordeaux." }, { step:"3", title:"Avoid Crown Wounding",          desc:"Do not wound crown during cultural operations; wounds invite infection." }],
  "Stem Rot":       [{ step:"1", title:"Carbendazim Spray",      desc:"Spray carbendazim 0.1% at stem elongation stage; repeat after 15 days." }, { step:"2", title:"Drain Waterlogged Areas",       desc:"Open drainage channels immediately; avoid furrow irrigation in wet soil." }, { step:"3", title:"Remove Infected Debris",        desc:"Pull and destroy infected stems; do not plough residue into soil." }],
  "Yellow Mite":    [{ step:"1", title:"Dicofol Spray",          desc:"Spray dicofol 0.05% or neem oil 3 ml/L on leaf undersides during dry spells." }, { step:"2", title:"Irrigation Increase",           desc:"Increase irrigation frequency; mite populations crash with humid canopy." }, { step:"3", title:"Sulphur Dust",                  desc:"Apply sulphur dust 25 kg/ha in early morning to reduce mite population." }],
  "Semilooper":     [{ step:"1", title:"Carbaryl Spray",         desc:"Apply carbaryl 0.2% or chlorpyrifos 0.05% at early larval stage sighting." }, { step:"2", title:"Bt Spray",                     desc:"Spray Bacillus thuringiensis at 1 g/L as eco-friendly alternative." }, { step:"3", title:"Light Trap Deployment",         desc:"Install light traps to catch and count adult semilooper moths at night." }],
  "Berry Borer":    [{ step:"1", title:"Beauveria Spray",        desc:"Apply Beauveria bassiana 1×10⁸ conidia/ml as biocontrol at harvest time." }, { step:"2", title:"Trap Cropping",                 desc:"Maintain 3% of farm as trap crop of overripe berries; destroy weekly." }, { step:"3", title:"Harvest Timing",               desc:"Harvest all ripe berries promptly; leaving overripe berries increases pest." }],
  "Leaf Rust":      [{ step:"1", title:"Copper Oxychloride",     desc:"Spray copper oxychloride 0.3% at 3-week intervals starting at first orange pustule." }, { step:"2", title:"Propiconazole Option",          desc:"Apply propiconazole 25 EC as curative if infection already widespread." }, { step:"3", title:"Resistant Varieties",           desc:"Plan to replant with rust-resistant Catimor or Sarchimor variety next cycle." }],
  "Green Scale":    [{ step:"1", title:"Dimethoate Spray",       desc:"Apply dimethoate 30 EC at 1.5 ml/L targeting stem and leaf undersides." }, { step:"2", title:"Parasitoid Release",            desc:"Release Coccophagus parasitoid wasps at 500/ha for biological control." }, { step:"3", title:"Neem Oil Alternative",          desc:"Spray neem oil 3 ml/L to disrupt scale reproduction without harming parasitoids." }],
  "Sterility Mosaic":[{ step:"1", title:"Acaricide Spray",      desc:"Spray propargite or dicofol to kill eriophyid mite vector immediately." }, { step:"2", title:"Remove Diseased Plants",        desc:"Uproot and destroy sterility mosaic infected plants to prevent spread." }, { step:"3", title:"Resistant Varieties",           desc:"Plant wilt-mosaic resistant ICPH 2671 or ICP 8863 in next sowing." }],
  "default":        [{ step:"1", title:"Prophylactic Spray",     desc:"Apply neem oil 3 ml/L or Trichoderma viride to limit disease spread." }, { step:"2", title:"Moisture Control",             desc:"Switch to drip irrigation to minimise foliar wetness and spore splash." }, { step:"3", title:"Nitrogen Adjustment",          desc:"Reduce nitrogen top-dressing; soft tissue from excess N invites pathogens." }],
};
 
export function getUrgentActionsForDisease(diseaseName, humidity) {
  const key = Object.keys(URGENT_ACTIONS_MAP).find(k => diseaseName.startsWith(k));
  const base = URGENT_ACTIONS_MAP[key] || URGENT_ACTIONS_MAP["default"];
  // Inject live humidity into step 2 description where relevant
  return base.map(a => ({
    ...a,
    desc: a.desc.replace("{{hum}}", `${humidity}%`),
  }));
}
 
// ─── computeDiseaseRisk ───────────────────────────────────────────────────────
export function computeDiseaseRisk({ crop, temperature, humidity, rainfall, windSpeed, district }) {
  const ds   = districtSeed(district || "unknown");
  const ws   = Math.max(0, windSpeed ?? 10);
  const env  = { hum: humidity ?? 70, tmp: temperature ?? 28, rain: rainfall ?? 1000, wind: ws, ds };
  const cands = DISEASE_CANDIDATES[crop] || DEFAULT_CANDIDATES;
 
  const scored = cands.map(d => ({
    name:  d.name,
    score: Math.max(0, Math.min(100, Math.round(d.riskFn(env)))),
    tip:   d.tip,
  })).sort((a, b) => b.score - a.score);
 
  const primary   = scored[0];
  const secondary = scored[1] || scored[0];
 
  const riskLevel = primary.score >= 65 ? "High" : primary.score >= 40 ? "Medium" : "Low";
 
  // Build 3-item watchlist
  const companions = ["Soil-borne Fungi", "Minor Leaf Spot", "Mite Complex"];
  const watchlist = [
    { name: primary.name,   level: riskLevel,                                                                        score: primary.score,   tip: primary.tip },
    { name: secondary.name, level: secondary.score >= 65 ? "High" : secondary.score >= 40 ? "Medium" : "Low",       score: secondary.score, tip: secondary.tip },
    ...companions.map((name, i) => {
      const compScore = Math.max(8, Math.min(72, Math.round(
        20 + env.hum * 0.18 + env.tmp * 0.08 + ds * 28 * (i % 2 === 0 ? 1 : -1)
      )));
      return { name, level: compScore >= 55 ? "Medium" : "Low", score: compScore, tip: "Monitor weekly; apply preventive spray if conditions worsen." };
    }),
  ];
 
  const seenNames = new Set();
  const dedupedWatchlist = watchlist.filter(w => { if (seenNames.has(w.name)) return false; seenNames.add(w.name); return true; }).slice(0, 3);
 
  return { primaryDisease: primary.name, riskScore: primary.score, riskLevel, watchlist: dedupedWatchlist };
}
// ─────────────────────────────────────────────────────────────
// STATE → ANNUAL RAINFALL baseline (mm)
// ─────────────────────────────────────────────────────────────
const STATE_ANNUAL_RAINFALL = {
  'West Bengal': 1400,        // was 1600; drier western districts pulled too high
  'Assam': 2800,
  'Meghalaya': 11000,
  'Arunachal Pradesh': 2500,
  'Manipur': 1800,
  'Mizoram': 2100,
  'Nagaland': 2000,
  'Tripura': 2200,
  'Sikkim': 3000,
  'Kerala': 3000,
  'Karnataka': 1100,          // was 1200
  'Tamil Nadu': 900,
  'Andhra Pradesh': 900,
  'Telangana': 900,
  'Maharashtra': 1100,        // was 1200
  'Goa': 2900,
  'Odisha': 1450,             // was 1500
  'Jharkhand': 1200,          // was 1300
  'Bihar': 1100,              // was 1200
  'Uttar Pradesh': 950,       // was 1000
  'Madhya Pradesh': 1100,     // was 1200
  'Chhattisgarh': 1350,       // was 1400
  'Rajasthan': 500,
  'Gujarat': 750,             // was 800
  'Punjab': 650,
  'Haryana': 700,
  'Himachal Pradesh': 1600,
  'Uttarakhand': 1800,
  'Delhi': 700,
};

// ─────────────────────────────────────────────────────────────
// DISTRICT ALIAS MAP
// Normalizes common misspellings / alternate spellings → canonical
// Open-Meteo-searchable name. Keys are lowercase.
// ─────────────────────────────────────────────────────────────
const DISTRICT_ALIASES = {
  // Kerala
  'kasargod': 'Kasaragod',
  'kasargode': 'Kasaragod',
  'palakad': 'Palakkad',
  'palghat': 'Palakkad',
  'palakkad': 'Palakkad',
  'thrissur': 'Thrissur',
  'trichur': 'Thrissur',
  'thiruvananthapuram': 'Thiruvananthapuram',
  'trivandrum': 'Thiruvananthapuram',
  'kozhikode': 'Kozhikode',
  'calicut': 'Kozhikode',
  'ernakulam': 'Ernakulam',
  'cochin': 'Ernakulam',
  'kannur': 'Kannur',
  'cannanore': 'Kannur',
  // West Bengal
  'puruliya': 'Purulia',
  'paschim bardhaman': 'Asansol',
  'purba bardhaman': 'Burdwan',
  'barddhaman': 'Burdwan',
  'north 24 parganas': 'Barasat',
  'south 24 parganas': 'Diamond Harbour',
  'paschim medinipur': 'Medinipur',
  'purba medinipur': 'Haldia',
  'dakshin dinajpur': 'Balurghat',
  'uttar dinajpur': 'Raiganj',
  'cooch behar': 'Cooch Behar',
  // Tamil Nadu
  'kanyakumari': 'Kanyakumari',
  'kanniyakumari': 'Kanyakumari',
  'nilgiris': 'Ooty',
  'the nilgiris': 'Ooty',
  'tiruvallur': 'Tiruvallur',
  'thiruvallur': 'Tiruvallur',
  'tiruvarur': 'Tiruvarur',
  'thiruvarur': 'Tiruvarur',
  'viluppuram': 'Viluppuram',
  'mayiladuthurai': 'Mayiladuthurai',
  // Odisha
  'balasore': 'Balasore',
  'baleshwar': 'Balasore',
  'angul': 'Angul',
  'anugul': 'Angul',
  'jagatsinghpur': 'Jagatsinghpur',
  'jagatsinghapur': 'Jagatsinghpur',
  'jajpur': 'Jajpur',
  'jajapur': 'Jajpur',
  'subarnapur': 'Sonepur',
  // Andhra Pradesh / Telangana
  'visakhapatnam': 'Visakhapatnam',
  'vishakhapatnam': 'Visakhapatnam',
  'vizag': 'Visakhapatnam',
  'hanamkonda': 'Warangal',
  'yadadri bhuvanagiri': 'Bhongir',
  'bhadradri kothagudem': 'Kothagudem',
  'komaram bheem asifabad': 'Asifabad',
  'rajanna sircilla': 'Sircilla',
  'jayashankar bhupalpally': 'Bhupalpally',
  'jogulamba gadwal': 'Gadwal',
  'medchal-malkajgiri': 'Medchal',
  // Karnataka
  'bengaluru urban': 'Bangalore',
  'bengaluru rural': 'Bangalore',
  'bengaluru': 'Bangalore',
  'davanagere': 'Davangere',
  'vijayanagara': 'Hosapete',
  // Gujarat
  'ahmedabad': 'Ahmedabad',
  'banaskantha': 'Palanpur',
  'chhota udaipur': 'Chhota Udaipur',
  'devbhoomi dwarka': 'Dwarka',
  'devbhumi dwarka': 'Dwarka',
  'kutch': 'Bhuj',
  'kachchh': 'Bhuj',
  'mehsana': 'Mehsana',
  'mahesana': 'Mehsana',
  'panchmahal': 'Godhra',
  'panch mahals': 'Godhra',
  'sabarkantha': 'Himmatnagar',
  // Rajasthan
  'ganganagar': 'Sri Ganganagar',
  'sri ganganagar': 'Sri Ganganagar',
  'sriganganagar': 'Sri Ganganagar',
  // Uttar Pradesh
  'prayagraj': 'Prayagraj',
  'allahabad': 'Prayagraj',
  'ayodhya': 'Ayodhya',
  'faizabad': 'Ayodhya',
  // Madhya Pradesh
  'narmadapuram': 'Hoshangabad',
  'hoshangabad': 'Hoshangabad',
  // Himachal Pradesh
  'lahaul and spiti': 'Kaza',
  'lahul and spiti': 'Kaza',
  // Uttarakhand
  'rudraprayag': 'Rudraprayag',
  'rudra prayag': 'Rudraprayag',
  'udham singh nagar': 'Rudrapur',
  'udam singh nagar': 'Rudrapur',
  'uttarkashi': 'Uttarkashi',
  'uttar kashi': 'Uttarkashi',
  // Punjab
  'mohali': 'Mohali',
  's.a.s nagar': 'Mohali',
  'ferozepur': 'Ferozepur',
  'firozpur': 'Ferozepur',
  // Maharashtra
  'osmanabad': 'Osmanabad',
  'dharashiv': 'Osmanabad',
  'mumbai city': 'Mumbai',
  'mumbai suburban': 'Mumbai',
  // Assam
  'kamrup metropolitan': 'Guwahati',
  'charaideo': 'Sibsagar',
  'biswanath': 'Biswanath Chariali',
  'majuli': 'Jorhat',
  // Bihar
  'east champaran': 'Motihari',
  'west champaran': 'Bettiah',
  'kaimur': 'Bhabua',
  // Jharkhand
  'saraikela-kharsawan': 'Saraikela',
  'saraikela kharsawan': 'Saraikela',
  'east singhbhum': 'Jamshedpur',
  'west singhbhum': 'Chaibasa',
  // Haryana
  'gurugram': 'Gurgaon',
  'nuh': 'Nuh',
  'charkhi dadri': 'Charkhi Dadri',
  // Sikkim
  'gyalshing': 'Gyalshing',
  'pakyong': 'Pakyong',
  'soreng': 'Jorethang',
  // Northeast states
  'pakke-kessang': 'Pakke Kessang',
  'pakke kessang': 'Pakke Kessang',
  'south salmara-mankachar': 'Mankachar',
  'west karbi anglong': 'Hamren',
  'eastern west khasi hills': 'Nongstoin',
  'hnahthial': 'Lunglei',
  'khawzawl': 'Champhai',
  'saitual': 'Aizawl',
  'chumoukedima': 'Dimapur',
  'niuland': 'Dimapur',
  'tseminyu': 'Kohima',
  'noklak': 'Tuensang',
  'shamator': 'Tuensang',
  'jiribam': 'Jiribam',
  'kakching': 'Imphal',
  'kangpokpi': 'Senapati',
  'noney': 'Tamenglong',
  'pherzawl': 'Churachandpur',
  'tengnoupal': 'Moreh',
};

/**
 * Normalize a district name:
 * 1. Check alias map (handles misspellings & variant spellings).
 * 2. Return canonical form suitable for Open-Meteo search.
 */
function normalizeDistrict(name) {
  if (!name) return name;
  const key = name.toLowerCase().trim();
  return DISTRICT_ALIASES[key] || name.trim();
}

/**
 * Nearest-station fallback: given a list of Open-Meteo results,
 * pick the closest Indian result to (targetLat, targetLon).
 */
function nearestResult(results, targetLat, targetLon) {
  if (!results || results.length === 0) return null;
  const indian = results.filter(r => r.country_code === 'IN');
  const pool = indian.length > 0 ? indian : results;
  if (pool.length === 1) return pool[0];
  // Haversine-lite: minimise squared distance (no need for true km)
  return pool.reduce((best, r) => {
    const dLat = r.latitude - targetLat;
    const dLon = r.longitude - targetLon;
    const d = dLat * dLat + dLon * dLon;
    const bLat = best.latitude - targetLat;
    const bLon = best.longitude - targetLon;
    const bd = bLat * bLat + bLon * bLon;
    return d < bd ? r : best;
  });
}

/**
 * Geocode a district name with progressive fallback strategy:
 * 1. Normalize via alias map.
 * 2. Try "Canonical, State, India".
 * 3. Try "Canonical, India".
 * 4. Try original raw name, India.
 * 5. Try state capital as nearest-station fallback.
 * Returns { latitude, longitude } or null.
 */
async function geocodeDistrict(districtName, stateName, signal) {
  const canonical = normalizeDistrict(districtName);
  const queries = [
    stateName ? `${canonical}, ${stateName}, India` : `${canonical}, India`,
    `${canonical}, India`,
    `${districtName}, India`,
    ...(stateName ? [`${stateName}, India`] : []),
  ];

  // Deduplicate
  const seen = new Set();
  const uniqueQueries = queries.filter(q => {
    const k = q.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  for (const q of uniqueQueries) {
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`,
        { signal }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.results?.length) continue;

      // Prefer exact Indian match
      const indian = data.results.find(r => r.country_code === 'IN');
      if (indian) return { latitude: indian.latitude, longitude: indian.longitude, name: indian.name };

      // Any result
      const first = data.results[0];
      return { latitude: first.latitude, longitude: first.longitude, name: first.name };
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      // continue to next query
    }
  }
  return null;
}

function buildWeatherFromForecast(fd, elevation, stateName) {
  const LAPSE_RATE = 6.5 / 1000;
  const elevM = elevation ?? 0;
  const tempCorrection = -(elevM * LAPSE_RATE);

  const stateBaseline = STATE_ANNUAL_RAINFALL[stateName] ?? 1000;
  const weeklyAvg = fd.precipitation.reduce((s, v) => s + v, 0) / fd.precipitation.length;
  const liveScaled = Math.round(weeklyAvg * 52);
  let blended = Math.round(stateBaseline * 0.5 + liveScaled * 0.5);

  if (elevM > 500 && elevM <= 2500) {
    blended = Math.round(blended * (1.0 + ((elevM - 500) / 2000) * 0.8));
  } else if (elevM > 2500) {
    blended = Math.round(blended * Math.max(0.6, 1.8 - ((elevM - 2500) / 2000) * 0.6));
  }
  const annualRainfall = Math.max(200, Math.min(4500, blended));

  const humidityAdd = elevM < 2000
    ? Math.round(elevM / 200)
    : Math.max(0, 10 - Math.round((elevM - 2000) / 300));

  return {
    temperature: Math.round((fd.current.temperature_2m + tempCorrection) * 10) / 10,
    humidity: Math.min(100, fd.current.relative_humidity_2m + humidityAdd),
    rainfall: annualRainfall,
    ph: 6.5,
    windSpeed: fd.current.wind_speed_10m,
    precipitationProbability: fd.current.precipitation_probability,
    feelsLike: fd.current.apparent_temperature,
    maxTemp: fd.temp_max[0],
    minTemp: fd.temp_min[0],
    elevationMeters: Math.round(elevM),
  };
}

// ─────────────────────────────────────────────────────────────
// 1. DistrictSelector
// ─────────────────────────────────────────────────────────────
export function DistrictSelector() {
  const { t } = useLanguage();
  const { encoders, selectedState, setSelectedState, selectedDistrict, setDistrict } = useApp();

  const states    = Object.keys(encoders.state_districts || {}).sort();
  const districts = selectedState
    ? (encoders.state_districts[selectedState] || []).sort()
    : [];

  useEffect(() => {
    if (selectedState && districts.length > 0) {
      const match = districts.find(d => d.toLowerCase() === selectedDistrict.toLowerCase());
      if (!match) setDistrict(districts[0]);
    }
  }, [selectedState]); // eslint-disable-line

  useEffect(() => {
    if (selectedDistrict && !selectedState && encoders.state_districts) {
      for (const [state, distList] of Object.entries(encoders.state_districts)) {
        if (distList.some(d => d.toLowerCase() === selectedDistrict.toLowerCase())) {
          setSelectedState(state);
          break;
        }
      }
    }
  }, [selectedDistrict]); // eslint-disable-line

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1.5">
          <FaFilter className="text-teal" size={10} />
          {t('select.state', 'Filter by State')}
        </label>
        <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className="select-field">
          <option value="">{t('select.state', 'Select State')}</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1.5">
          <FaMapMarkerAlt className="text-orange" size={10} />
          {t('select.district', 'Active District')}
        </label>
        <select
          value={districts.find(d => d.toLowerCase() === selectedDistrict.toLowerCase()) || ''}
          onChange={(e) => setDistrict(e.target.value)}
          className="select-field"
          disabled={!selectedState}
        >
          <option value="">{t('select.district', 'Select District')}</option>
          {districts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. CropGrid
// ─────────────────────────────────────────────────────────────
export function CropGrid() {
  const { selectedCrop, setCrop, CROP_DEFAULTS } = useApp();
  const crops = Object.keys(CROP_DEFAULTS);

  const fmt = (raw) => {
    const MAP = { kidneybeans: 'Kidney Beans', pigeonpeas: 'Pigeon Peas',
                  mothbeans: 'Moth Beans', mungbean: 'Mung Bean', blackgram: 'Black Gram' };
    return MAP[raw] || (raw.charAt(0).toUpperCase() + raw.slice(1));
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {crops.map((crop) => {
        const sel = selectedCrop === crop;
        return (
          <button type="button" key={crop} onClick={() => setCrop(crop)}
            className={`flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all duration-300 gap-2 cursor-pointer ${
              sel ? 'border-teal bg-teal/15 shadow-md shadow-teal/10 scale-[1.03]'
                  : 'border-border bg-surface-elevated/40 hover:border-teal-700 hover:bg-surface-elevated'}`}>
            <FaLeaf size={18} className={sel ? 'text-teal-light' : 'text-text-secondary'} />
            <span className={`text-xs font-semibold tracking-wide ${sel ? 'text-teal-light font-bold' : 'text-text-primary'}`}>
              {fmt(crop)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. FieldSlider
// ─────────────────────────────────────────────────────────────
export function FieldSlider() {
  const { t } = useLanguage();
  const { fieldSize, setFieldSize } = useApp();
  return (
    <div className="bg-surface-elevated/20 border border-border p-5 rounded-2xl flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
          <FaRulerCombined className="text-teal" size={12} />
          {t('label.field_size', 'Field Size')}
        </span>
        <span className="text-sm font-extrabold text-teal-light bg-teal/10 px-2.5 py-1 rounded-md border border-teal/20">
          {fieldSize} ha
        </span>
      </div>
      <div className="relative">
        <input type="range" min="0.5" max="50" step="0.5" value={fieldSize}
          onChange={(e) => setFieldSize(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-surface border border-border rounded-lg appearance-none cursor-pointer accent-teal" />
        <div className="flex justify-between text-[10px] text-text-muted font-bold tracking-wider mt-1.5 uppercase">
          <span>0.5 ha</span><span>25 ha</span><span>50 ha</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. WeatherCard
//    Fixes:
//    • District alias normalization before geocoding
//    • Progressive 4-strategy geocoding with nearest-station fallback
//    • AbortController cancels in-flight requests
// ─────────────────────────────────────────────────────────────
export function WeatherCard() {
  const { t } = useLanguage();
  const { weatherValues, setWeatherValues, selectedDistrict, selectedState } = useApp();
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [resolvedName, setResolvedName] = useState('');
  const [stationName, setStationName] = useState('');
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleLiveFetch = useCallback(async () => {
    if (!selectedDistrict) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setFetching(true);
    setFetchError(null);
    setResolvedName('');

    try {
      // ── Step 1: Geocode with alias normalization + nearest-station fallback ──
      const loc = await geocodeDistrict(selectedDistrict, selectedState, signal);

      if (!loc) {
        throw new Error(
          `Could not find weather station for "${selectedDistrict}". ` +
          `Try selecting a different district or check your connection.`
        );
      }

      setResolvedName(loc.name !== selectedDistrict ? loc.name : '');
      setStationName(loc.name || selectedDistrict);
      const { latitude, longitude } = loc;

      // ── Step 2: Fetch weather from backend ──────────────────────────────────
      const wxData = await fetchForecast(latitude, longitude, signal);

      if (!wxData.success || !wxData.data) throw new Error('Invalid weather response from server');

      const weather = buildWeatherFromForecast(wxData.data, wxData.elevation ?? 0, selectedState);
      setWeatherValues(weather);
      setFetchError(null);
      console.log(
        `✅ Weather for ${selectedDistrict}` +
        (loc.name !== selectedDistrict ? ` (resolved → ${loc.name})` : '') +
        `: ${weather.temperature}°C, ${weather.rainfall}mm rain, ${weather.elevationMeters}m elev.`
      );

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('WeatherCard fetch failed:', err);
      setFetchError(err.message);
    } finally {
      if (abortRef.current === controller) setFetching(false);
    }
  }, [selectedDistrict, selectedState, setWeatherValues]);

  return (
    <div className="bg-surface-elevated/20 border border-border p-6 rounded-2xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
          <FaCloudSun className="text-teal" size={14} />
          {t('title.weather_agroclimate', 'Local Environmental Matrix')}
          {weatherValues.elevationMeters > 0 && (
            <span className="text-[9px] text-text-muted ml-1">
              {weatherValues.elevationMeters}m elev.
            </span>
          )}
        </h3>
        <button type="button" onClick={handleLiveFetch}
          disabled={fetching || !selectedDistrict}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
          <FaExchangeAlt className={fetching ? 'animate-spin' : ''} />
          {fetching ? 'Syncing...' : t('button.fetch_weather', 'Get Live Weather')}
        </button>
      </div>

      {stationName && (
        <div className="bg-teal/5 border border-teal/20 text-teal-light text-[10px] p-2 rounded-lg font-semibold flex items-center gap-1.5">
          <FaMapMarkerAlt size={9} />
          Weather station:{' '}
          <span className="font-bold">{stationName}</span>
          {resolvedName && resolvedName !== selectedDistrict && (
            <span className="text-text-muted font-normal ml-1">(nearest to {selectedDistrict})</span>
          )}
        </div>
      )}

      {fetchError && (
        <div className="bg-danger/10 border border-danger/20 text-danger text-[10px] p-2.5 rounded-xl font-semibold">
          ⚠ {fetchError}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="kpi-card flex flex-col gap-2">
          <FaTemperatureHigh className="text-orange" size={18} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{t('label.temp', 'Temp')}</span>
          <span className="text-lg font-extrabold text-text-primary">{weatherValues.temperature}°C</span>
        </div>
        <div className="kpi-card flex flex-col gap-2">
          <FaTint className="text-blue-400" size={18} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{t('label.humidity', 'Humidity')}</span>
          <span className="text-lg font-extrabold text-text-primary">{weatherValues.humidity}%</span>
        </div>
        <div className="kpi-card flex flex-col gap-2">
          <FaCloudShowersHeavy className="text-teal-light" size={18} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{t('label.rainfall', 'Rainfall')}</span>
          <span className="text-lg font-extrabold text-text-primary">{weatherValues.rainfall} mm</span>
          <span className="text-[9px] text-text-muted">est. annual</span>
        </div>
        <div className="kpi-card flex flex-col gap-2">
          <FaWind className="text-blue-300" size={18} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Wind Speed</span>
          <span className="text-lg font-extrabold text-text-primary">{weatherValues.windSpeed ?? '--'} km/h</span>
        </div>
        <div className="kpi-card flex flex-col gap-2">
          <FaCloudShowersHeavy className="text-purple-400" size={18} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Precip. Chance</span>
          <span className="text-lg font-extrabold text-text-primary">{weatherValues.precipitationProbability ?? '--'}%</span>
        </div>
        <div className="kpi-card flex flex-col gap-2">
          <FaThermometerHalf className="text-red-400" size={18} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Max / Min</span>
          <span className="text-lg font-extrabold text-text-primary">{weatherValues.maxTemp ?? '--'}° / {weatherValues.minTemp ?? '--'}°</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. ForecastChart
// ─────────────────────────────────────────────────────────────
export function ForecastChart({ dataPoints }) {
  const days = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
  const temps = dataPoints?.temps || [28, 29, 27, 28, 30, 29, 28];
  const rain  = dataPoints?.rain  || [15, 22, 45, 10, 5, 12, 18];

  // Compute fixed axis bounds with generous padding so small-range weeks
  // (cold hill districts) don't get visually exploded by tight auto-scaling
  const tempMin = Math.min(...temps);
  const tempMax = Math.max(...temps);
  const tempPad = Math.max(3, (tempMax - tempMin) * 0.4);

  const rainMin = Math.min(...rain);
  const rainMax = Math.max(...rain);
  const rainPad = Math.max(5, (rainMax - rainMin) * 0.4);

  const data = {
    labels: days,
    datasets: [
      { label: 'Temperature (°C)', data: temps, borderColor: '#D95B26',
        backgroundColor: 'rgba(217,91,38,0.1)', yAxisID: 'y', tension: 0.15, fill: true,
        pointRadius: 4, pointHoverRadius: 6 },
      { label: 'Rainfall (mm)', data: rain, borderColor: '#167083',
        backgroundColor: 'rgba(22,112,131,0.1)', yAxisID: 'y1', tension: 0.15, fill: true,
        pointRadius: 4, pointHoverRadius: 6 },
    ],
  };

  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { color: '#94a3b8', font: { family: 'Inter', weight: '600', size: 11 } } } },
    scales: {
      x: { grid: { color: 'rgba(42,58,78,0.4)' }, ticks: { color: '#94a3b8', font: { family: 'Inter' } } },
      y: { type: 'linear', display: true, position: 'left',
           min: Math.floor(tempMin - tempPad), max: Math.ceil(tempMax + tempPad),
           grid: { color: 'rgba(42,58,78,0.4)' }, ticks: { color: '#D95B26', font: { family: 'Inter' } } },
      y1: { type: 'linear', display: true, position: 'right',
            min: Math.floor(rainMin - rainPad), max: Math.ceil(rainMax + rainPad),
            grid: { drawOnChartArea: false }, ticks: { color: '#167083', font: { family: 'Inter' } } },
    },
  };

  return <div className="w-full h-64 md:h-72"><Line data={data} options={options} /></div>;
}

export function NPKDonut({ N, P, K }) {
  const n = Math.round((N || 80) * 10) / 10;
  const p = Math.round((P || 40) * 10) / 10;
  const k = Math.round((K || 40) * 10) / 10;
  const total = n + p + k || 1;

  const nPct = Math.round((n / total) * 1000) / 10;
  const pPct = Math.round((p / total) * 1000) / 10;
  const kPct = Math.round((k / total) * 1000) / 10;

  const dominant =
    n >= p && n >= k ? { label: 'N', pct: nPct, color: '#167083', name: 'Nitrogen' }
    : p >= k         ? { label: 'P', pct: pPct, color: '#e87a4d', name: 'Phosphorus' }
    :                  { label: 'K', pct: kPct, color: '#f59e0b', name: 'Potassium' };

  const data = {
    labels: ['Nitrogen (N)', 'Phosphorus (P)', 'Potassium (K)'],
    datasets: [{
      data: [n, p, k],
      backgroundColor: ['#167083', '#e87a4d', '#f59e0b'],
      borderWidth: 2,
      borderColor: '#1a2332',
      hoverBorderWidth: 3,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    animation: { duration: 500 },
    plugins: {
      legend: {
        display: false,   // We render a custom legend below for full control
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw;
            const pct = Math.round((raw / total) * 1000) / 10;
            return `  ${ctx.label}: ${pct}%  (${raw} kg/ha)`;
          },
        },
        backgroundColor: '#0f1c2e',
        borderColor: '#2a3a4e',
        borderWidth: 1,
        titleColor: '#94a3b8',
        bodyColor: '#e2e8f0',
        padding: 10,
      },
    },
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Chart + center label */}
      <div className="relative flex items-center justify-center" style={{ height: '180px' }}>
        <Doughnut key={`npk-${n}-${p}-${k}`} data={data} options={options} />
        {/* Center overlay — positioned inside the cutout hole */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted leading-none mb-0.5">
            Dominant
          </span>
          <span className="text-2xl font-extrabold leading-none" style={{ color: dominant.color }}>
            {dominant.pct}%
          </span>
          <span className="text-[10px] font-bold leading-none mt-0.5" style={{ color: dominant.color }}>
            {dominant.name}
          </span>
        </div>
      </div>

      {/* Custom legend — full width, no truncation */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Nitrogen', abbr: 'N', val: n, pct: nPct, color: '#167083', bg: 'rgba(22,112,131,0.12)' },
          { label: 'Phosphorus', abbr: 'P', val: p, pct: pPct, color: '#e87a4d', bg: 'rgba(232,122,77,0.12)' },
          { label: 'Potassium', abbr: 'K', val: k, pct: kPct, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
        ].map((item) => (
          <div
            key={item.abbr}
            className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 border"
            style={{ backgroundColor: item.bg, borderColor: item.color + '40' }}
          >
            {/* Colour dot */}
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {/* Percentage — big and clear */}
            <span className="text-base font-extrabold leading-none" style={{ color: item.color }}>
              {item.pct}%
            </span>
            {/* Nutrient name */}
            <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider leading-none">
              {item.label}
            </span>
            {/* Raw kg/ha */}
            <span className="text-[9px] text-text-muted leading-none">
              {item.val} kg/ha
            </span>
          </div>
        ))}
      </div>

      {/* Total strip */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface rounded-lg border border-border">
        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Total NPK</span>
        <span className="text-sm font-extrabold text-text-primary">{Math.round(total * 10) / 10} <span className="text-[10px] font-normal text-text-muted">kg/ha</span></span>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────
// 7. SeasonalityChart
// ─────────────────────────────────────────────────────────────
// Commodity-specific price seasonality patterns (₹/quintal, indicative monthly indices)
const COMMODITY_SEASONALITY = {
  'Maize': [1950,1850,1800,1750,1700,1850,2050,2200,2150,2050,1950,2000],
  'Arhar (Tur/Red Gram)(Whole)': [5600,5700,5800,5500,5200,5100,5300,5600,5800,6000,5900,5700],
  'Green Gram (Moong)(Whole)': [6200,6100,5900,5700,5600,5800,6000,6300,6500,6400,6200,6300],
  'Lentil (Masur)(Whole)': [5800,5700,5600,5400,5200,5300,5500,5700,5900,6000,5900,5800],
  'Banana': [1800,1750,1700,1900,2200,2100,1900,1750,1800,2000,2100,2000],
  'Mango': [4000,3800,3500,2800,2200,2500,3500,4000,4200,4000,3800,3900],
  'Apple': [9000,9200,9500,9800,10000,9800,9200,8500,8000,7800,8200,8800],
  'Cotton': [6000,6200,6500,6800,6600,6200,5800,5500,5600,5900,6200,6100],
};

export function SeasonalityChart({ commodity }) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const prices = COMMODITY_SEASONALITY[commodity]
    || [3200,3100,2900,2800,3050,3300,3450,3600,3500,3250,3400,3550];
  const data = {
    labels: months,
    datasets: [{
      label: `${commodity || 'Commodity'} Price (₹/quintal)`, data: prices,
      backgroundColor: 'rgba(22,112,131,0.65)', hoverBackgroundColor: 'rgba(217,91,38,0.9)',
      borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    }],
  };
  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => ` ₹${i.raw} / quintal` } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } } },
      y: { grid: { color: 'rgba(42,58,78,0.4)' },
           ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 }, callback: (v) => `₹${v}` } },
    },
  };
  return <div className="w-full h-56 md:h-64"><Bar data={data} options={options} /></div>;
}