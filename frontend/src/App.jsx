import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { fetchEncoders, predictCrop, predictMarket, fetchForecast } from './api';
import { 
  DistrictSelector, CropGrid, FieldSlider, WeatherCard, 
  ForecastChart, NPKDonut, SeasonalityChart,
  computeDiseaseRisk, getSymptomsForDisease, getUrgentActionsForDisease
} from './components';
import { isMarketSupported } from './marketSupport';
import {
  FaLeaf, FaSeedling, FaBug, FaTint, FaCloudSun,
  FaStore, FaCalculator, FaFileInvoice, FaBars,
  FaGlobe, FaMapMarkerAlt, FaExpandAlt, FaCompressAlt,
  FaArrowRight, FaSearchLocation, FaChartLine, FaChartBar,
  FaHeartbeat, FaTable, FaCoins, FaInfoCircle,
  FaExclamationTriangle, FaBiohazard, FaShieldAlt,
  FaEye, FaHistory, FaCalendarAlt, FaBriefcase,
  FaThermometerHalf, FaSun, FaWind, FaUserCheck,
  FaBalanceScale, FaCalendarCheck
} from 'react-icons/fa';
import { resolveFertilizerConflict } from './fertilizerConflictResolver';
// ==========================================
// 1. EMBEDDED TRANSLATIONS DICTIONARY
// ==========================================
const TRANSLATIONS = {
  en: {
    "nav.overview": "Farm Overview", "nav.fertilizer": "Fertilizer & Soil", "nav.pest": "Pest & Disease",
    "nav.irrigation": "Irrigation & Water", "nav.weather": "Weather Advisory", "nav.market": "Market Intelligence",
    "nav.yield": "Yield & Scenarios", "nav.report": "Full Season Report", "app.title": "AgroSense",
    "app.subtitle": "Sustainable E-Agriculture Platform", "select.state": "Select State", "select.district": "Select District",
    "select.crop": "Select Crop", "select.market": "Select Market", "select.commodity": "Select Commodity",
    "select.month": "Select Month", "select.year": "Select Year", "label.field_size": "Field Size (hectares)",
    "label.temp": "Temperature", "label.humidity": "Humidity", "label.rainfall": "Rainfall", "label.ph": "Soil pH",
    "label.n": "Nitrogen (N)", "label.p": "Phosphorus (P)", "label.k": "Potassium (K)",
    "button.fetch_weather": "Get Live Weather", "button.submit": "Run Diagnostic Analysis", "button.predict_market": "Predict Market Price",
    "button.calculate": "Calculate Yield", "title.crop_recommendation": "Recommended Crop & Strategy", "title.alternatives": "Alternative Crop Scenarios",
    "title.yield_forecast": "Yield & Productivity Forecast", "title.fertilizer_strategy": "Precision Fertilizer Protocol", "title.nutrient_schedule": "Nutrient Application Timeline",
    "title.soil_health": "Soil Health Status", "title.financial_forecast": "Financial & ROI Projections", "title.pest_disease": "Pest & Disease Intelligence",
    "title.symptoms_gallery": "Diagnostic Symptoms Gallery", "title.urgent_actions": "Urgent Crop Protection Plan", "title.crop_watchlist": "Crop Health Watchlist",
    "title.irrigation_management": "Smart Irrigation & Hydration", "title.growth_stage": "Crop Growth Stage Timeline", "title.weekly_schedule": "Precision Weekly Irrigation Schedule",
    "title.water_budget": "Seasonal Water Resource Budget", "title.weather_agroclimate": "Agro-Climate & Weather Advisory", "title.forecast_7day": "7-Day Predictive Weather Grid",
    "title.agro_indices": "Agro-Climatic Indicators", "title.crop_recommendations": "Crop-Specific Meteorological Advisory", "title.market_prediction": "Market Price Predictor",
    "title.ai_recommendation": "AI Mandi Advisory", "title.seasonality": "Mandi Price Seasonality Chart", "title.mandi_comparison": "Regional Mandi Comparison",
    "title.yield_scenarios": "Yield Optimizer & Economic Scenarios", "title.break_even": "Break-Even Analytics", "title.economic_scenarios": "Economic Demand Scenarios",
    "title.yield_trends": "Yield Performance Trends", "title.full_report": "Full Season Agricultural Report", "title.season_kpis": "Season Performance Key Metrics",
    "title.efficiency_rings": "Resource Efficiency Indices", "title.risk_timeline": "Chronological Season Risk Timeline", "title.profitability_table": "Seasonal Profit & Loss Ledger",
    "common.tonnes": "tonnes", "common.tonnes_per_ha": "tonnes/ha", "common.rupees": "₹", "common.per_bag": "per 50kg bag",
    "common.per_quintal": "per quintal (100kg)", "common.lakhs": "Lakhs", "status.optimal": "Optimal", "status.high": "High Risk",
    "status.medium": "Medium Risk", "status.low": "Low Risk", "status.warning": "Warning", "action.hold": "HOLD STOCK (Price Rising)",
    "action.sell": "SELL NOW (Price Peaking)"
  },
  hi: {
    "nav.overview": "खेत का अवलोकन", "nav.fertilizer": "उर्वरक और मिट्टी", "nav.pest": "कीट और रोग",
    "nav.irrigation": "सिंचाई और जल", "nav.weather": "मौसम सलाह", "nav.market": "बाज़ार की जानकारी",
    "nav.yield": "उपज और परिदृश्य", "nav.report": "पूर्ण सीजन रिपोर्ट", "app.title": "AgroSense",
    "app.subtitle": "सतत ई-कृषि मंच", "select.state": "राज्य चुनें", "select.district": "जिला चुनें",
    "select.crop": "फसल चुनें", "select.market": "मंडी चुनें", "select.commodity": "वस्तु चुनें",
    "select.month": "महीना चुनें", "select.year": "वर्ष चुनें", "label.field_size": "खेत का आकार (हेक्टेयर)",
    "label.temp": "तापमान", "label.humidity": "आर्द्रता", "label.rainfall": "वर्षा", "label.ph": "मिट्टी का पीएच",
    "label.n": "नाइट्रोजन (N)", "label.p": "फास्फोरस (P)", "label.k": "पोटेशियम (K)",
    "button.fetch_weather": "लाइव मौसम प्राप्त करें", "button.submit": "नैदानिक विश्लेषण चलाएं", "button.predict_market": "बाजार मूल्य की भविष्यवाणी करें",
    "button.calculate": "उपज की गणना करें", "title.crop_recommendation": "अनुशंसित फसल और रणनीति", "title.alternatives": "वैकल्पिक फसल परिदृश्य",
    "title.yield_forecast": "उपज और उत्पादकता का पूर्वानुमान", "title.fertilizer_strategy": "सटीक उर्वरक प्रोटोकॉल", "title.nutrient_schedule": "पोषक तत्व अनुप्रयोग समयरेखा",
    "title.soil_health": "मिट्टी के स्वास्थ्य की स्थिति", "title.financial_forecast": "वित्तीय और आरओआई अनुमान", "title.pest_disease": "कीट और रोग खुफिया",
    "title.symptoms_gallery": "नैदानिक लक्षण गैलरी", "title.urgent_actions": "तत्काल फसल सुरक्षा योजना", "title.crop_watchlist": "फसल स्वास्थ्य निगरानी सूची",
    "title.irrigation_management": "स्मार्ट सिंचाई और जलयोजन", "title.growth_stage": "फसल विकास चरण समयरेखा", "title.weekly_schedule": "सटीक साप्ताहिक सिंचाई कार्यक्रम",
    "title.water_budget": "मौसमी जल संसाधन बजट", "title.weather_agroclimate": "कृषि-जलवायु और मौसम सलाह", "title.forecast_7day": "7-दिवसीय भविष्य कहनेवाला मौसम ग्रिड",
    "title.agro_indices": "कृषि-जलवायु संकेतक", "title.crop_recommendations": "फसल-विशिष्ट मौसम विज्ञान सलाह", "title.market_prediction": "बाजार मूल्य भविष्यवक्ता",
    "title.ai_recommendation": "एआई मंडी सलाह", "title.seasonality": "मंडी मूल्य मौसमी चार्ट", "title.mandi_comparison": "क्षेत्रीय मंडी तुलना",
    "title.yield_scenarios": "उपज अनुकूलक और आर्थिक परिदृश्य", "title.break_even": "ब्रेक-इवन एनालिटिक्स", "title.economic_scenarios": "आर्थिक मांग परिदृश्य",
    "title.yield_trends": "उपज प्रदर्शन रुझान", "title.full_report": "पूर्ण सीजन कृषि रिपोर्ट", "title.season_kpis": "सीजन प्रदर्शन प्रमुख मेट्रिक्स",
    "title.efficiency_rings": "संसाधन दक्षता सूचकांक", "title.risk_timeline": "कालानुक्रमिक सीजन जोखिम समयरेखा", "title.profitability_table": "मौसमी लाभ और हानि खाता",
    "common.tonnes": "टन", "common.tonnes_per_ha": "टन/हेक्टेयर", "common.rupees": "₹", "common.per_bag": "प्रति 50 किलोग्राम बोरी",
    "common.per_quintal": "प्रति क्विंटल (100 किलोग्राम)", "common.lakhs": "लाख", "status.optimal": "इष्टतम", "status.high": "उच्च जोखिम",
    "status.medium": "मध्यम जोखिम", "status.low": "कम जोखिम", "status.warning": "चेतावनी", "action.hold": "स्टॉक रखें (मूल्य बढ़ रहा है)",
    "action.sell": "अभी बेचें (मूल्य चरम पर है)"
  },
  bn: {
    "nav.overview": "খামার ওভারভিউ", "nav.fertilizer": "সার ও মাটি", "nav.pest": "কীটপতঙ্গ ও রোগ",
    "nav.irrigation": "সেচ ও জল", "nav.weather": "আবহাওয়া পরামর্শ", "nav.market": "বাজার গোয়েন্দা",
    "nav.yield": "ফলন ও পরিস্থিতি", "nav.report": "ঋতু রিপোর্ট", "app.title": "AgroSense",
    "app.subtitle": "টেকসই ই-কৃষি প্ল্যাটফর্ম", "select.state": "রাজ্য নির্বাচন করুন", "select.district": "জেলা নির্বাচন করুন",
    "select.crop": "ফসল নির্বাচন করুন", "select.market": "বাজার নির্বাচন করুন", "select.commodity": "পণ্য নির্বাচন করুন",
    "select.month": "মাস নির্বাচন করুন", "select.year": "বছর নির্বাচন করুন", "label.field_size": "জমির আকার (হেক্টর)",
    "label.temp": "তাপমাত্রা", "label.humidity": "আর্দ্রতা", "label.rainfall": "বৃষ্টিপাত", "label.ph": "মাটির পিএইচ",
    "label.n": "নাইট্রোজেন (N)", "label.p": "ফসফরাস (P)", "label.k": "পটাশিয়াম (K)",
    "button.fetch_weather": "লাইভ আবহাওয়া পান", "button.submit": "ডায়াগনস্টিক বিশ্লেষণ চালান", "button.predict_market": "বাজারের মূল্য পূর্বাভাস করুন",
    "button.calculate": "ফলন গণনা করুন", "title.crop_recommendation": "প্রস্তাবিত ফসল এবং কৌশল", "title.alternatives": "বিকল্প ফসল দৃশ্যকল্প",
    "title.yield_forecast": "ফলন এবং উত্পাদনশীলতার পূর্বাভাস", "title.fertilizer_strategy": "নির্ভুল সার প্রোটোকল", "title.nutrient_schedule": "পুষ্টি প্রয়োগের সময়রেখা",
    "title.soil_health": "মাটির স্বাস্থ্যের অবস্থা", "title.financial_forecast": "আর্থিক এবং আরওআই অনুমিতি", "title.pest_disease": "কীটপতঙ্গ ও রোগ বুদ্ধি",
    "title.symptoms_gallery": "লক্ষণ গ্যালারি", "title.urgent_actions": "জরুরী ফসল সুরক্ষা পরিকল্পনা", "title.crop_watchlist": "ফসল স্বাস্থ্য ওয়াচলিস্ট",
    "title.irrigation_management": "স্মार्ट সেচ ও জল ব্যবস্থাপনা", "title.growth_stage": "ফসলের বৃদ্ধির সময়রেখা", "title.weekly_schedule": "সাপ্তাহিক সেচ পরিকল্পনা",
    "title.water_budget": "ঋতুভিত্তিক জল বাজেট", "title.weather_agroclimate": "কৃষি-জলবায়ু ও আবহাওয়া পরামর্শ", "title.forecast_7day": "৭ দিনের আবহাওয়া গ্রিড",
    "title.agro_indices": "কৃষি-জলবায়ু সূচক", "title.crop_recommendations": "ফসল-নির্দিষ্ট আবহাওয়া পরামর্শ", "title.market_prediction": "বাজার দর পূর্বাভাসকারী",
    "title.ai_recommendation": "এআই মান্ডি পরামর্শ", "title.seasonality": "বাজার দর ঋতুভিত্তিক চার্ট", "title.mandi_comparison": "আঞ্চলিক মান্ডি তুলনা",
    "title.yield_scenarios": "ফলন অপ্টিমাইজার এবং অর্থনৈতিক পরিস্থিতি", "title.break_even": "ব্রেক-ইভেন বিশ্লেষণ", "title.economic_scenarios": "অর্থনৈতিক চাহিদা পরিস্থিতি",
    "title.yield_trends": "ফলন কর্মক্ষমতা প্রবণতা", "title.full_report": "সম্পূর্ণ মরসুম কৃষি প্রতিবেদন", "title.season_kpis": "মরসুমের মূল মেট্রিক্স",
    "title.efficiency_rings": "সম্পদ ব্যবহারের দক্ষতা সূচক", "title.risk_timeline": "কালানুক্রমিক মরসুম ঝুঁকি সময়রেখা", "title.profitability_table": "মরসুমের লাভ ও লোকসান খতিয়ান",
    "common.tonnes": "টন", "common.tonnes_per_ha": "টন/হেক্টর", "common.rupees": "₹", "common.per_bag": "প্রতি ৫০ কেজি ব্যাগ",
    "common.per_quintal": "প্রতি কুইন্টাল (১০০ কেজি)", "common.lakhs": "লক্ষ", "status.optimal": "অনুকূল", "status.high": "উচ্চ ঝুঁকি",
    "status.medium": "মাঝারি ঝুঁকি", "status.low": "কম ঝুঁকি", "status.warning": "সতর্কতা", "action.hold": "মজুদ রাখুন (দাম বাড়ছে)",
    "action.sell": "এখনই বিক্রি করুন (দাম শীর্ষে)"
  },
  te: {
  "nav.overview": "వ్యవసాయ అవలోకనం",
  "nav.fertilizer": "ఎరువులు & నేల",
  "nav.pest": "కీటకాలు & వ్యాధులు",
  "nav.irrigation": "నీటి పారుదల",
  "nav.weather": "వాతావరణ సలహాలు",
  "nav.market": "మార్కెట్ విశ్లేషణ",

  "app.title": "AgroSense",
  "app.subtitle": "స్థిరమైన స్మార్ట్ ఈ-వ్యవసాయ వేదిక",

  "select.state": "రాష్ట్రాన్ని ఎంచుకోండి",
  "select.district": "జిల్లాను ఎంచుకోండి",
  "select.crop": "పంటను ఎంచుకోండి",
  "select.market": "మార్కెట్‌ను ఎంచుకోండి",
  "select.commodity": "వస్తువును ఎంచుకోండి",
  "select.month": "నెలను ఎంచుకోండి",
  "select.year": "సంవత్సరాన్ని ఎంచుకోండి",

  "label.field_size": "భూమి విస్తీర్ణం (హెక్టార్లు)",
  "label.temp": "ఉష్ణోగ్రత",
  "label.humidity": "తేమ",
  "label.rainfall": "వర్షపాతం",
  "label.ph": "నేల pH",
  "label.n": "నైట్రోజన్ (N)",
  "label.p": "ఫాస్ఫరస్ (P)",
  "label.k": "పొటాషియం (K)",

  "button.fetch_weather": "ప్రస్తుత వాతావరణాన్ని పొందండి",
  "button.submit": "విశ్లేషణను ప్రారంభించండి",
  "button.predict_market": "మార్కెట్ ధరను అంచనా వేయండి",
  "button.calculate": "దిగుబడిని లెక్కించండి",

  "title.crop_recommendation": "సిఫార్సు చేసిన పంటలు & వ్యూహాలు",
  "title.alternatives": "ప్రత్యామ్నాయ పంటల అవకాశాలు",
  "title.yield_forecast": "దిగుబడి & ఉత్పాదకత అంచనా",
  "title.fertilizer_strategy": "ఎరువుల వినియోగ ప్రణాళిక",
  "title.nutrient_schedule": "పోషక నిర్వహణ షెడ్యూల్",
  "title.soil_health": "నేల ఆరోగ్య స్థితి",
  "title.financial_forecast": "ఆర్థిక & లాభాల అంచనా",

  "title.pest_disease": "కీటకాలు & వ్యాధుల విశ్లేషణ",
  "title.symptoms_gallery": "లక్షణాల గ్యాలరీ",
  "title.urgent_actions": "తక్షణ పంట రక్షణ ప్రణాళిక",
  "title.crop_watchlist": "పంట ఆరోగ్య పర్యవేక్షణ",

  "title.irrigation_management": "స్మార్ట్ నీటి పారుదల నిర్వహణ",
  "title.growth_stage": "పంట ఎదుగుదల దశలు",
  "title.weekly_schedule": "వారపు నీటి పారుదల ప్రణాళిక",
  "title.water_budget": "సీజనల్ నీటి బడ్జెట్",

  "title.weather_agroclimate": "వ్యవసాయ వాతావరణ సలహాలు",
  "title.forecast_7day": "7 రోజుల వాతావరణ అంచనా",
  "title.agro_indices": "వ్యవసాయ వాతావరణ సూచికలు",
  "title.crop_recommendations": "పంటల వారీ వాతావరణ సూచనలు",

  "title.market_prediction": "మార్కెట్ ధర అంచనా",
  "title.ai_recommendation": "AI మార్కెట్ సలహా",
  "title.seasonality": "సీజనల్ మార్కెట్ ధరల చార్ట్",
  "title.mandi_comparison": "ప్రాంతీయ మార్కెట్ పోలిక",

  "title.yield_scenarios": "దిగుబడి మెరుగుదల & ఆర్థిక పరిస్థితులు",
  "title.break_even": "ఖర్చు-లాభ సమతుల్య విశ్లేషణ",
  "title.economic_scenarios": "ఆర్థిక పరిస్థితులు",
  "title.yield_trends": "దిగుబడి ధోరణులు",

  "title.full_report": "పూర్తి సీజన్ వ్యవసాయ నివేదిక",
  "title.season_kpis": "సీజన్ ముఖ్య సూచికలు",
  "title.efficiency_rings": "వనరుల వినియోగ సామర్థ్యం",
  "title.risk_timeline": "సీజనల్ ప్రమాదాల కాలక్రమం",
  "title.profitability_table": "సీజన్ లాభనష్టాల వివరాలు",

  "common.tonnes": "టన్నులు",
  "common.tonnes_per_ha": "టన్నులు/హెక్టారు",
  "common.rupees": "₹",
  "common.per_bag": "50 కిలోల సంచికి",
  "common.per_quintal": "క్వింటాల్‌కు (100 కిలోలు)",
  "common.lakhs": "లక్షలు",

  "status.optimal": "అనుకూలం",
  "status.high": "అధిక ప్రమాదం",
  "status.medium": "మధ్యస్థ ప్రమాదం",
  "status.low": "తక్కువ ప్రమాదం",
  "status.warning": "హెచ్చరిక",

  "action.hold": "నిల్వ ఉంచండి (ధరలు పెరుగుతున్నాయి)",
  "action.sell": "ఇప్పుడే అమ్మండి (ధరలు గరిష్ట స్థాయిలో ఉన్నాయి)"
},
 mr: {
  "nav.overview": "शेतीचा आढावा",
  "nav.fertilizer": "खते व माती",
  "nav.pest": "कीड व रोग",
  "nav.irrigation": "सिंचन व पाणी",
  "nav.weather": "हवामान सल्ला",
  "nav.market": "बाजार विश्लेषण",

  "app.title": "AgroSense",
  "app.subtitle": "शाश्वत स्मार्ट ई-कृषी व्यासपीठ",

  "select.state": "राज्य निवडा",
  "select.district": "जिल्हा निवडा",
  "select.crop": "पीक निवडा",
  "select.market": "बाजार निवडा",
  "select.commodity": "माल निवडा",
  "select.month": "महिना निवडा",
  "select.year": "वर्ष निवडा",

  "label.field_size": "जमिनीचे क्षेत्रफळ (हेक्टर)",
  "label.temp": "तापमान",
  "label.humidity": "आर्द्रता",
  "label.rainfall": "पर्जन्यमान",
  "label.ph": "मातीचा pH",
  "label.n": "नायट्रोजन (N)",
  "label.p": "फॉस्फरस (P)",
  "label.k": "पोटॅशियम (K)",

  "button.fetch_weather": "सध्याचे हवामान मिळवा",
  "button.submit": "विश्लेषण सुरू करा",
  "button.predict_market": "बाजारभावाचा अंदाज घ्या",
  "button.calculate": "उत्पादन मोजा",

  "title.crop_recommendation": "शिफारस केलेली पिके व धोरणे",
  "title.alternatives": "पर्यायी पीक पर्याय",
  "title.yield_forecast": "उत्पादन व उत्पादकतेचा अंदाज",
  "title.fertilizer_strategy": "खत व्यवस्थापन योजना",
  "title.nutrient_schedule": "पोषकद्रव्य वापर वेळापत्रक",
  "title.soil_health": "माती आरोग्य स्थिती",
  "title.financial_forecast": "आर्थिक व नफा अंदाज",

  "title.pest_disease": "कीड व रोग विश्लेषण",
  "title.symptoms_gallery": "लक्षणे गॅलरी",
  "title.urgent_actions": "तातडीची पीक संरक्षण योजना",
  "title.crop_watchlist": "पीक आरोग्य निरीक्षण",

  "title.irrigation_management": "स्मार्ट सिंचन व्यवस्थापन",
  "title.growth_stage": "पिकाची वाढ टप्पे",
  "title.weekly_schedule": "साप्ताहिक सिंचन योजना",
  "title.water_budget": "हंगामी पाणी नियोजन",

  "title.weather_agroclimate": "कृषी हवामान सल्ला",
  "title.forecast_7day": "७ दिवसांचा हवामान अंदाज",
  "title.agro_indices": "कृषी हवामान निर्देशांक",
  "title.crop_recommendations": "पीकनिहाय हवामान सूचना",

  "title.market_prediction": "बाजारभाव अंदाज",
  "title.ai_recommendation": "AI बाजार सल्ला",
  "title.seasonality": "हंगामी बाजारभाव चार्ट",
  "title.mandi_comparison": "प्रादेशिक बाजार तुलना",

  "title.yield_scenarios": "उत्पादन सुधारणा व आर्थिक परिस्थिती",
  "title.break_even": "खर्च-नफा समतोल विश्लेषण",
  "title.economic_scenarios": "आर्थिक परिस्थिती",
  "title.yield_trends": "उत्पादन प्रवृत्ती",

  "title.full_report": "संपूर्ण हंगाम कृषी अहवाल",
  "title.season_kpis": "हंगामातील प्रमुख निर्देशक",
  "title.efficiency_rings": "संसाधन वापर कार्यक्षमता",
  "title.risk_timeline": "हंगामी जोखीम कालरेषा",
  "title.profitability_table": "हंगाम नफा-तोटा तक्ता",

  "common.tonnes": "टन",
  "common.tonnes_per_ha": "टन/हेक्टर",
  "common.rupees": "₹",
  "common.per_bag": "प्रति ५० किलो पिशवी",
  "common.per_quintal": "प्रति क्विंटल (१०० किलो)",
  "common.lakhs": "लाख",

  "status.optimal": "अनुकूल",
  "status.high": "उच्च जोखीम",
  "status.medium": "मध्यम जोखीम",
  "status.low": "कमी जोखीम",
  "status.warning": "इशारा",

  "action.hold": "साठवून ठेवा (भाव वाढत आहेत)",
  "action.sell": "आताच विक्री करा (भाव सर्वोच्च पातळीवर आहेत)"
},
  ta: {
  "nav.overview": "விவசாய கண்ணோட்டம்",
  "nav.fertilizer": "உரம் & மண்",
  "nav.pest": "பூச்சிகள் & நோய்கள்",
  "nav.irrigation": "நீர்ப்பாசனம் & நீர்",
  "nav.weather": "வானிலை ஆலோசனை",
  "nav.market": "சந்தை பகுப்பாய்வு",

  "app.title": "AgroSense",
  "app.subtitle": "நிலையான ஸ்மார்ட் மின்-வேளாண்மை தளம்",

  "select.state": "மாநிலத்தைத் தேர்ந்தெடுக்கவும்",
  "select.district": "மாவட்டத்தைத் தேர்ந்தெடுக்கவும்",
  "select.crop": "பயிரைத் தேர்ந்தெடுக்கவும்",
  "select.market": "சந்தையைத் தேர்ந்தெடுக்கவும்",
  "select.commodity": "பொருளைத் தேர்ந்தெடுக்கவும்",
  "select.month": "மாதத்தைத் தேர்ந்தெடுக்கவும்",
  "select.year": "ஆண்டைத் தேர்ந்தெடுக்கவும்",

  "label.field_size": "நிலப்பரப்பு (ஹெக்டேர்)",
  "label.temp": "வெப்பநிலை",
  "label.humidity": "ஈரப்பதம்",
  "label.rainfall": "மழைப்பொழிவு",
  "label.ph": "மண் pH",
  "label.n": "நைட்ரஜன் (N)",
  "label.p": "பாஸ்பரஸ் (P)",
  "label.k": "பொட்டாசியம் (K)",

  "button.fetch_weather": "நேரடி வானிலையைப் பெறுக",
  "button.submit": "பகுப்பாய்வைத் தொடங்குக",
  "button.predict_market": "சந்தை விலையை முன்னறிவிக்கவும்",
  "button.calculate": "விளைச்சலைக் கணக்கிடுக",

  "title.crop_recommendation": "பரிந்துரைக்கப்பட்ட பயிர்கள் & உத்திகள்",
  "title.alternatives": "மாற்று பயிர் வாய்ப்புகள்",
  "title.yield_forecast": "விளைச்சல் & உற்பத்தித்திறன் முன்னறிவு",
  "title.fertilizer_strategy": "உர மேலாண்மை திட்டம்",
  "title.nutrient_schedule": "ஊட்டச்சத்து பயன்பாட்டு அட்டவணை",
  "title.soil_health": "மண் ஆரோக்கிய நிலை",
  "title.financial_forecast": "நிதி & இலாப முன்னறிவு",

  "title.pest_disease": "பூச்சி & நோய் பகுப்பாய்வு",
  "title.symptoms_gallery": "அறிகுறி காட்சியகம்",
  "title.urgent_actions": "அவசர பயிர் பாதுகாப்புத் திட்டம்",
  "title.crop_watchlist": "பயிர் ஆரோக்கிய கண்காணிப்பு",

  "title.irrigation_management": "ஸ்மார்ட் நீர்ப்பாசன மேலாண்மை",
  "title.growth_stage": "பயிர் வளர்ச்சி நிலைகள்",
  "title.weekly_schedule": "வாராந்திர நீர்ப்பாசன திட்டம்",
  "title.water_budget": "பருவகால நீர் திட்டம்",

  "title.weather_agroclimate": "விவசாய வானிலை ஆலோசனைகள்",
  "title.forecast_7day": "7 நாள் வானிலை முன்னறிவு",
  "title.agro_indices": "விவசாய காலநிலை குறியீடுகள்",
  "title.crop_recommendations": "பயிர் சார்ந்த வானிலை பரிந்துரைகள்",

  "title.market_prediction": "சந்தை விலை முன்னறிவு",
  "title.ai_recommendation": "AI சந்தை ஆலோசனை",
  "title.seasonality": "பருவகால சந்தை விலை வரைபடம்",
  "title.mandi_comparison": "பிராந்திய சந்தை ஒப்பீடு",

  "title.yield_scenarios": "விளைச்சல் மேம்பாடு & பொருளாதார நிலைகள்",
  "title.break_even": "செலவு-இலாப சமநிலை பகுப்பாய்வு",
  "title.economic_scenarios": "பொருளாதார நிலைகள்",
  "title.yield_trends": "விளைச்சல் போக்குகள்",

  "title.full_report": "முழு பருவ விவசாய அறிக்கை",
  "title.season_kpis": "பருவகால முக்கிய குறியீடுகள்",
  "title.efficiency_rings": "வள பயன்பாட்டு திறன்",
  "title.risk_timeline": "பருவகால அபாய காலவரிசை",
  "title.profitability_table": "பருவ இலாப-நஷ்ட விவரம்",

  "common.tonnes": "டன்",
  "common.tonnes_per_ha": "டன்/ஹெக்டேர்",
  "common.rupees": "₹",
  "common.per_bag": "50 கிலோ மூட்டைக்கு",
  "common.per_quintal": "குவிண்டாலுக்கு (100 கிலோ)",
  "common.lakhs": "லட்சம்",

  "status.optimal": "சிறந்தது",
  "status.high": "அதிக அபாயம்",
  "status.medium": "மிதமான அபாயம்",
  "status.low": "குறைந்த அபாயம்",
  "status.warning": "எச்சரிக்கை",

  "action.hold": "இருப்பில் வைத்திருங்கள் (விலை உயர்கிறது)",
  "action.sell": "இப்போதே விற்கவும் (விலை உச்சத்தில் உள்ளது)"
},
  gu: {
  "nav.overview": "ખેતીનો અવલોકન",
  "nav.fertilizer": "ખાતર અને જમીન",
  "nav.pest": "જીવાતો અને રોગો",
  "nav.irrigation": "સિંચાઈ અને પાણી",
  "nav.weather": "હવામાન સલાહ",
  "nav.market": "બજાર વિશ્લેષણ",

  "app.title": "AgroSense",
  "app.subtitle": "ટકાઉ સ્માર્ટ ઈ-કૃષિ પ્લેટફોર્મ",

  "select.state": "રાજ્ય પસંદ કરો",
  "select.district": "જિલ્લો પસંદ કરો",
  "select.crop": "પાક પસંદ કરો",
  "select.market": "બજાર પસંદ કરો",
  "select.commodity": "વસ્તુ પસંદ કરો",
  "select.month": "મહિનો પસંદ કરો",
  "select.year": "વર્ષ પસંદ કરો",

  "label.field_size": "જમીનનું ક્ષેત્રફળ (હેક્ટર)",
  "label.temp": "તાપમાન",
  "label.humidity": "ભેજ",
  "label.rainfall": "વરસાદ",
  "label.ph": "જમીનનો pH",
  "label.n": "નાઈટ્રોજન (N)",
  "label.p": "ફોસ્ફરસ (P)",
  "label.k": "પોટેશિયમ (K)",

  "button.fetch_weather": "વર્તમાન હવામાન મેળવો",
  "button.submit": "વિશ્લેષણ શરૂ કરો",
  "button.predict_market": "બજાર ભાવની આગાહી કરો",
  "button.calculate": "ઉત્પાદન ગણો",

  "title.crop_recommendation": "ભલામણ કરેલા પાક અને વ્યૂહરચનાઓ",
  "title.alternatives": "વૈકલ્પિક પાક વિકલ્પો",
  "title.yield_forecast": "ઉત્પાદન અને ઉત્પાદકતાની આગાહી",
  "title.fertilizer_strategy": "ખાતર વ્યવસ્થાપન યોજના",
  "title.nutrient_schedule": "પોષક તત્વોની સમયસૂચિ",
  "title.soil_health": "જમીનના આરોગ્યની સ્થિતિ",
  "title.financial_forecast": "આર્થિક અને નફાની આગાહી",

  "title.pest_disease": "જીવાત અને રોગ વિશ્લેષણ",
  "title.symptoms_gallery": "લક્ષણ ગેલેરી",
  "title.urgent_actions": "તાત્કાલિક પાક સુરક્ષા યોજના",
  "title.crop_watchlist": "પાક આરોગ્ય દેખરેખ",

  "title.irrigation_management": "સ્માર્ટ સિંચાઈ વ્યવસ્થાપન",
  "title.growth_stage": "પાક વૃદ્ધિના તબક્કાઓ",
  "title.weekly_schedule": "સાપ્તાહિક સિંચાઈ યોજના",
  "title.water_budget": "મોસમી પાણી આયોજન",

  "title.weather_agroclimate": "કૃષિ હવામાન સલાહ",
  "title.forecast_7day": "7 દિવસની હવામાન આગાહી",
  "title.agro_indices": "કૃષિ હવામાન સૂચકાંકો",
  "title.crop_recommendations": "પાક આધારિત હવામાન ભલામણો",

  "title.market_prediction": "બજાર ભાવ આગાહી",
  "title.ai_recommendation": "AI બજાર સલાહ",
  "title.seasonality": "મોસમી બજાર ભાવ ચાર્ટ",
  "title.mandi_comparison": "પ્રાદેશિક બજાર તુલના",

  "title.yield_scenarios": "ઉત્પાદન સુધારણા અને આર્થિક પરિસ્થિતિઓ",
  "title.break_even": "ખર્ચ-નફા સંતુલન વિશ્લેષણ",
  "title.economic_scenarios": "આર્થિક પરિસ્થિતિઓ",
  "title.yield_trends": "ઉત્પાદન પ્રવૃત્તિઓ",

  "title.full_report": "સંપૂર્ણ મોસમી કૃષિ અહેવાલ",
  "title.season_kpis": "મોસમના મુખ્ય સૂચકો",
  "title.efficiency_rings": "સંસાધન ઉપયોગ કાર્યક્ષમતા",
  "title.risk_timeline": "મોસમી જોખમ સમયરેખા",
  "title.profitability_table": "મોસમી નફા-નુકસાન વિગતો",

  "common.tonnes": "ટન",
  "common.tonnes_per_ha": "ટન/હેક્ટર",
  "common.rupees": "₹",
  "common.per_bag": "50 કિગ્રા થેલી દીઠ",
  "common.per_quintal": "પ્રતિ ક્વિન્ટલ (100 કિગ્રા)",
  "common.lakhs": "લાખ",

  "status.optimal": "અનુકૂળ",
  "status.high": "ઉચ્ચ જોખમ",
  "status.medium": "મધ્યમ જોખમ",
  "status.low": "ઓછું જોખમ",
  "status.warning": "ચેતવણી",

  "action.hold": "સંગ્રહમાં રાખો (ભાવ વધી રહ્યા છે)",
  "action.sell": "હમણાં વેચો (ભાવ ઊંચા સ્તરે છે)"
},
  kn: {
  "nav.overview": "ಕೃಷಿ ಅವಲೋಕನ",
  "nav.fertilizer": "ಗೊಬ್ಬರ ಮತ್ತು ಮಣ್ಣು",
  "nav.pest": "ಕೀಟಗಳು ಮತ್ತು ರೋಗಗಳು",
  "nav.irrigation": "ನೀರಾವರಿ ಮತ್ತು ನೀರು",
  "nav.weather": "ಹವಾಮಾನ ಸಲಹೆ",
  "nav.market": "ಮಾರುಕಟ್ಟೆ ವಿಶ್ಲೇಷಣೆ",

  "app.title": "AgroSense",
  "app.subtitle": "ಸುಸ್ಥಿರ ಸ್ಮಾರ್ಟ್ ಇ-ಕೃಷಿ ವೇದಿಕೆ",

  "select.state": "ರಾಜ್ಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
  "select.district": "ಜಿಲ್ಲೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ",
  "select.crop": "ಬೆಳೆ ಆಯ್ಕೆಮಾಡಿ",
  "select.market": "ಮಾರುಕಟ್ಟೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ",
  "select.commodity": "ಉತ್ಪನ್ನವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
  "select.month": "ತಿಂಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ",
  "select.year": "ವರ್ಷವನ್ನು ಆಯ್ಕೆಮಾಡಿ",

  "label.field_size": "ಜಮೀನಿನ ವಿಸ್ತೀರ್ಣ (ಹೆಕ್ಟೇರ್)",
  "label.temp": "ತಾಪಮಾನ",
  "label.humidity": "ಆರ್ದ್ರತೆ",
  "label.rainfall": "ಮಳೆಯ ಪ್ರಮಾಣ",
  "label.ph": "ಮಣ್ಣಿನ pH",
  "label.n": "ನೈಟ್ರೋಜನ್ (N)",
  "label.p": "ಫಾಸ್ಫರಸ್ (P)",
  "label.k": "ಪೊಟ್ಯಾಸಿಯಂ (K)",

  "button.fetch_weather": "ಪ್ರಸ್ತುತ ಹವಾಮಾನ ಪಡೆಯಿರಿ",
  "button.submit": "ವಿಶ್ಲೇಷಣೆ ಪ್ರಾರಂಭಿಸಿ",
  "button.predict_market": "ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಮುನ್ಸೂಚನೆ ಪಡೆಯಿರಿ",
  "button.calculate": "ಇಳುವರಿ ಲೆಕ್ಕಿಸಿ",

  "title.crop_recommendation": "ಶಿಫಾರಸು ಮಾಡಿದ ಬೆಳೆಗಳು ಮತ್ತು ತಂತ್ರಗಳು",
  "title.alternatives": "ಪರ್ಯಾಯ ಬೆಳೆ ಆಯ್ಕೆಗಳು",
  "title.yield_forecast": "ಇಳುವರಿ ಮತ್ತು ಉತ್ಪಾದಕತೆ ಮುನ್ಸೂಚನೆ",
  "title.fertilizer_strategy": "ಗೊಬ್ಬರ ನಿರ್ವಹಣಾ ಯೋಜನೆ",
  "title.nutrient_schedule": "ಪೋಷಕಾಂಶ ಬಳಕೆ ವೇಳಾಪಟ್ಟಿ",
  "title.soil_health": "ಮಣ್ಣಿನ ಆರೋಗ್ಯ ಸ್ಥಿತಿ",
  "title.financial_forecast": "ಆರ್ಥಿಕ ಮತ್ತು ಲಾಭದ ಮುನ್ಸೂಚನೆ",

  "title.pest_disease": "ಕೀಟ ಮತ್ತು ರೋಗ ವಿಶ್ಲೇಷಣೆ",
  "title.symptoms_gallery": "ಲಕ್ಷಣಗಳ ಗ್ಯಾಲರಿ",
  "title.urgent_actions": "ತುರ್ತು ಬೆಳೆ ರಕ್ಷಣಾ ಯೋಜನೆ",
  "title.crop_watchlist": "ಬೆಳೆ ಆರೋಗ್ಯ ಮೇಲ್ವಿಚಾರಣೆ",

  "title.irrigation_management": "ಸ್ಮಾರ್ಟ್ ನೀರಾವರಿ ನಿರ್ವಹಣೆ",
  "title.growth_stage": "ಬೆಳೆ ಬೆಳವಣಿಗೆಯ ಹಂತಗಳು",
  "title.weekly_schedule": "ವಾರದ ನೀರಾವರಿ ಯೋಜನೆ",
  "title.water_budget": "ಋತುಮಾನದ ನೀರಿನ ಯೋಜನೆ",

  "title.weather_agroclimate": "ಕೃಷಿ ಹವಾಮಾನ ಸಲಹೆಗಳು",
  "title.forecast_7day": "7 ದಿನಗಳ ಹವಾಮಾನ ಮುನ್ಸೂಚನೆ",
  "title.agro_indices": "ಕೃಷಿ ಹವಾಮಾನ ಸೂಚ್ಯಂಕಗಳು",
  "title.crop_recommendations": "ಬೆಳೆ ಆಧಾರಿತ ಹವಾಮಾನ ಸಲಹೆಗಳು",

  "title.market_prediction": "ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಮುನ್ಸೂಚನೆ",
  "title.ai_recommendation": "AI ಮಾರುಕಟ್ಟೆ ಸಲಹೆ",
  "title.seasonality": "ಋತುಮಾನಿಕ ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಚಾರ್ಟ್",
  "title.mandi_comparison": "ಪ್ರಾದೇಶಿಕ ಮಾರುಕಟ್ಟೆ ಹೋಲಿಕೆ",

  "title.yield_scenarios": "ಇಳುವರಿ ಸುಧಾರಣೆ ಮತ್ತು ಆರ್ಥಿಕ ಪರಿಸ್ಥಿತಿಗಳು",
  "title.break_even": "ವೆಚ್ಚ-ಲಾಭ ಸಮತೋಲನ ವಿಶ್ಲೇಷಣೆ",
  "title.economic_scenarios": "ಆರ್ಥಿಕ ಪರಿಸ್ಥಿತಿಗಳು",
  "title.yield_trends": "ಇಳುವರಿ ಪ್ರವೃತ್ತಿಗಳು",

  "title.full_report": "ಸಂಪೂರ್ಣ ಋತುಮಾನದ ಕೃಷಿ ವರದಿ",
  "title.season_kpis": "ಋತುಮಾನದ ಪ್ರಮುಖ ಸೂಚಕಗಳು",
  "title.efficiency_rings": "ಸಂಪನ್ಮೂಲ ಬಳಕೆ ದಕ್ಷತೆ",
  "title.risk_timeline": "ಋತುಮಾನದ ಅಪಾಯ ಕಾಲರೇಖೆ",
  "title.profitability_table": "ಋತುಮಾನದ ಲಾಭ-ನಷ್ಟ ವಿವರ",

  "common.tonnes": "ಟನ್",
  "common.tonnes_per_ha": "ಟನ್/ಹೆಕ್ಟೇರ್",
  "common.rupees": "₹",
  "common.per_bag": "50 ಕೆಜಿ ಚೀಲಕ್ಕೆ",
  "common.per_quintal": "ಪ್ರತಿ ಕ್ವಿಂಟಲ್ (100 ಕೆಜಿ)",
  "common.lakhs": "ಲಕ್ಷ",

  "status.optimal": "ಅನುಕೂಲಕರ",
  "status.high": "ಹೆಚ್ಚಿನ ಅಪಾಯ",
  "status.medium": "ಮಧ್ಯಮ ಅಪಾಯ",
  "status.low": "ಕಡಿಮೆ ಅಪಾಯ",
  "status.warning": "ಎಚ್ಚರಿಕೆ",

  "action.hold": "ಸಂಗ್ರಹಿಸಿ ಇಡಿ (ಬೆಲೆ ಏರುತ್ತಿದೆ)",
  "action.sell": "ಈಗಲೇ ಮಾರಾಟ ಮಾಡಿ (ಬೆಲೆ ಗರಿಷ್ಠ ಮಟ್ಟದಲ್ಲಿದೆ)"
},
  ml: {
  "nav.overview": "കൃഷി അവലോകനം",
  "nav.fertilizer": "വളവും മണ്ണും",
  "nav.pest": "കീടങ്ങളും രോഗങ്ങളും",
  "nav.irrigation": "ജലസേചനവും ജലനിർവഹണവും",
  "nav.weather": "കാലാവസ്ഥാ ഉപദേശം",
  "nav.market": "വിപണി വിശകലനം",

  "app.title": "AgroSense",
  "app.subtitle": "സുസ്ഥിര സ്മാർട്ട് ഇ-കൃഷി പ്ലാറ്റ്ഫോം",

  "select.state": "സംസ്ഥാനം തിരഞ്ഞെടുക്കുക",
  "select.district": "ജില്ല തിരഞ്ഞെടുക്കുക",
  "select.crop": "വിള തിരഞ്ഞെടുക്കുക",
  "select.market": "വിപണി തിരഞ്ഞെടുക്കുക",
  "select.commodity": "ഉൽപ്പന്നം തിരഞ്ഞെടുക്കുക",
  "select.month": "മാസം തിരഞ്ഞെടുക്കുക",
  "select.year": "വർഷം തിരഞ്ഞെടുക്കുക",

  "label.field_size": "ഭൂവിസ്തീർണം (ഹെക്ടർ)",
  "label.temp": "താപനില",
  "label.humidity": "ആർദ്രത",
  "label.rainfall": "മഴയുടെ അളവ്",
  "label.ph": "മണ്ണിന്റെ pH",
  "label.n": "നൈട്രജൻ (N)",
  "label.p": "ഫോസ്ഫറസ് (P)",
  "label.k": "പൊട്ടാസ്യം (K)",

  "button.fetch_weather": "നിലവിലെ കാലാവസ്ഥ ലഭ്യമാക്കുക",
  "button.submit": "വിശകലനം ആരംഭിക്കുക",
  "button.predict_market": "വിപണി വില പ്രവചിക്കുക",
  "button.calculate": "വിളവ് കണക്കാക്കുക",

  "title.crop_recommendation": "ശുപാർശ ചെയ്യുന്ന വിളകളും തന്ത്രങ്ങളും",
  "title.alternatives": "ബദൽ വിള സാധ്യതകൾ",
  "title.yield_forecast": "വിളവും ഉൽപാദനക്ഷമതയും പ്രവചനം",
  "title.fertilizer_strategy": "വള പ്രയോഗ പദ്ധതി",
  "title.nutrient_schedule": "പോഷക പ്രയോഗ സമയക്രമം",
  "title.soil_health": "മണ്ണിന്റെ ആരോഗ്യനില",
  "title.financial_forecast": "സാമ്പത്തികവും ലാഭവും പ്രവചനം",

  "title.pest_disease": "കീട-രോഗ വിശകലനം",
  "title.symptoms_gallery": "ലക്ഷണ ഗാലറി",
  "title.urgent_actions": "അടിയന്തര വിള സംരക്ഷണ പദ്ധതി",
  "title.crop_watchlist": "വിള ആരോഗ്യ നിരീക്ഷണം",

  "title.irrigation_management": "സ്മാർട്ട് ജലസേചന മാനേജ്മെന്റ്",
  "title.growth_stage": "വിള വളർച്ചാ ഘട്ടങ്ങൾ",
  "title.weekly_schedule": "ആഴ്ച്ചതോറുമുള്ള ജലസേചന പദ്ധതി",
  "title.water_budget": "കാലാവസ്ഥാനുസൃത ജല പദ്ധതി",

  "title.weather_agroclimate": "കാർഷിക കാലാവസ്ഥാ ഉപദേശങ്ങൾ",
  "title.forecast_7day": "7 ദിവസത്തെ കാലാവസ്ഥ പ്രവചനം",
  "title.agro_indices": "കാർഷിക കാലാവസ്ഥാ സൂചികകൾ",
  "title.crop_recommendations": "വിള അടിസ്ഥാനത്തിലുള്ള കാലാവസ്ഥ നിർദേശങ്ങൾ",

  "title.market_prediction": "വിപണി വില പ്രവചനം",
  "title.ai_recommendation": "AI വിപണി ഉപദേശം",
  "title.seasonality": "കാലാവസ്ഥാനുസൃത വിപണി വില ചാർട്ട്",
  "title.mandi_comparison": "പ്രാദേശിക വിപണി താരതമ്യം",

  "title.yield_scenarios": "വിളവ് മെച്ചപ്പെടുത്തലും സാമ്പത്തിക സാഹചര്യങ്ങളും",
  "title.break_even": "ചെലവ്-ലാഭ സമതുലിത വിശകലനം",
  "title.economic_scenarios": "സാമ്പത്തിക സാഹചര്യങ്ങൾ",
  "title.yield_trends": "വിളവ് പ്രവണതകൾ",

  "title.full_report": "സമ്പൂർണ്ണ സീസൺ കാർഷിക റിപ്പോർട്ട്",
  "title.season_kpis": "സീസണിലെ പ്രധാന സൂചികകൾ",
  "title.efficiency_rings": "വിഭവ ഉപയോഗ കാര്യക്ഷമത",
  "title.risk_timeline": "സീസണൽ അപകടസാധ്യതാ സമയരേഖ",
  "title.profitability_table": "സീസണിലെ ലാഭ-നഷ്ട വിവരങ്ങൾ",

  "common.tonnes": "ടൺ",
  "common.tonnes_per_ha": "ടൺ/ഹെക്ടർ",
  "common.rupees": "₹",
  "common.per_bag": "50 കിലോ ചാക്കിന്",
  "common.per_quintal": "ക്വിന്റലിന് (100 കിലോ)",
  "common.lakhs": "ലക്ഷം",

  "status.optimal": "അനുകൂലം",
  "status.high": "ഉയർന്ന അപകടസാധ്യത",
  "status.medium": "ഇടത്തരം അപകടസാധ്യത",
  "status.low": "കുറഞ്ഞ അപകടസാധ്യത",
  "status.warning": "മുന്നറിയിപ്പ്",

  "action.hold": "സംഭരിച്ച് വയ്ക്കുക (വില ഉയരുന്നു)",
  "action.sell": "ഇപ്പോൾ തന്നെ വിൽക്കുക (വില ഉയർന്ന നിലയിലാണ്)"
},
  pa: {
  "nav.overview": "ਖੇਤੀਬਾੜੀ ਦਾ ਸੰਖੇਪ ਜਾਇਜ਼ਾ",
  "nav.fertilizer": "ਖਾਦ ਅਤੇ ਮਿੱਟੀ",
  "nav.pest": "ਕੀੜੇ ਅਤੇ ਬਿਮਾਰੀਆਂ",
  "nav.irrigation": "ਸਿੰਚਾਈ ਅਤੇ ਪਾਣੀ",
  "nav.weather": "ਮੌਸਮ ਸਲਾਹ",
  "nav.market": "ਮੰਡੀ ਵਿਸ਼ਲੇਸ਼ਣ",

  "app.title": "AgroSense",
  "app.subtitle": "ਟਿਕਾਊ ਸਮਾਰਟ ਈ-ਖੇਤੀਬਾੜੀ ਪਲੇਟਫਾਰਮ",

  "select.state": "ਰਾਜ ਚੁਣੋ",
  "select.district": "ਜ਼ਿਲ੍ਹਾ ਚੁਣੋ",
  "select.crop": "ਫਸਲ ਚੁਣੋ",
  "select.market": "ਮੰਡੀ ਚੁਣੋ",
  "select.commodity": "ਵਸਤੂ ਚੁਣੋ",
  "select.month": "ਮਹੀਨਾ ਚੁਣੋ",
  "select.year": "ਸਾਲ ਚੁਣੋ",

  "label.field_size": "ਜ਼ਮੀਨ ਦਾ ਖੇਤਰਫਲ (ਹੈਕਟੇਅਰ)",
  "label.temp": "ਤਾਪਮਾਨ",
  "label.humidity": "ਨਮੀ",
  "label.rainfall": "ਵਰਖਾ",
  "label.ph": "ਮਿੱਟੀ ਦਾ pH",
  "label.n": "ਨਾਈਟ੍ਰੋਜਨ (N)",
  "label.p": "ਫਾਸਫੋਰਸ (P)",
  "label.k": "ਪੋਟਾਸ਼ੀਅਮ (K)",

  "button.fetch_weather": "ਮੌਜੂਦਾ ਮੌਸਮ ਪ੍ਰਾਪਤ ਕਰੋ",
  "button.submit": "ਵਿਸ਼ਲੇਸ਼ਣ ਸ਼ੁਰੂ ਕਰੋ",
  "button.predict_market": "ਮੰਡੀ ਭਾਅ ਦੀ ਭਵਿੱਖਬਾਣੀ ਕਰੋ",
  "button.calculate": "ਪੈਦਾਵਾਰ ਦੀ ਗਿਣਤੀ ਕਰੋ",

  "title.crop_recommendation": "ਸਿਫ਼ਾਰਸ਼ ਕੀਤੀਆਂ ਫਸਲਾਂ ਅਤੇ ਰਣਨੀਤੀਆਂ",
  "title.alternatives": "ਵਿਕਲਪਕ ਫਸਲ ਵਿਕਲਪ",
  "title.yield_forecast": "ਪੈਦਾਵਾਰ ਅਤੇ ਉਤਪਾਦਕਤਾ ਦੀ ਭਵਿੱਖਬਾਣੀ",
  "title.fertilizer_strategy": "ਖਾਦ ਪ੍ਰਬੰਧਨ ਯੋਜਨਾ",
  "title.nutrient_schedule": "ਪੋਸ਼ਕ ਤੱਤ ਵਰਤੋਂ ਸਮਾਂ-ਸੂਚੀ",
  "title.soil_health": "ਮਿੱਟੀ ਦੀ ਸਿਹਤ ਸਥਿਤੀ",
  "title.financial_forecast": "ਵਿੱਤੀ ਅਤੇ ਲਾਭ ਦੀ ਭਵਿੱਖਬਾਣੀ",

  "title.pest_disease": "ਕੀੜੇ ਅਤੇ ਬਿਮਾਰੀ ਵਿਸ਼ਲੇਸ਼ਣ",
  "title.symptoms_gallery": "ਲੱਛਣ ਗੈਲਰੀ",
  "title.urgent_actions": "ਤੁਰੰਤ ਫਸਲ ਸੁਰੱਖਿਆ ਯੋਜਨਾ",
  "title.crop_watchlist": "ਫਸਲ ਸਿਹਤ ਨਿਗਰਾਨੀ",

  "title.irrigation_management": "ਸਮਾਰਟ ਸਿੰਚਾਈ ਪ੍ਰਬੰਧਨ",
  "title.growth_stage": "ਫਸਲ ਵਿਕਾਸ ਪੜਾਅ",
  "title.weekly_schedule": "ਹਫ਼ਤਾਵਾਰੀ ਸਿੰਚਾਈ ਯੋਜਨਾ",
  "title.water_budget": "ਮੌਸਮੀ ਪਾਣੀ ਯੋਜਨਾ",

  "title.weather_agroclimate": "ਖੇਤੀਬਾੜੀ ਮੌਸਮ ਸਲਾਹ",
  "title.forecast_7day": "7 ਦਿਨਾਂ ਦਾ ਮੌਸਮ ਅਨੁਮਾਨ",
  "title.agro_indices": "ਖੇਤੀਬਾੜੀ ਮੌਸਮੀ ਸੂਚਕ",
  "title.crop_recommendations": "ਫਸਲ ਅਧਾਰਿਤ ਮੌਸਮ ਸਿਫ਼ਾਰਸ਼ਾਂ",

  "title.market_prediction": "ਮੰਡੀ ਭਾਅ ਭਵਿੱਖਬਾਣੀ",
  "title.ai_recommendation": "AI ਮੰਡੀ ਸਲਾਹ",
  "title.seasonality": "ਮੌਸਮੀ ਮੰਡੀ ਭਾਅ ਚਾਰਟ",
  "title.mandi_comparison": "ਖੇਤਰੀ ਮੰਡੀ ਤੁਲਨਾ",

  "title.yield_scenarios": "ਪੈਦਾਵਾਰ ਸੁਧਾਰ ਅਤੇ ਆਰਥਿਕ ਸਥਿਤੀਆਂ",
  "title.break_even": "ਲਾਗਤ-ਲਾਭ ਸੰਤੁਲਨ ਵਿਸ਼ਲੇਸ਼ਣ",
  "title.economic_scenarios": "ਆਰਥਿਕ ਸਥਿਤੀਆਂ",
  "title.yield_trends": "ਪੈਦਾਵਾਰ ਰੁਝਾਨ",

  "title.full_report": "ਪੂਰੀ ਮੌਸਮੀ ਖੇਤੀਬਾੜੀ ਰਿਪੋਰਟ",
  "title.season_kpis": "ਮੌਸਮ ਦੇ ਮੁੱਖ ਸੂਚਕ",
  "title.efficiency_rings": "ਸਰੋਤ ਵਰਤੋਂ ਕੁਸ਼ਲਤਾ",
  "title.risk_timeline": "ਮੌਸਮੀ ਜੋਖਮ ਸਮਾਂ-ਰੇਖਾ",
  "title.profitability_table": "ਮੌਸਮੀ ਲਾਭ-ਨੁਕਸਾਨ ਵੇਰਵਾ",

  "common.tonnes": "ਟਨ",
  "common.tonnes_per_ha": "ਟਨ/ਹੈਕਟੇਅਰ",
  "common.rupees": "₹",
  "common.per_bag": "ਪ੍ਰਤੀ 50 ਕਿਲੋ ਬੋਰੀ",
  "common.per_quintal": "ਪ੍ਰਤੀ ਕੁਇੰਟਲ (100 ਕਿਲੋ)",
  "common.lakhs": "ਲੱਖ",

  "status.optimal": "ਅਨੁਕੂਲ",
  "status.high": "ਉੱਚ ਜੋਖਮ",
  "status.medium": "ਦਰਮਿਆਨਾ ਜੋਖਮ",
  "status.low": "ਘੱਟ ਜੋਖਮ",
  "status.warning": "ਚੇਤਾਵਨੀ",

  "action.hold": "ਸਟੋਰ ਕਰਕੇ ਰੱਖੋ (ਭਾਅ ਵੱਧ ਰਹੇ ਹਨ)",
  "action.sell": "ਹੁਣੇ ਵੇਚੋ (ਭਾਅ ਉੱਚ ਪੱਧਰ 'ਤੇ ਹਨ)"
},
  or: {
  "nav.overview": "କୃଷି ସମୀକ୍ଷା",
  "nav.fertilizer": "ସାର ଓ ମାଟି",
  "nav.pest": "କୀଟ ଓ ରୋଗ",
  "nav.irrigation": "ଜଳସେଚନ ଓ ଜଳ ପରିଚାଳନା",
  "nav.weather": "ପାଣିପାଗ ପରାମର୍ଶ",
  "nav.market": "ବଜାର ବିଶ୍ଳେଷଣ",

  "app.title": "AgroSense",
  "app.subtitle": "ସ୍ଥାୟୀ ସ୍ମାର୍ଟ ଇ-କୃଷି ପ୍ଲାଟଫର୍ମ",

  "select.state": "ରାଜ୍ୟ ଚୟନ କରନ୍ତୁ",
  "select.district": "ଜିଲ୍ଲା ଚୟନ କରନ୍ତୁ",
  "select.crop": "ଫସଲ ଚୟନ କରନ୍ତୁ",
  "select.market": "ବଜାର ଚୟନ କରନ୍ତୁ",
  "select.commodity": "ପଣ୍ୟ ଚୟନ କରନ୍ତୁ",
  "select.month": "ମାସ ଚୟନ କରନ୍ତୁ",
  "select.year": "ବର୍ଷ ଚୟନ କରନ୍ତୁ",

  "label.field_size": "ଜମିର କ୍ଷେତ୍ରଫଳ (ହେକ୍ଟର)",
  "label.temp": "ତାପମାତ୍ରା",
  "label.humidity": "ଆର୍ଦ୍ରତା",
  "label.rainfall": "ବର୍ଷାପାତ",
  "label.ph": "ମାଟିର pH",
  "label.n": "ନାଇଟ୍ରୋଜେନ (N)",
  "label.p": "ଫସଫରସ୍ (P)",
  "label.k": "ପଟାସିୟମ୍ (K)",

  "button.fetch_weather": "ବର୍ତ୍ତମାନ ପାଣିପାଗ ପାଆନ୍ତୁ",
  "button.submit": "ବିଶ୍ଳେଷଣ ଆରମ୍ଭ କରନ୍ତୁ",
  "button.predict_market": "ବଜାର ଦର ପୂର୍ବାନୁମାନ କରନ୍ତୁ",
  "button.calculate": "ଉତ୍ପାଦନ ଗଣନା କରନ୍ତୁ",

  "title.crop_recommendation": "ସୁପାରିଶ କୃତ ଫସଲ ଓ କୌଶଳ",
  "title.alternatives": "ବିକଳ୍ପ ଫସଲ ସମ୍ଭାବନା",
  "title.yield_forecast": "ଉତ୍ପାଦନ ଓ ଉତ୍ପାଦକତା ପୂର୍ବାନୁମାନ",
  "title.fertilizer_strategy": "ସାର ପରିଚାଳନା ଯୋଜନା",
  "title.nutrient_schedule": "ପୋଷକ ତତ୍ତ୍ୱ ବ୍ୟବହାର ସମୟସୂଚୀ",
  "title.soil_health": "ମାଟିର ସ୍ୱାସ୍ଥ୍ୟ ଅବସ୍ଥା",
  "title.financial_forecast": "ଆର୍ଥିକ ଓ ଲାଭ ପୂର୍ବାନୁମାନ",

  "title.pest_disease": "କୀଟ ଓ ରୋଗ ବିଶ୍ଳେଷଣ",
  "title.symptoms_gallery": "ଲକ୍ଷଣ ଗ୍ୟାଲେରୀ",
  "title.urgent_actions": "ତୁରନ୍ତ ଫସଲ ସୁରକ୍ଷା ଯୋଜନା",
  "title.crop_watchlist": "ଫସଲ ସ୍ୱାସ୍ଥ୍ୟ ନିରୀକ୍ଷଣ",

  "title.irrigation_management": "ସ୍ମାର୍ଟ ଜଳସେଚନ ପରିଚାଳନା",
  "title.growth_stage": "ଫସଲ ବୃଦ୍ଧି ପର୍ଯ୍ୟାୟ",
  "title.weekly_schedule": "ସାପ୍ତାହିକ ଜଳସେଚନ ଯୋଜନା",
  "title.water_budget": "ଋତୁକାଳୀନ ଜଳ ଯୋଜନା",

  "title.weather_agroclimate": "କୃଷି ପାଣିପାଗ ପରାମର୍ଶ",
  "title.forecast_7day": "୭ ଦିନର ପାଣିପାଗ ପୂର୍ବାନୁମାନ",
  "title.agro_indices": "କୃଷି ପାଣିପାଗ ସୂଚକ",
  "title.crop_recommendations": "ଫସଲ ଭିତ୍ତିକ ପାଣିପାଗ ପରାମର୍ଶ",

  "title.market_prediction": "ବଜାର ଦର ପୂର୍ବାନୁମାନ",
  "title.ai_recommendation": "AI ବଜାର ପରାମର୍ଶ",
  "title.seasonality": "ଋତୁକାଳୀନ ବଜାର ଦର ଚାର୍ଟ",
  "title.mandi_comparison": "ଆଞ୍ଚଳିକ ବଜାର ତୁଳନା",

  "title.yield_scenarios": "ଉତ୍ପାଦନ ଉନ୍ନତି ଓ ଆର୍ଥିକ ପରିସ୍ଥିତି",
  "title.break_even": "ଖର୍ଚ୍ଚ-ଲାଭ ସମତୁଳନ ବିଶ୍ଳେଷଣ",
  "title.economic_scenarios": "ଆର୍ଥିକ ପରିସ୍ଥିତି",
  "title.yield_trends": "ଉତ୍ପାଦନ ପ୍ରବୃତ୍ତି",

  "title.full_report": "ସମ୍ପୂର୍ଣ୍ଣ ଋତୁକାଳୀନ କୃଷି ରିପୋର୍ଟ",
  "title.season_kpis": "ଋତୁର ମୁଖ୍ୟ ସୂଚକ",
  "title.efficiency_rings": "ସମ୍ପଦ ବ୍ୟବହାର କ୍ଷମତା",
  "title.risk_timeline": "ଋତୁକାଳୀନ ବିପଦ ସମୟରେଖା",
  "title.profitability_table": "ଋତୁକାଳୀନ ଲାଭ-କ୍ଷତି ବିବରଣୀ",

  "common.tonnes": "ଟନ",
  "common.tonnes_per_ha": "ଟନ/ହେକ୍ଟର",
  "common.rupees": "₹",
  "common.per_bag": "ପ୍ରତି ୫୦ କେଜି ବ୍ୟାଗ",
  "common.per_quintal": "ପ୍ରତି କ୍ୱିଣ୍ଟାଲ (୧୦୦ କେଜି)",
  "common.lakhs": "ଲକ୍ଷ",

  "status.optimal": "ଅନୁକୂଳ",
  "status.high": "ଉଚ୍ଚ ବିପଦ",
  "status.medium": "ମଧ୍ୟମ ବିପଦ",
  "status.low": "କମ୍ ବିପଦ",
  "status.warning": "ସତର୍କତା",

  "action.hold": "ମଜୁତ ରଖନ୍ତୁ (ଦର ବଢ଼ୁଛି)",
  "action.sell": "ଏବେ ବିକ୍ରି କରନ୍ତୁ (ଦର ସର୍ବାଧିକ ସ୍ତରରେ ଅଛି)"
}
};

// Fill in other translation fallbacks dynamically
Object.keys(TRANSLATIONS).forEach(lang => {
  if (lang !== 'en') {
    TRANSLATIONS[lang] = { ...TRANSLATIONS.en, ...TRANSLATIONS[lang] };
  }
});

// ==========================================
// 2. STATE CONTEXTS PROVIDERS
// ==========================================
const AppContext = createContext(null);
const LanguageContext = createContext(null);
const CROP_DEFAULTS = {
  rice: { N: 80, P: 40, K: 40, ph: 6.5 },
  maize: { N: 90, P: 50, K: 40, ph: 6.0 },
  chickpea: { N: 40, P: 60, K: 20, ph: 7.0 },
  kidneybeans: { N: 20, P: 60, K: 20, ph: 5.8 },
  pigeonpeas: { N: 20, P: 60, K: 20, ph: 6.5 },
  mothbeans: { N: 20, P: 40, K: 20, ph: 6.8 },
  mungbean: { N: 20, P: 40, K: 20, ph: 6.5 },
  blackgram: { N: 40, P: 60, K: 20, ph: 7.0 },
  lentil: { N: 20, P: 60, K: 20, ph: 6.5 },
  pomegranate: { N: 20, P: 10, K: 40, ph: 6.5 },
  banana: { N: 100, P: 75, K: 50, ph: 6.0 },
  mango: { N: 20, P: 20, K: 30, ph: 5.5 },
  grapes: { N: 20, P: 120, K: 200, ph: 6.0 },
  watermelon: { N: 100, P: 10, K: 50, ph: 6.5 },
  muskmelon: { N: 100, P: 10, K: 50, ph: 6.5 },
  apple: { N: 20, P: 120, K: 200, ph: 6.0 },
  orange: { N: 20, P: 10, K: 10, ph: 7.0 },
  papaya: { N: 50, P: 50, K: 50, ph: 6.5 },
  coconut: { N: 20, P: 10, K: 30, ph: 6.0 },
  cotton: { N: 120, P: 40, K: 20, ph: 7.0 },
  jute: { N: 80, P: 40, K: 40, ph: 7.0 },
  coffee:{ N: 100, P: 20,  K: 30,  ph: 6.5 },
};

const DEFAULT_WEATHER = { temperature: 28, humidity: 70, rainfall: 1050, ph: 6.5 };
const APP_DISTRICT_ALIASES = {
  'kasargod': 'Kasaragod', 'kasargode': 'Kasaragod',
  'palakad': 'Palakkad', 'palghat': 'Palakkad',
  'thrissur': 'Thrissur', 'trichur': 'Thrissur',
  'trivandrum': 'Thiruvananthapuram',
  'calicut': 'Kozhikode', 'cochin': 'Ernakulam',
  'cannanore': 'Kannur',
  'puruliya': 'Purulia',
  'paschim bardhaman': 'Asansol',
  'purba bardhaman': 'Burdwan',
  'north 24 parganas': 'Barasat',
  'south 24 parganas': 'Diamond Harbour',
  'paschim medinipur': 'Medinipur',
  'purba medinipur': 'Haldia',
  'dakshin dinajpur': 'Balurghat',
  'uttar dinajpur': 'Raiganj',
  'kanyakumari': 'Kanyakumari', 'kanniyakumari': 'Kanyakumari',
  'nilgiris': 'Ooty', 'the nilgiris': 'Ooty',
  'tiruvallur': 'Tiruvallur', 'thiruvallur': 'Tiruvallur',
  'tiruvarur': 'Tiruvarur', 'thiruvarur': 'Tiruvarur',
  'balasore': 'Balasore', 'baleshwar': 'Balasore',
  'angul': 'Angul', 'anugul': 'Angul',
  'jagatsinghpur': 'Jagatsinghpur', 'jagatsinghapur': 'Jagatsinghpur',
  'jajpur': 'Jajpur', 'jajapur': 'Jajpur',
  'subarnapur': 'Sonepur',
  'visakhapatnam': 'Visakhapatnam', 'vizag': 'Visakhapatnam',
  'hanamkonda': 'Warangal',
  'yadadri bhuvanagiri': 'Bhongir',
  'bhadradri kothagudem': 'Kothagudem',
  'komaram bheem asifabad': 'Asifabad',
  'rajanna sircilla': 'Sircilla',
  'jayashankar bhupalpally': 'Bhupalpally',
  'jogulamba gadwal': 'Gadwal',
  'medchal-malkajgiri': 'Medchal',
  'bengaluru urban': 'Bangalore', 'bengaluru rural': 'Bangalore',
  'bengaluru': 'Bangalore',
  'davanagere': 'Davangere',
  'vijayanagara': 'Hosapete',
  'ahmedabad': 'Ahmedabad',
  'banaskantha': 'Palanpur',
  'chhota udaipur': 'Chhota Udaipur',
  'devbhoomi dwarka': 'Dwarka', 'devbhumi dwarka': 'Dwarka',
  'kutch': 'Bhuj', 'kachchh': 'Bhuj',
  'mehsana': 'Mehsana', 'mahesana': 'Mehsana',
  'panchmahal': 'Godhra', 'panch mahals': 'Godhra',
  'sabarkantha': 'Himmatnagar',
  'ganganagar': 'Sri Ganganagar', 'sriganganagar': 'Sri Ganganagar',
  'prayagraj': 'Prayagraj', 'allahabad': 'Prayagraj',
  'ayodhya': 'Ayodhya', 'faizabad': 'Ayodhya',
  'narmadapuram': 'Hoshangabad',
  'lahaul and spiti': 'Kaza', 'lahul and spiti': 'Kaza',
  'rudraprayag': 'Rudraprayag', 'rudra prayag': 'Rudraprayag',
  'udham singh nagar': 'Rudrapur', 'udam singh nagar': 'Rudrapur',
  'uttarkashi': 'Uttarkashi', 'uttar kashi': 'Uttarkashi',
  'mohali': 'Mohali', 's.a.s nagar': 'Mohali',
  'ferozepur': 'Ferozepur', 'firozpur': 'Ferozepur',
  'osmanabad': 'Osmanabad', 'dharashiv': 'Osmanabad',
  'mumbai city': 'Mumbai', 'mumbai suburban': 'Mumbai',
  'kamrup metropolitan': 'Guwahati',
  'charaideo': 'Sibsagar',
  'biswanath': 'Biswanath Chariali',
  'majuli': 'Jorhat',
  'east champaran': 'Motihari', 'west champaran': 'Bettiah',
  'kaimur': 'Bhabua',
  'saraikela-kharsawan': 'Saraikela', 'saraikela kharsawan': 'Saraikela',
  'east singhbhum': 'Jamshedpur', 'west singhbhum': 'Chaibasa',
  'gurugram': 'Gurgaon',
  'gyalshing': 'Gyalshing', 'pakyong': 'Pakyong', 'soreng': 'Jorethang',
  'pakke-kessang': 'Pakke Kessang', 'pakke kessang': 'Pakke Kessang',
  'south salmara-mankachar': 'Mankachar',
  'west karbi anglong': 'Hamren',
  'eastern west khasi hills': 'Nongstoin',
  'hnahthial': 'Lunglei', 'khawzawl': 'Champhai', 'saitual': 'Aizawl',
  'chumoukedima': 'Dimapur', 'niuland': 'Dimapur',
  'tseminyu': 'Kohima', 'noklak': 'Tuensang', 'shamator': 'Tuensang',
  'jiribam': 'Jiribam', 'kakching': 'Imphal',
  'kangpokpi': 'Senapati', 'noney': 'Tamenglong',
  'pherzawl': 'Churachandpur', 'tengnoupal': 'Moreh',
};
 
function appNormalizeDistrict(name) {
  if (!name) return name;
  return APP_DISTRICT_ALIASES[name.toLowerCase().trim()] || name.trim();
}
 
/**
 * Geocode a district for AppProvider weather auto-fetch.
 * Returns { latitude, longitude } or null.
 * signal — AbortSignal from the district-change effect.
 */
async function appGeocodeDistrict(districtName, stateName, signal) {
  const canonical = appNormalizeDistrict(districtName);
  const queries = [
    stateName ? `${canonical}, ${stateName}, India` : `${canonical}, India`,
    `${canonical}, India`,
    `${districtName}, India`,
    ...(stateName ? [`${stateName}, India`] : []),
  ];
 
  const seen = new Set();
  for (const q of queries) {
    const k = q.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`,
        { signal }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.results?.length) continue;
      const indian = data.results.find(r => r.country_code === 'IN');
      if (indian) return { latitude: indian.latitude, longitude: indian.longitude };
      const first = data.results[0];
      return { latitude: first.latitude, longitude: first.longitude };
    } catch (e) {
      if (e.name === 'AbortError') throw e;
    }
  }
  return null;
}

function districtSoilParams(lat, lon, cropDefaults) {
  // Use sub-degree fractional part as a repeatable per-district seed
  // that still varies smoothly across geography
  const latFrac = ((lat * 100) % 100 + 100) % 100;   // 0–100
  const lonFrac = ((lon * 100) % 100 + 100) % 100;   // 0–100
  const combined = latFrac * 0.6 + lonFrac * 0.4;     // 0–100
 
  // N: Indo-Gangetic plain (lat 22–30) has higher N from alluvial deposits
  const latNBonus = Math.max(-20, Math.min(20, (lat - 20) * 1.5));
  const nVar = Math.round(combined * 0.4 - 20 + latNBonus);
 
  // P: higher longitude (east coast) → more rainfall leaching → lower P
  const lonPPenalty = Math.max(-15, Math.min(15, (lon - 78) * 0.8));
  const pVar = Math.round(combined * 0.3 - 15 + lonPPenalty);
 
  // K: alluvial floodplains of Ganga-Brahmaputra
  const isAlluvial = (lat > 20 && lat < 28 && lon > 75 && lon < 92) ? 10 : 0;
  const kVar = Math.round(combined * 0.25 - 12 + isAlluvial);
 
  return {
    N: Math.max(10, Math.min(200, (cropDefaults.N || 80) + nVar)),
    P: Math.max(5,  Math.min(150, (cropDefaults.P || 40) + pVar)),
    K: Math.max(5,  Math.min(150, (cropDefaults.K || 40) + kVar)),
  };
}
function loadState(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch { return fallback; }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => loadState('agro_lang', 'en'));
  const [translations, setTranslations] = useState(TRANSLATIONS[language] || TRANSLATIONS.en);

  useEffect(() => {
    setTranslations(TRANSLATIONS[language] || TRANSLATIONS.en);
    localStorage.setItem('agro_lang', language);
  }, [language]);

  const t = useCallback((key, fallback) => {
    return translations[key] || fallback || key;
  }, [translations]);

  const LANGUAGES = [
    { code: 'en', native: 'English' }, { code: 'hi', native: 'हिन्दी' }, { code: 'bn', native: 'বাংলা' },
    { code: 'te', native: 'తెలుగు' }, { code: 'mr', native: 'मराठी' }, { code: 'ta', native: 'தமிழ்' },
    { code: 'gu', native: 'ગુજરાતી' }, { code: 'kn', native: 'ಕನ್ನಡ' }, { code: 'ml', native: 'മലയാളം' },
    { code: 'pa', native: 'ਪੰਜਾਬੀ' }, { code: 'or', native: 'ଓଡ଼ିଆ' }
  ];

  return (
    <LanguageContext.Provider value={{ language, setLanguage: setLanguageState, t, LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function AppProvider({ children }) {
  const [encoders, setEncoders] = useState({ districts: [], markets: [], commodities: [], state_districts: {} });
  const [selectedState, setSelectedState] = useState(loadState('agro_state', ''));
  const [selectedDistrict, setSelectedDistrict] = useState(loadState('agro_district', ''));
  const [geoHint, setGeoHint] = useState('');
  const [selectedCrop, setSelectedCrop] = useState(loadState('agro_crop', 'rice'));
  const [fieldSize, setFieldSize] = useState(loadState('agro_fieldSize', 5));
  const [weatherValues, setWeatherValues] = useState(loadState('agro_weather', DEFAULT_WEATHER));
  const [predictionResult, setPredictionResult] = useState(loadState('agro_prediction', null));
  const [marketResult, setMarketResult] = useState(loadState('agro_market', null));
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const selectedStateRef = React.useRef(selectedState);
  useEffect(() => { selectedStateRef.current = selectedState; }, [selectedState]);
  const selectedCropRef = React.useRef(selectedCrop);
  useEffect(() => { selectedCropRef.current = selectedCrop; }, [selectedCrop]);
  const [forecastData, setForecastData] = useState(loadState('agro_forecast', null));
  const [diseaseRisk, setDiseaseRisk] = useState(null); 
  useEffect(() => { localStorage.setItem('agro_state', JSON.stringify(selectedState)); }, [selectedState]);
  useEffect(() => {
    if (!selectedDistrict) return;
    localStorage.setItem('agro_district', JSON.stringify(selectedDistrict));
    setPredictionResult(null);
    setMarketResult(null);
    setForecastData(null);
    localStorage.removeItem('agro_weather');
    localStorage.removeItem('agro_forecast');
    setWeatherValues(DEFAULT_WEATHER); // ← reset to defaults so stale data doesn't linger
}, [selectedDistrict]);
  useEffect(() => { localStorage.setItem('agro_crop', JSON.stringify(selectedCrop)); }, [selectedCrop]);
  useEffect(() => { localStorage.setItem('agro_fieldSize', JSON.stringify(fieldSize)); }, [fieldSize]);
  useEffect(() => { localStorage.setItem('agro_weather', JSON.stringify(weatherValues)); }, [weatherValues]);
  useEffect(() => { localStorage.setItem('agro_prediction', JSON.stringify(predictionResult)); }, [predictionResult]);
  useEffect(() => { localStorage.setItem('agro_market', JSON.stringify(marketResult)); }, [marketResult]);
  useEffect(() => { localStorage.setItem('agro_forecast', JSON.stringify(forecastData)); }, [forecastData]);
  useEffect(() => {
    if (!selectedDistrict) return;
 
    const controller = new AbortController();
    const { signal } = controller;
    let debounce = null;
 
    debounce = setTimeout(async () => {
      setWeatherLoading(true);
      if (signal.aborted) return;
 
      const currentState = selectedStateRef.current;
 
      try {
        // ── 1. Geocode with alias normalization + nearest-station fallback ──
        const loc = await appGeocodeDistrict(selectedDistrict, currentState, signal);
        if (signal.aborted) return;
 
        if (!loc) {
          console.warn(`No geocoding result for: ${selectedDistrict}`);
          if (!signal.aborted) setWeatherLoading(false);
          return;
        }
 
        const { latitude, longitude } = loc;
 
        // ── 2. Fetch weather from backend ──────────────────────────────────
        const wxData = await fetchForecast(latitude, longitude, signal);
        if (signal.aborted) return;
        if (!wxData.success || !wxData.data) throw new Error('Bad weather response');
 
        const fd = wxData.data;
        const elevation = wxData.elevation ?? 0;
        setForecastData(fd);
 
        // ── 3. Build weather values (elevation + state baseline blend) ─────
        const STATE_RAIN = {
          'West Bengal': 1600, 'Assam': 2800, 'Meghalaya': 11000,
          'Arunachal Pradesh': 2500, 'Manipur': 1800, 'Mizoram': 2100,
          'Nagaland': 2000, 'Tripura': 2200, 'Sikkim': 3000,
          'Kerala': 3000, 'Karnataka': 1200, 'Tamil Nadu': 900,
          'Andhra Pradesh': 900, 'Telangana': 900, 'Maharashtra': 1200,
          'Goa': 2900, 'Odisha': 1500, 'Jharkhand': 1300,
          'Bihar': 1200, 'Uttar Pradesh': 1000, 'Madhya Pradesh': 1200,
          'Chhattisgarh': 1400, 'Rajasthan': 500, 'Gujarat': 800,
          'Punjab': 650, 'Haryana': 700, 'Himachal Pradesh': 1600,
          'Uttarakhand': 1800, 'Delhi': 700,
        };
 
        const LAPSE = 6.5 / 1000;
        const tempCorr = -(elevation * LAPSE);
        const stateBaseline = STATE_RAIN[currentState] ?? 1000;
        const weeklyAvg = fd.precipitation.reduce((s, v) => s + v, 0) / fd.precipitation.length;
        let blended = Math.round(stateBaseline * 0.7 + Math.round(weeklyAvg * 52) * 0.3);
 
        if (elevation > 500 && elevation <= 2500) {
          blended = Math.round(blended * (1.0 + ((elevation - 500) / 2000) * 0.8));
        } else if (elevation > 2500) {
          blended = Math.round(blended * Math.max(0.6, 1.8 - ((elevation - 2500) / 2000) * 0.6));
        }
        const annualRainfall = Math.max(200, Math.min(4500, blended));
        const humAdd = elevation < 2000
          ? Math.round(elevation / 200)
          : Math.max(0, 10 - Math.round((elevation - 2000) / 300));
 
        const updatedWeather = {
          temperature: Math.round((fd.current.temperature_2m + tempCorr) * 10) / 10,
          humidity: Math.min(100, fd.current.relative_humidity_2m + humAdd),
          rainfall: annualRainfall,
          ph: 6.5,
          windSpeed: fd.current.wind_speed_10m,
          precipitationProbability: fd.current.precipitation_probability,
          feelsLike: fd.current.apparent_temperature,
          maxTemp: fd.temp_max[0],
          minTemp: fd.temp_min[0],
          elevationMeters: Math.round(elevation),
        };
 
        if (signal.aborted) return;
        setWeatherValues(updatedWeather);
 
        // ── 4. Compute geographically-varied soil params from real lat/lon ──
        if (signal.aborted) return;
        if (isPredicting.current) {
          if (!signal.aborted) setWeatherLoading(false);
          return;
        }
        isPredicting.current = true;
 
        const crop = selectedCropRef.current || 'rice';
        const defaults = CROP_DEFAULTS[crop] || CROP_DEFAULTS.rice;
 
        // Use real lat/lon for soil variation — not district name hash
        const { N, P, K } = districtSoilParams(latitude, longitude, defaults);
 
        setLoading(true);
        setError(null);
        try {
          const res = await predictCrop({
            N,
            P,
            K,
            temperature: updatedWeather.temperature,
            humidity: updatedWeather.humidity,
            ph: defaults.ph,
            rainfall: updatedWeather.rainfall,
            district: selectedDistrict.toLowerCase(),
            fieldSize,
            selectedCrop: crop,
          }, signal);
          if (!signal.aborted) setPredictionResult(res);
        } catch (e) {
          if (e.name !== 'AbortError' && !signal.aborted) setError(e.message);
        } finally {
          if (!signal.aborted) setLoading(false);
          isPredicting.current = false;
        }
 
      } catch (e) {
        if (e.name !== 'AbortError' && !signal.aborted) {
          console.warn('Weather effect failed:', e.message);
        }
      } finally {
        if (!signal.aborted) setWeatherLoading(false);
      }
    }, 200);
 
    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [selectedDistrict]); 

  useEffect(() => {
    fetchEncoders()
      .then(setEncoders)
      .catch(e => console.warn('Flask server off. Using fallback encoders.'));
  }, []);
  // Change setDistrict to accept optional state hint
  const setDistrict = useCallback((district, state = selectedState) => {
    setSelectedDistrict(district);
    setGeoHint(state);  // store state for geocode
  }, [selectedState]);
  const cropDefaults = CROP_DEFAULTS[selectedCrop] || CROP_DEFAULTS.rice;
  const cropChangeRef = React.useRef(false);
  const isPredicting = React.useRef(false);
useEffect(() => {
    if (!selectedDistrict || !predictionResult) return;
 
    const timer = setTimeout(async () => {
      if (isPredicting.current) return;
      isPredicting.current = true;
      setError(null);
 
      const crop = selectedCropRef.current || 'rice';
      const defaults = CROP_DEFAULTS[crop] || CROP_DEFAULTS.rice;
 
      // Re-geocode to get real lat/lon for soil params
      // (cached by browser — fast second call)
      let soilN = defaults.N, soilP = defaults.P, soilK = defaults.K;
      try {
        const currentState = selectedStateRef.current;
        const loc = await appGeocodeDistrict(selectedDistrict, currentState, new AbortController().signal);
        if (loc) {
          const sp = districtSoilParams(loc.latitude, loc.longitude, defaults);
          soilN = sp.N; soilP = sp.P; soilK = sp.K;
        }
      } catch (_) {
        // fallback to crop defaults if geocode fails
      }
 
      try {
        const res = await predictCrop({
          N: soilN, P: soilP, K: soilK,
          temperature: weatherValues.temperature,
          humidity: weatherValues.humidity,
          ph: defaults.ph,
          rainfall: weatherValues.rainfall,
          district: selectedDistrict.toLowerCase(),
          fieldSize,
          selectedCrop: crop,
        });
        setPredictionResult(res);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        isPredicting.current = false;
      }
    }, 300);
 
    return () => clearTimeout(timer);
  }, [selectedCrop]);
  const runPrediction = useCallback(async (overrides = {}) => {
    if (isPredicting.current) return;
    isPredicting.current = true;
    setLoading(true);
    setError(null);
 
    const crop = selectedCrop || 'rice';
    const defaults = CROP_DEFAULTS[crop] || CROP_DEFAULTS.rice;
 
    // Derive soil params from real geocoordinates when possible
    let soilN = defaults.N, soilP = defaults.P, soilK = defaults.K;
    try {
      const loc = await appGeocodeDistrict(
        selectedDistrict || 'East Godavari',
        selectedState,
        new AbortController().signal
      );
      if (loc) {
        const sp = districtSoilParams(loc.latitude, loc.longitude, defaults);
        soilN = sp.N; soilP = sp.P; soilK = sp.K;
      }
    } catch (_) {
      // fallback to defaults
    }
 
    try {
      const payload = {
        N: soilN, P: soilP, K: soilK,
        temperature: weatherValues.temperature,
        humidity: weatherValues.humidity,
        ph: defaults.ph,
        rainfall: weatherValues.rainfall,
        district: (selectedDistrict || 'East Godavari').toLowerCase(),
        fieldSize,
        selectedCrop: crop,
        ...overrides,
      };
      const res = await predictCrop(payload);
      setPredictionResult(res);
      return res;
    } catch (e) {
      setError(e.response?.data?.errors?.join(', ') || e.message);
      throw e;
    } finally {
      setLoading(false);
      isPredicting.current = false;
    }
  }, [selectedCrop, weatherValues, selectedDistrict, selectedState, fieldSize]);
  const runMarketPrediction = useCallback(async (payload = {}) => {
  setLoading(true);
  setError(null);
  try {
    const res = await predictMarket(payload);
    setMarketResult(res);
    return res;
  } catch (e) {
    setError(e.response?.data?.errors?.join(', ') || e.message);
    throw e;
  } finally {
    setLoading(false);
  }
  }, []);

  return (
    <AppContext.Provider value={{
      encoders,
      selectedState,
      setSelectedState,
      selectedDistrict,
      setDistrict,

      selectedCrop,
      setCrop: setSelectedCrop,

      fieldSize,
      setFieldSize,

      weatherValues,
      setWeatherValues,

      predictionResult,
      setPredictionResult,

      marketResult,
      setMarketResult,

      loading,
      weatherLoading,
      error,
      setError,

      forecastData,
      setForecastData,

      cropDefaults,
      CROP_DEFAULTS,
      DEFAULT_WEATHER,

      runPrediction,
      runMarketPrediction,
      diseaseRisk,        
      setDiseaseRisk,    
      
      }}>
      {children}
    </AppContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
export const useApp = () => useContext(AppContext);

// ==========================================
// 3. 8 PAGE COMPONENTS (MERGED)
// ==========================================

// --- PAGE 1: FarmOverview ---
function FarmOverview() {
  const { t } = useLanguage();
  const {
  selectedDistrict,
  predictionResult,
  runPrediction,
  loading,
  weatherLoading,
  error,
  forecastData
  } = useApp();

  const hasResult = predictionResult && predictionResult.success;
  const rec = hasResult ? predictionResult.predictions.crop_recommendation : null;
  const yieldEst = hasResult ? predictionResult.predictions.yield_prediction : null;
  const fertPrice = hasResult ? predictionResult.predictions.fertilizer_price_prediction : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 border border-border p-6 md:p-8 rounded-3xl relative overflow-hidden flex flex-col gap-2">
        <div className="absolute right-0 bottom-0 top-0 opacity-10 flex items-center justify-center p-8 pointer-events-none">
          <FaLeaf size={240} className="text-teal-light" />
        </div>
        <span className="badge badge-teal w-fit uppercase tracking-wider text-[10px]">{t('nav.overview', 'Overview Dashboard')}</span>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">{t('app.subtitle', 'Precision Sustainable E-Agriculture')}</h2>
        <p className="text-sm text-white">Enter soil, weather, and district parameters to formulate precision agro-climate analytics, crop forecasting, and crop diagnostic advice.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-card p-6 flex flex-col gap-6">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-2">
              <FaSearchLocation className="text-teal" /> 1. Geographic Coordinates
            </h3>
            <DistrictSelector />
          </div>
          <div className="glass-card p-6 flex flex-col gap-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-2">
              <FaLeaf className="text-teal" /> 2. Crop Selection Matrix
            </h3>
            <CropGrid />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <WeatherCard />
          <FieldSlider />
          <button
            type="button"
            onClick={() => runPrediction()}
            disabled={loading || !selectedDistrict || weatherLoading}
            className="btn-primary w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-base shadow-lg animate-pulse-glow cursor-pointer"
          >
            {loading ? <span className="loading-spinner"></span> : <>{t('button.submit', 'Run Diagnostic Analysis')} <FaArrowRight /></>}
          </button>
          {error && <div className="bg-danger/10 border border-danger/20 text-danger text-xs p-3.5 rounded-xl font-semibold">Error: {error}</div>}
        </div>
      </div>

      {hasResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4 animate-fade-in">
          <div className="glass-card p-6 flex flex-col gap-6">
            <div className="border-b border-border pb-4">
              <span className="badge badge-success mb-2 uppercase tracking-widest text-[9px]">BEST CROP FOR CURRENT LOCATION</span>
              <h3 className="text-3xl font-extrabold text-teal-light">{rec.recommended_crop}</h3>
            </div>
            {rec.selected_crop && (() => {
              const score = rec.selected_crop_score ?? 0;
              const isMatch = rec.selected_crop.toLowerCase() === rec.recommended_crop.toLowerCase();

              // Format score with enough precision to never show 0% for a real value
              const formatScore = (s) => {
                if (s >= 0.1)  return `${Math.round(s * 100) / 100}%`;
                if (s >= 0.01) return `${s.toFixed(2)}%`;
                if (s >= 0.001) return `${s.toFixed(3)}%`;
                if (s > 0)     return `< 0.001%`;
                return '—';
              };

              // Progress bar: scale to best crop so Wheat/Best are comparable
              const bestScore = rec.top_3_crops[0]?.probability || 1;
              const barWidth = Math.max(2, Math.min(100, (score / bestScore) * 100));

              // Colour: green if selected=best, orange otherwise
              const scoreColor = isMatch ? 'text-success' : 'text-orange';
              const barColor   = isMatch ? 'bg-success' : 'bg-orange';

              // Suitability label
              const suitLabel = score >= 20 ? 'High Suitability'
                              : score >= 10 ? 'Moderate Suitability'
                              : score >= 1  ? 'Low Suitability'
                              : score >= 0.1 ? 'Very Low Suitability'
                              : 'Not Suited for Current Conditions';

              return (
                <div className="bg-surface/60 border border-border rounded-xl p-3 flex flex-col gap-2">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      Your Selected Crop
                    </span>
                    <span className="text-xs font-extrabold text-text-primary capitalize">
                      {rec.selected_crop}
                    </span>
                  </div>

                  {/* Score row */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      Model Match Score
                    </span>
                    <span className={`text-sm font-extrabold ${scoreColor}`}>
                      {formatScore(score)}
                    </span>
                  </div>

                  {/* Progress bar — scaled relative to best crop, always visible */}
                  <div className="flex items-center gap-2">
                    <div className="progress-bar flex-1">
                      <div
                        className={`progress-bar-fill ${barColor}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-text-muted whitespace-nowrap">
                      vs best: {bestScore.toFixed(2)}%
                    </span>
                  </div>

                  {/* Suitability badge */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      score >= 10  ? 'bg-success/10 text-success'
                      : score >= 1 ? 'bg-warning/10 text-warning'
                      : 'bg-danger/10 text-danger'
                    }`}>
                      {suitLabel}
                    </span>
                    {isMatch && (
                      <span className="text-[9px] font-bold text-success">✓ Optimal Choice</span>
                    )}
                  </div>

                  {/* Explanation — only when selected ≠ best */}
                  {!isMatch && (
                    <p className="text-[10px] text-text-muted leading-relaxed border-t border-border pt-2 mt-0.5">
                      ⚠ <span className="capitalize font-semibold text-text-secondary">{rec.recommended_crop}</span>
                      {' '}scores {rec.top_3_crops[0]?.probability?.toFixed(2)}% vs your crop's {formatScore(score)}.
                      {score < 1
                        ? ' Current conditions (temperature, humidity, rainfall) strongly favour other crops.'
                        : ' Consider the top recommendation for higher yield potential.'}
                    </p>
                  )}
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-4">
              <div className="kpi-card flex flex-col gap-1">
                <span className="text-[10px] font-bold text-text-secondary uppercase">Expected Yield</span>
                <span className="text-xl font-extrabold text-text-primary">{yieldEst.estimated_yield_tonnes_per_ha}</span>
                <span className="text-[10px] text-text-muted">{yieldEst.unit}</span>
              </div>
              <div className="kpi-card flex flex-col gap-1">
                <span className="text-[10px] font-bold text-text-secondary uppercase">Fertilizer Bag Cost</span>
                <span className="text-xl font-extrabold text-text-primary">₹{fertPrice.estimated_price_inr}</span>
                <span className="text-[10px] text-text-muted">per 50 kg bag</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Crop Probability Distribution</h4>
              <div className="space-y-2">
                {rec.top_3_crops.map((c, i) => (
                  <div key={i} className="flex flex-col gap-1 bg-surface p-2.5 rounded-lg border border-border">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-text-primary">{c.crop}</span>
                      <span className="text-teal-light">{c.probability}%</span>
                    </div>
                    <div className="progress-bar"><div className="progress-bar-fill bg-teal" style={{ width: `${Math.min(100, c.probability)}%` }}></div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-card p-6 flex flex-col gap-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-text-secondary border-b border-border pb-3">{t('title.alternatives', 'Alternative Crop Scenarios')}</h3>
            <div className="overflow-y-auto max-h-[320px] pr-1 space-y-2.5">
              {rec.all_crop_scores
                .filter(score => score.crop !== rec.recommended_crop)
                .slice(0, 9)
                .map((score, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-surface-card border border-border/60 rounded-xl hover:border-teal/30 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-text-muted w-4">#{index + 2}</span>
                    <span className="text-xs font-bold text-text-primary capitalize">{score.crop}</span>
                  </div>
                  <span className="badge badge-teal font-extrabold">{score.probability}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6 flex flex-col gap-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-2">
              <FaChartLine className="text-orange" /> 7-Day Predictive Weather Grid
            </h3>
            <ForecastChart dataPoints={forecastData ? {
               temps: forecastData.temp_max,
               rain: forecastData.precipitation
            } : null} />
          </div>
        </div>
      )}
    </div>
  );
}

// --- PAGE 2: FertilizerStrategy ---

function FertilizerStrategy() {
  const { t } = useLanguage();
  const { predictionResult, selectedCrop, fieldSize, cropDefaults, marketResult, weatherValues, diseaseRisk } = useApp();

  const hasResult = predictionResult && predictionResult.success;

  // Always read from predictionResult.inputs when available (server already applied adjustments)
  // Fall back to cropDefaults only if no prediction has run yet
  const N = hasResult ? predictionResult.inputs.N : cropDefaults.N;
  const P = hasResult ? predictionResult.inputs.P : cropDefaults.P;
  const K = hasResult ? predictionResult.inputs.K : cropDefaults.K;
  const ph = hasResult ? predictionResult.inputs.ph : cropDefaults.ph;

  const phDeviation = Math.abs(ph - 6.5);
  const soilHealth = predictionResult?.predictions?.soil_health;
  const soilHealthScore = soilHealth
    ? soilHealth.score
    : Math.max(35, Math.min(98, Math.round(95 - phDeviation * 25)));

  const fertType = predictionResult?.predictions?.fertilizer_type;


// Compute conflict only when we have both disease data and fertilizer data
const conflictResult = useMemo(() => {
  if (!diseaseRisk || !hasResult) return null;
  return resolveFertilizerConflict(
    diseaseRisk.primaryDisease,
    diseaseRisk.riskLevel,
    N,
    fertType?.recommended_fertilizer || 'Balanced NPK Fertilizer'
  );
}, [diseaseRisk, N, fertType, hasResult]);

const effectiveN = conflictResult?.hasConflict ? conflictResult.adjustedN : N;
const effectiveFert = conflictResult?.hasConflict
  ? conflictResult.adjustedFert
  : (fertType?.recommended_fertilizer || '_default');

  // Nutrient coverage match: how well each fertilizer covers this crop's N:P:K demand
  const calcNutrientMatch = (fertName, cropN, cropP, cropK) => {
    const FERT_NPK = {
      'DAP':                        { N: 18, P: 46, K: 0  },
      'Urea':                       { N: 46, P: 0,  K: 0  },
      'Muriate of Potash':          { N: 0,  P: 0,  K: 60 },
      'Balanced NPK Fertilizer':    { N: 17, P: 17, K: 17 },
      'Compost':                    { N: 2,  P: 1,  K: 1  },
      'Organic Fertilizer':         { N: 4,  P: 3,  K: 3  },
      'Water Retaining Fertilizer': { N: 5,  P: 5,  K: 5  },
      'Gypsum':                     { N: 0,  P: 0,  K: 0  },
      'Lime':                       { N: 0,  P: 0,  K: 0  },
      'General Purpose Fertilizer': { N: 12, P: 12, K: 12 },
    };
    const profile = FERT_NPK[fertName] || { N: 10, P: 10, K: 10 };
    const total = Math.max(1, cropN + cropP + cropK);
    const nW = cropN / total, pW = cropP / total, kW = cropK / total;
    const score = (nW * Math.min(1, profile.N / 46) +
                   pW * Math.min(1, profile.P / 46) +
                   kW * Math.min(1, profile.K / 60)) * 100;
    return Math.round(score);
  };

  // Base fertilizer prices — used when model is offline; district factor applied if known
  const BASE_FERT_PRICES = { 'Urea': 266, 'DAP': 1350, 'Muriate of Potash': 1700 };
  const districtFactor = fertType?.price_factor || 1.0;

  const staticPrices = (fertType?.top_3 && fertType.top_3.length > 0)
    ? fertType.top_3.map((f) => ({
        name: f.fertilizer,
        price: f.price,
        trend: `${f.probability.toFixed(1)}% match`
      }))
    : [
        {
          name: 'Urea (46% N)',
          price: Math.round(BASE_FERT_PRICES['Urea'] * districtFactor),
          trend: `${calcNutrientMatch('Urea', N, P, K)}% N-match`
        },
        {
          name: 'DAP (18-46-0)',
          price: Math.round(BASE_FERT_PRICES['DAP'] * districtFactor),
          trend: `${calcNutrientMatch('DAP', N, P, K)}% NP-match`
        },
        {
          name: 'Muriate of Potash',
          price: Math.round(BASE_FERT_PRICES['Muriate of Potash'] * districtFactor),
          trend: `${calcNutrientMatch('Muriate of Potash', N, P, K)}% K-match`
        },
      ];

  const baseYield = hasResult
    ? predictionResult.predictions.yield_prediction.estimated_yield_tonnes_per_ha
    : 4.5;
  const avgForCrop = NATIONAL_AVG_YIELD[selectedCrop] ?? NATIONAL_AVG_YIELD.default;
  const yieldDiffVal = Math.max(0, baseYield - avgForCrop);   // kept for "vs avg" display only
  const estimatedMarketRate = CROP_BASE_PRICES[selectedCrop] ?? 2200;
  const grossRevenue = Math.round(baseYield * fieldSize * 10 * estimatedMarketRate);
  const bagPrice = fertType?.price_per_bag_inr || 2450;
  const fertilizerCost = Math.round(bagPrice * fieldSize);
  const BASE_LABOR_PER_HA = 800;
  const priceFactor   = fertType?.price_factor || 1.0;
  const soilPenalty   = soilHealth ? Math.max(0.9, 1.0 + ((100 - soilHealth.score) / 500)) : 1.0;
  const yieldBonus    = hasResult  ? Math.max(1.0, 1.0 + (predictionResult.predictions.yield_prediction.estimated_yield_tonnes_per_ha - 3) * 0.03) : 1.0;
  const laborCost     = Math.round(BASE_LABOR_PER_HA * fieldSize * priceFactor * soilPenalty * yieldBonus);
  const netROI = grossRevenue - (fertilizerCost + laborCost);

  // N/P/K are already weather-adjusted values from the server (or cropDefaults if no result yet)
  // Apply stage splits directly — NO second weather adjustment
  // Stage-appropriate products derived from ML-recommended fertilizer
  const STAGE_PRODUCTS = {
    'Urea':                       ['DAP + Compost',     'Urea',              'Urea + MOP',       'Soluble K'],
    'DAP':                        ['DAP + Lime',        'DAP + Urea',        'Balanced NPK',     'MOP'],
    'Muriate of Potash':          ['Compost + MOP',     'MOP + Urea',        'MOP + DAP',        'Soluble K'],
    'Balanced NPK Fertilizer':    ['Compost + NPK',     'Balanced NPK',      'Balanced NPK',     'MOP'],
    'Compost':                    ['Compost + DAP',     'Compost + Urea',    'Compost + NPK',    'Compost'],
    'Organic Fertilizer':         ['Organic + Lime',    'Organic + Urea',    'Organic + NPK',    'Organic'],
    'Water Retaining Fertilizer': ['DAP + WRF',         'Urea + WRF',        'NPK + WRF',        'WRF + MOP'],
    'Gypsum':                     ['DAP + Gypsum',      'Urea + Gypsum',     'NPK + Gypsum',     'MOP'],
    'Lime':                       ['Lime + DAP',        'Urea + Lime',       'Balanced NPK',     'MOP'],
    'General Purpose Fertilizer': ['GPF + Compost',     'GPF + Urea',        'GPF + MOP',        'Soluble K'],
    '_default':                   ['DAP + Compost',     'Urea + MOP',        'Balanced NPK',     'Soluble K'],
  };
    const recFert = effectiveFert;
const stageProducts = STAGE_PRODUCTS[recFert] || STAGE_PRODUCTS['_default'];

const nutrientStages = [
  {
    stage: 'Basal (Land Prep)',
    N: Math.round(effectiveN * 0.2), P: Math.round(P * 0.7), K: Math.round(K * 0.3),
    product: stageProducts[0], method: 'Broadcast'
  },
  {
    stage: 'Vegetative Growth',
    N: Math.round(effectiveN * 0.5), P: Math.round(P * 0.1), K: Math.round(K * 0.2),
    product: stageProducts[1], method: 'Top Dressing'
  },
  {
    stage: 'Flowering & Fruiting',
    N: Math.round(effectiveN * 0.2), P: Math.round(P * 0.1), K: Math.round(K * 0.3),
    product: stageProducts[2], method: 'Foliar Spray'
  },
  {
    stage: 'Grain Fill / Maturity',
    N: Math.round(effectiveN * 0.1), P: Math.round(P * 0.1), K: Math.round(K * 0.2),
    product: stageProducts[3], method: 'Drip / Fertigation'
  },
];

  return (
    <div className="flex flex-col gap-6">
      {conflictResult?.hasConflict && (
  <div className={`border p-4 rounded-2xl flex flex-col gap-2 ${
    conflictResult.severity === 'critical'
      ? 'bg-danger/10 border-danger/30'
      : 'bg-warning/10 border-warning/30'
  }`}>
    <div className="flex items-center gap-2">
      <FaExclamationTriangle className={
        conflictResult.severity === 'critical' ? 'text-danger' : 'text-warning'
      } size={14} />
      <span className={`text-xs font-extrabold uppercase tracking-wider ${
        conflictResult.severity === 'critical' ? 'text-danger' : 'text-warning'
      }`}>
        Disease–Fertilizer Conflict Detected ({conflictResult.severity?.toUpperCase()})
      </span>
    </div>
    <p className="text-[11px] text-text-secondary leading-relaxed">
      {conflictResult.warningMessage}
    </p>
    <div className="grid grid-cols-2 gap-3 mt-1">
      <div className="bg-surface/60 rounded-xl p-2.5 border border-border">
        <span className="text-[9px] font-bold text-text-muted uppercase">Original N</span>
        <p className="text-sm font-extrabold text-danger line-through">
          {conflictResult.originalN} kg/ha
        </p>
      </div>
      <div className="bg-surface/60 rounded-xl p-2.5 border border-border">
        <span className="text-[9px] font-bold text-text-muted uppercase">Adjusted N</span>
        <p className="text-sm font-extrabold text-success">
          {conflictResult.adjustedN} kg/ha
        </p>
      </div>
      {conflictResult.originalFert !== conflictResult.adjustedFert && (
        <>
          <div className="bg-surface/60 rounded-xl p-2.5 border border-border">
            <span className="text-[9px] font-bold text-text-muted uppercase">Avoided Fertilizer</span>
            <p className="text-xs font-extrabold text-danger">{conflictResult.originalFert}</p>
          </div>
          <div className="bg-surface/60 rounded-xl p-2.5 border border-border">
            <span className="text-[9px] font-bold text-text-muted uppercase">Recommended Instead</span>
            <p className="text-xs font-extrabold text-success">{conflictResult.adjustedFert}</p>
          </div>
        </>
      )}
    </div>
    {conflictResult.splitDosing && (
      <p className="text-[10px] text-teal-light font-semibold mt-1">
        ✓ Split dosing protocol activated — apply N in 3 smaller doses to reduce volatilization and disease risk.
      </p>
    )}
  </div>
)}
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 border border-border p-6 rounded-3xl flex flex-col gap-2">
        <span className="badge badge-teal w-fit uppercase tracking-widest text-[9px]">NUTRIENT OPTIMIZATION</span>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          {t('title.fertilizer_strategy', 'Precision Soil Nutrition Strategy')}
        </h2>
        <p className="text-sm text-white">
          Personalized crop feeding schedule based on current soil parameters and targeted yield optimization algorithms.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="flex flex-col gap-6">
          <div className="glass-card p-6 flex flex-col gap-5">
            {!fertType && hasResult && (
              <div className="bg-warning/10 border border-warning/20 text-warning text-xs p-3 rounded-xl font-semibold flex items-center gap-2">
                <FaExclamationTriangle size={12} /> Fertilizer model offline — showing estimated prices
              </div>
            )}
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-1.5">
              <FaHeartbeat className="text-teal" /> Soil Health Index
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-end">
                <span className="text-3xl font-extrabold text-teal-light">
                  {soilHealthScore} <span className="text-xs text-text-secondary font-medium">/ 100</span>
                </span>
                <span className={`badge ${soilHealthScore >= 80 ? 'badge-success' : soilHealthScore >= 60 ? 'badge-warning' : 'badge-danger'} uppercase text-[9px] tracking-wider font-extrabold`}>
                  {soilHealthScore >= 80 ? 'Excellent' : soilHealthScore >= 60 ? 'Good' : soilHealthScore >= 40 ? 'Fair' : 'Poor'}
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill bg-success" style={{ width: `${soilHealthScore}%` }}></div>
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed mt-1">
                Your soil pH of <span className="text-teal-light font-bold">{ph}</span> matches the needs of{' '}
                <span className="capitalize font-bold text-text-primary">{selectedCrop}</span> perfectly.
              </p>
            </div>
          </div>
          <div className="glass-card p-6 flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3">
              Active Nutrient Ratio
            </h3>
            <NPKDonut N={N} P={P} K={K} />
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-card p-6 flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-2">
              <FaTable className="text-orange" /> {t('title.nutrient_schedule', 'Nutrient Application Protocol')}
            </h3>
            {!hasResult && (
              <div className="bg-surface/60 border border-border text-text-secondary text-xs p-3 rounded-xl flex items-center gap-2">
                <FaInfoCircle size={12} className="text-teal" />
                Run diagnostic analysis on the Overview page to see district-specific nutrient values.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="table-styled">
                <thead>
                  <tr>
                    <th>Phase</th>
                    <th className="text-center">N (kg/ha)</th>
                    <th className="text-center">P (kg/ha)</th>
                    <th className="text-center">K (kg/ha)</th>
                    <th>Product</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {nutrientStages.map((stage, idx) => (
                    <tr key={idx}>
                      <td className="font-bold text-text-primary text-xs">{stage.stage}</td>
                      <td className="text-center text-teal-light font-extrabold">{Number(stage.N.toFixed(1))}</td>
                      <td className="text-center text-orange-light font-extrabold">{Number(stage.P.toFixed(1))}</td>
                      <td className="text-center text-amber-500 font-extrabold">{Number(stage.K.toFixed(1))}</td>
                      <td className="text-xs font-semibold">{stage.product}</td>
                      <td className="text-xs text-text-secondary">{stage.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {staticPrices.map((item, index) => (
              <div key={index} className="kpi-card flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{item.name}</span>
                <div className="flex justify-between items-baseline mt-1">
                  <span className="text-lg font-extrabold text-text-primary">₹{item.price}</span>
                  <span className={`text-[10px] font-bold ${item.trend.includes('%') && !item.trend.includes('match') ? (item.trend.startsWith('-') ? 'text-danger' : 'text-success') : 'text-teal-light'}`}>
                    {item.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {fertType?.price_factor && (
            <div className="text-[10px] text-text-secondary mt-1 flex items-center gap-1">
               <FaMapMarkerAlt className="text-orange" size={10} />
               District price factor for <span className="font-bold text-teal-light capitalize mx-1">{predictionResult?.inputs?.district}</span>: 
              <span className="font-bold text-orange ml-1">×{fertType.price_factor}</span>
               <span className="text-text-muted ml-1">(distance-adjusted from nearest hub)</span>
           </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="glass-card p-5 lg:col-span-3 flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <FaCoins className="text-teal" /> Strategic Financial Analytics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Gross Revenue</span>
              <span className="text-lg font-extrabold text-success">₹{grossRevenue.toLocaleString('en-IN')}</span>
              {yieldDiffVal > 0 && (
                <span className="text-[9px] text-teal-light font-semibold">+{Math.round(yieldDiffVal * 100) / 100} t/ha vs avg</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Input Spend</span>
              <span className="text-lg font-extrabold text-text-primary">₹{fertilizerCost.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Labor Cost</span>
              <span className="text-lg font-extrabold text-text-primary">₹{laborCost.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Net ROI</span>
              <span className={`text-lg font-extrabold ${netROI >= 0 ? 'text-teal-light' : 'text-danger'}`}>
                {netROI >= 0 ? '' : '-'}₹{Math.abs(netROI).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-950/20 to-surface-card border border-orange-500/20 p-5 rounded-2xl flex flex-col gap-2">
          <h4 className="text-xs font-bold text-orange flex items-center gap-1.5 uppercase tracking-wider">
            <FaInfoCircle /> Efficiency tip
          </h4>
          <p className="text-[10px] text-text-secondary leading-relaxed">
            {(() => {
          // Disease conflict takes priority over soil N deficiency advice
          if (conflictResult?.hasConflict) {
             return conflictResult.reason;
            }

             const fertName  = effectiveFert || '';
             const soilScore = soilHealth?.score || 75;
             const nScore    = soilHealth?.n_score || 50;
             const pScore    = soilHealth?.p_score || 50;
             const kScore    = soilHealth?.k_score || 50;
             const yieldVal  = hasResult
                 ? predictionResult.predictions.yield_prediction.estimated_yield_tonnes_per_ha
                : 0;

              if (nScore < 40)
                 return `Your soil N score is critically low (${nScore}/100). Model recommends ${fertName || 'nitrogen-rich fertilizer'} — apply in 3 splits to prevent leaching.`;
 
              if (pScore < 40)
                return `Phosphorus deficiency detected (score: ${pScore}/100). ${fertName || 'DAP'} application at basal stage will improve root development and early growth.`;
              if (kScore < 40)
                return `Low potassium index (${kScore}/100) weakens cell walls and disease resistance. Prioritise ${fertName || 'MOP'} application before flowering.`;
              if (soilScore < 50)
                return `Overall soil health is poor (${soilScore}/100). Reduce chemical inputs and add organic compost to improve microbial activity before next season.`;
              if (yieldVal > 0 && yieldVal < 2)
                return `Predicted yield of ${yieldVal} t/ha is below average. Model suggests ${fertName || 'balanced NPK'} with micronutrient correction to close the yield gap.`;
              if (fertName.includes('Urea'))
                return `Model recommends ${fertName}. Split into 3 doses: 30% basal, 40% at tillering, 30% at panicle — reduces volatilization loss by up to 25%.`;
              if (fertName.includes('DAP'))
                return `${fertName} recommended by model. Apply full dose at sowing as P is immobile in soil — band placement near roots improves uptake by 20%.`;
              if (fertName.includes('Compost') || fertName.includes('Organic'))
                return `Model recommends ${fertName} — ideal for your soil health score of ${soilScore}/100. Organic matter improves water retention and long-term fertility.`;
              if (fertName.includes('Potash'))
                return `${fertName} selected by model. Apply in two splits — 50% at sowing and 50% at flowering — to maximize K uptake efficiency.`;
              return `Soil health index: ${soilScore}/100. Model-selected ${fertName || 'fertilizer'} targets your specific N:P:K imbalance. Follow the stage schedule above for best results.`;
            })()}
          </p>
        </div>
      </div>
    </div>
  );
}
// --- PAGE 3: PestIntelligence ---
function PestIntelligence() {
  const { t } = useLanguage();
  const { weatherValues, selectedCrop, selectedDistrict, setDiseaseRisk } = useApp();

  const humidity    = weatherValues?.humidity    ?? 70;
  const temperature = weatherValues?.temperature ?? 28;
  const rainfall    = weatherValues?.rainfall    ?? 1000;
  const windSpeed   = weatherValues?.windSpeed   ?? 10;
  const crop        = selectedCrop  || "rice";
  const district    = selectedDistrict || "unknown";

  const diseaseResult = useMemo(() => computeDiseaseRisk({
    crop, temperature, humidity, rainfall, windSpeed, district,
  }), [crop, temperature, humidity, rainfall, windSpeed, district]);

  const { primaryDisease, riskScore, riskLevel, watchlist } = diseaseResult;

  // Sync to global context so FertilizerStrategy can read it
  useEffect(() => {
    setDiseaseRisk(diseaseResult);
  }, [diseaseResult, setDiseaseRisk]);
 
  const riskBadgeClass = riskLevel === "High"   ? "badge-danger"
                       : riskLevel === "Medium"  ? "badge-warning"
                       :                           "badge-success";
 
  const galleryItems = getSymptomsForDisease(primaryDisease);
  const urgentActions = getUrgentActionsForDisease(primaryDisease, humidity);
 
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-gradient-to-r from-red-950/20 to-surface-card border border-danger/20 p-6 rounded-3xl flex flex-col gap-3 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 top-0 opacity-10 flex items-center justify-center p-8 pointer-events-none">
          <FaBug size={140} className="text-danger" />
        </div>
        <span className="badge badge-danger w-fit uppercase tracking-widest text-[9px]">REAL-TIME BIOLOGICAL THREAT</span>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-black">{t('title.pest_disease', 'Pest & Disease Advisory')}</h2>
        <p className="text-sm text-black">Micro-climatic analytics detecting atmospheric risks to crop biosecurity.</p>
      </div>
 
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 flex flex-col gap-5 justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-text-secondary uppercase">Active Pathology</span>
            <h3 className="text-lg font-bold text-text-primary">{primaryDisease}</h3>
          </div>
          <div className="flex flex-col items-center justify-center p-6 bg-surface/50 border border-border rounded-2xl gap-3">
            <span className="text-[10px] font-bold text-text-secondary uppercase">Outbreak Probability</span>
            <span className="text-5xl font-extrabold text-danger animate-pulse-glow rounded-full px-4">{riskScore}%</span>
            <span className={`badge ${riskBadgeClass} uppercase font-bold text-[9px] tracking-wider`}>{riskLevel} Alert Level</span>
          </div>
          <p className="text-[10px] text-text-secondary leading-relaxed">
            Atmospheric humidity of <span className="text-teal-light font-bold">{humidity}%</span>,
            temperature <span className="text-orange font-bold">{temperature}°C</span>,
            wind <span className="text-blue-300 font-bold">{windSpeed ?? "--"} km/h</span>{" "}
            combined with <span className="font-bold capitalize text-text-primary">{crop}</span> foliage in{" "}
            <span className="font-bold text-teal-light capitalize">{district}</span> triggers elevated incubation risks.
          </p>
        </div>
 
        <div className="lg:col-span-2 glass-card p-6 flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-1.5">
            <FaEye className="text-teal" /> Pathogen Vigilance Watchlist
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {watchlist.map((card, idx) => (
              <div key={idx} className="kpi-card flex flex-col gap-2.5">
                <div className="flex justify-between items-center gap-1">
                  <span className="text-xs font-bold text-text-primary leading-tight">{card.name}</span>
                  <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                    card.level === "High" ? "bg-danger/10 text-danger" :
                    card.level === "Medium" ? "bg-warning/10 text-warning" :
                    "bg-success/10 text-success"}`}>
                    {card.level}
                  </span>
                </div>
                <div className="progress-bar">
                  <div className={`progress-bar-fill ${card.level === "High" ? "bg-danger" : card.level === "Medium" ? "bg-warning" : "bg-success"}`}
                    style={{ width: `${card.score}%` }} />
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed">{card.tip}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
 
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 glass-card p-6 flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-1.5">
            <FaShieldAlt className="text-orange" /> Urgent Biosafety Protocol
          </h3>
          <div className="flex flex-col gap-3">
            {urgentActions.map((action, idx) => (
              <div key={idx} className="flex gap-4 p-3 bg-surface rounded-xl border border-border/80">
                <div className="h-6 w-6 rounded-full bg-orange/15 border border-orange/30 text-orange font-bold text-xs flex items-center justify-center shrink-0">{action.step}</div>
                <div className="flex flex-col gap-1">
                  <h4 className="text-xs font-bold text-text-primary">{action.title}</h4>
                  <p className="text-[10px] text-text-secondary leading-relaxed">{action.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
 
        <div className="lg:col-span-2 glass-card p-6 flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3">Symptoms Diagnostics</h3>
          <div className="space-y-3.5">
            {galleryItems.map((item, idx) => {
              const icons = [FaExclamationTriangle, FaBug, FaBiohazard, FaShieldAlt];
              const Icon = icons[idx % icons.length];
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-surface flex items-center justify-center text-text-secondary shrink-0 border border-border">
                    <Icon size={14} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-text-primary">{item.title}</span>
                    <span className="text-[10px] text-text-secondary line-clamp-2">{item.desc}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
// --- PAGE 4: IrrigationManagement ---
function IrrigationManagement() {
  const { t } = useLanguage();
  const { weatherValues, selectedCrop, selectedDistrict, fieldSize } = useApp();

  const rainfall    = weatherValues?.rainfall    || 1050;
  const temperature = weatherValues?.temperature || 28;
  const humidity    = weatherValues?.humidity    || 70;
  const crop        = selectedCrop || 'rice';

  // Evapotranspiration modifier: hot/dry → more irrigation needed
  // Reference: simplified Hargreaves-like factor
  const etFactor = Math.max(0.7, Math.min(1.5, 1.0 + (temperature - 28) * 0.02 - (humidity - 70) * 0.005));
  
 const CROP_SEASONAL_WATER = {
    rice: 1350, maize: 650, cotton: 950, banana: 1700,
    mango: 800, coconut: 1600, watermelon: 500, muskmelon: 450,
    grapes: 700, jute: 600, papaya: 900, orange: 900,
    apple: 900, pomegranate: 600, chickpea: 400, lentil: 350,
    mothbeans: 300, mungbean: 350, blackgram: 350, pigeonpeas: 450,
    kidneybeans: 450, coffee: 1200
  };

  const baseSeasonal = CROP_SEASONAL_WATER[crop] || 600;
  const totalWaterNeed = Math.round(baseSeasonal * etFactor);

  // BUG 4 FIX: waterRequirement was based on crop TOTAL need, not actual irrigation deficit.
  // A rainfed lentil showed "Very Low (350mm)" implying irrigation needed even when deficit=0.
  // Now we show the crop's base demand separately, and compute irrigClassLabel from the DEFICIT.
  const cropWaterClass =
    totalWaterNeed >= 1200 ? 'High'
    : totalWaterNeed >= 700 ? 'Medium'
    : totalWaterNeed >= 400 ? 'Low'
    : 'Very Low';

  const RAIN_RETENTION = {
    rice: 0.82, jute: 0.75, banana: 0.65, coconut: 0.60,
    maize: 0.55, cotton: 0.50, mango: 0.45, grapes: 0.42,
    apple: 0.45, chickpea: 0.50, lentil: 0.48, mothbeans: 0.45,
    mungbean: 0.50, blackgram: 0.50, pomegranate: 0.40,
    orange: 0.48, papaya: 0.58, watermelon: 0.52,
    muskmelon: 0.50, coffee: 0.62, pigeonpeas: 0.48,
    kidneybeans: 0.50,
  };
  const retention = RAIN_RETENTION[crop] ?? 0.55;
  const rainContrib = Math.min(totalWaterNeed, Math.round(rainfall * retention));
  const irrigNeed = Math.max(0, totalWaterNeed - rainContrib);

  // BUG 5 FIX: irrigDaysPerWeek was driven by totalWaterNeed (crop demand),
  // NOT irrigNeed (actual deficit after rain). This caused lentil in 1194mm rainfall
  // to show "Every 7-10 Days" even though irrigNeed=0 and no irrigation is needed at all.
  // Now both irrigDaysPerWeek and frequency are based on the actual deficit.
  const irrigDaysPerWeek =
    irrigNeed === 0    ? 0
    : irrigNeed < 80   ? 1
    : irrigNeed < 300  ? 1
    : irrigNeed < 600  ? 2
    : irrigNeed < 1000 ? 3
    : 4;

  const frequency =
    irrigNeed === 0    ? 'Rainfall Sufficient'
    : irrigNeed < 80   ? 'Monitor Only'
    : irrigNeed < 300  ? 'Every 7-10 Days'
    : irrigNeed < 600  ? 'Every 4-6 Days'
    : irrigNeed < 1000 ? 'Every 2-3 Days'
    : 'Every 1-2 Days';

  // Derived labels for KPI card (used in render)
  const irrigClassLabel =
    irrigNeed === 0    ? 'Rain-fed (No Deficit)'
    : irrigNeed < 80   ? `Minimal (${irrigNeed} mm)`
    : irrigNeed < 300  ? `Low (${irrigNeed} mm)`
    : irrigNeed < 600  ? `Moderate (${irrigNeed} mm)`
    : irrigNeed < 1000 ? `High (${irrigNeed} mm)`
    : `Very High (${irrigNeed} mm)`;

  const irrigClassColor =
    irrigNeed === 0   ? 'text-teal-light'
    : irrigNeed < 300 ? 'text-teal-light'
    : irrigNeed < 600 ? 'text-orange'
    : 'text-danger';

  // BUG 3 FIX: old formula produced ~94-96% for ALL wet districts+all crops because:
  // when irrigNeed=0, rainContrib always equals totalWaterNeed → first term always =60,
  // humidity 80-87% → second term ≈24-26, temp ≈10. Total always ~94-96, never changes.
  // New 4-factor formula gives differentiated values per crop × district combination:
  //   Factor 1 (40%): rain coverage of crop demand
  //   Factor 2 (30%): humidity-driven soil moisture potential
  //   Factor 3 (20%): thermal comfort score (penalise <15°C or >35°C)
  //   Factor 4 (10%): drought-tolerant crops score higher when deficit exists
  const DROUGHT_TOLERANCE = {
    rice: 0.1, banana: 0.1, coconut: 0.2, jute: 0.3, cotton: 0.4,
    maize: 0.5, mango: 0.5, papaya: 0.5, grapes: 0.5, watermelon: 0.5,
    muskmelon: 0.5, orange: 0.5, apple: 0.5, pomegranate: 0.6,
    chickpea: 0.7, lentil: 0.8, blackgram: 0.75, mungbean: 0.75,
    mothbeans: 0.9, pigeonpeas: 0.85, kidneybeans: 0.7, coffee: 0.4,
  };
  const tolerancePct      = DROUGHT_TOLERANCE[crop] ?? 0.5;
  const rainCovFactor     = Math.min(1, rainContrib / Math.max(totalWaterNeed, 1)) * 40;
  const soilMoistFactor   = (humidity / 100) * 30;
  const tempScore         = Math.max(0, 1 - Math.abs(temperature - 25) / 25) * 20;
  const sensitivityBonus  = irrigNeed === 0
    ? 10
    : tolerancePct * (1 - Math.min(1, irrigNeed / totalWaterNeed)) * 10;
  const moistureIndex = Math.round(
    Math.min(99, Math.max(10, rainCovFactor + soilMoistFactor + tempScore + sensitivityBonus))
  );

  const dailyMm = irrigNeed > 0
    ? Math.max(5, Math.min(50, Math.round(irrigNeed / 52)))
    : 0;

  const hasRain = rainfall > 1400;
  
  const waterSavingsPct = totalWaterNeed === 0 ? 100
    : Math.min(99, Math.round((rainContrib / totalWaterNeed) * 100));
  const seasonalBudgetCards = [
    { label: 'Cumulative Hydration', value: `${totalWaterNeed} mm`, 
      desc: 'Estimated seasonal crop water consumption (ET-adjusted).' },
    { label: 'Rain Contribution',    value: `${rainContrib} mm`,    
      desc: `Precipitation retained by roots (${Math.round(retention*100)}% retention rate).` },
    { label: 'Irrigation Need',      value: `${irrigNeed} mm`,      
      desc: 'Deficit to be supplied by active irrigation.' },
    { label: 'Rain Coverage',        value: `${waterSavingsPct}%`,  
      desc: 'Percentage of crop water need met by rainfall alone.' },
  ];
  const GROWTH_STAGES = {
  rice: [
    { stage: 'Nursery & Transplanting', days: '1-25', water: 'Maintain standing water', active: false },
    { stage: 'Tillering', days: '26-55', water: '2-5 cm water depth', active: true },
    { stage: 'Panicle Initiation', days: '56-85', water: 'Critical irrigation stage', active: false },
    { stage: 'Grain Filling', days: '86-120', water: 'Reduce before harvest', active: false },
  ],

  maize: [
    { stage: 'Emergence', days: '1-15', water: 'Light irrigation', active: false },
    { stage: 'Vegetative Growth', days: '16-45', water: 'Every 7-10 days', active: true },
    { stage: 'Tasseling & Silking', days: '46-75', water: 'Most critical stage', active: false },
    { stage: 'Grain Fill', days: '76-110', water: 'Maintain moisture', active: false },
  ],

  chickpea: [
    { stage: 'Germination', days: '1-10', water: 'Pre-sowing irrigation only', active: false },
    { stage: 'Vegetative', days: '11-40', water: 'One irrigation if needed', active: false },
    { stage: 'Flowering', days: '41-65', water: 'Critical — light irrigation', active: true },
    { stage: 'Pod Fill', days: '66-95', water: 'One irrigation; avoid excess', active: false },
  ],

  kidneybeans: [
    { stage: 'Emergence', days: '1-12', water: 'Light irrigation', active: false },
    { stage: 'Vegetative', days: '13-35', water: 'Every 10 days', active: true },
    { stage: 'Flowering', days: '36-60', water: 'Critical irrigation', active: false },
    { stage: 'Pod Development', days: '61-90', water: 'Moderate irrigation', active: false },
  ],

  pigeonpeas: [
    { stage: 'Establishment', days: '1-25', water: 'Light irrigation', active: false },
    { stage: 'Vegetative', days: '26-90', water: 'Low irrigation need', active: false },
    { stage: 'Flowering', days: '91-130', water: 'Critical stage', active: true },
    { stage: 'Pod Fill', days: '131-180', water: 'Maintain moisture', active: false },
  ],

  mothbeans: [
    { stage: 'Germination', days: '1-10', water: 'Minimal irrigation', active: false },
    { stage: 'Vegetative', days: '11-35', water: 'Rainfed preferred', active: false },
    { stage: 'Flowering', days: '36-55', water: 'One irrigation', active: true },
    { stage: 'Pod Development', days: '56-80', water: 'Avoid excess water', active: false },
  ],

  mungbean: [
    { stage: 'Emergence', days: '1-10', water: 'Light irrigation', active: false },
    { stage: 'Vegetative', days: '11-30', water: 'Low irrigation need', active: false },
    { stage: 'Flowering', days: '31-50', water: 'Critical irrigation', active: true },
    { stage: 'Pod Filling', days: '51-70', water: 'Moderate moisture', active: false },
  ],

  blackgram: [
    { stage: 'Establishment', days: '1-10', water: 'Light irrigation', active: false },
    { stage: 'Vegetative', days: '11-35', water: 'Minimal irrigation', active: false },
    { stage: 'Flowering', days: '36-55', water: 'Critical stage', active: true },
    { stage: 'Pod Fill', days: '56-80', water: 'Moderate irrigation', active: false },
  ],

  lentil: [
    { stage: 'Germination', days: '1-12', water: 'Pre-sowing irrigation', active: false },
    { stage: 'Vegetative', days: '13-45', water: 'Low irrigation need', active: false },
    { stage: 'Flowering', days: '46-70', water: 'Critical irrigation', active: true },
    { stage: 'Pod Fill', days: '71-100', water: 'One irrigation', active: false },
  ],

  banana: [
    { stage: 'Planting', days: '1-30', water: 'Daily drip 4L/plant', active: false },
    { stage: 'Vegetative Growth', days: '31-120', water: 'Drip every 2 days; 8L/plant', active: true },
    { stage: 'Bunch Initiation', days: '121-210', water: 'Critical — never let soil dry', active: false },
    { stage: 'Harvest Readiness', days: '211-270', water: 'Reduce; stop 15 days before harvest', active: false },
  ],

  mango: [
    { stage: 'Post-Harvest Recovery', days: '1-60', water: 'No irrigation; rest period', active: false },
    { stage: 'Flowering Induction', days: '61-120', water: 'Stress period — withhold water', active: false },
    { stage: 'Fruit Set', days: '121-180', water: 'Resume irrigation; drip daily', active: true },
    { stage: 'Fruit Development', days: '181-270', water: 'Reduce before harvest', active: false },
  ],

  grapes: [
    { stage: 'Bud Break', days: '1-30', water: 'Regular drip irrigation', active: false },
    { stage: 'Flowering', days: '31-60', water: 'Critical moisture stage', active: true },
    { stage: 'Berry Development', days: '61-120', water: 'Maintain moisture', active: false },
    { stage: 'Ripening', days: '121-150', water: 'Reduce irrigation', active: false },
  ],

  watermelon: [
    { stage: 'Establishment', days: '1-15', water: 'Light irrigation', active: false },
    { stage: 'Vine Growth', days: '16-40', water: 'Regular irrigation', active: true },
    { stage: 'Fruit Set', days: '41-65', water: 'Critical stage', active: false },
    { stage: 'Ripening', days: '66-90', water: 'Reduce irrigation', active: false },
  ],

  muskmelon: [
    { stage: 'Germination', days: '1-12', water: 'Light irrigation', active: false },
    { stage: 'Vine Growth', days: '13-40', water: 'Moderate irrigation', active: true },
    { stage: 'Fruit Development', days: '41-70', water: 'Critical moisture', active: false },
    { stage: 'Ripening', days: '71-90', water: 'Reduce irrigation', active: false },
  ],

  apple: [
    { stage: 'Dormancy Break', days: '1-40', water: 'Light irrigation', active: false },
    { stage: 'Flowering', days: '41-70', water: 'Critical stage', active: true },
    { stage: 'Fruit Set', days: '71-140', water: 'Regular irrigation', active: false },
    { stage: 'Fruit Maturity', days: '141-210', water: 'Reduce irrigation', active: false },
  ],

  orange: [
    { stage: 'Vegetative Flush', days: '1-60', water: 'Moderate irrigation', active: false },
    { stage: 'Flowering', days: '61-120', water: 'Critical stage', active: true },
    { stage: 'Fruit Set', days: '121-210', water: 'Maintain moisture', active: false },
    { stage: 'Maturity', days: '211-300', water: 'Reduce irrigation', active: false },
  ],

  papaya: [
    { stage: 'Establishment', days: '1-45', water: 'Frequent irrigation', active: false },
    { stage: 'Vegetative Growth', days: '46-120', water: 'Every 3 days', active: true },
    { stage: 'Flowering', days: '121-180', water: 'Critical stage', active: false },
    { stage: 'Fruit Development', days: '181-270', water: 'Maintain moisture', active: false },
  ],

  coconut: [
    { stage: 'Establishment', days: '1-180', water: 'Weekly irrigation', active: false },
    { stage: 'Vegetative Growth', days: '181-365', water: 'Regular irrigation', active: true },
    { stage: 'Nut Formation', days: '366-540', water: 'Critical moisture', active: false },
    { stage: 'Nut Development', days: '541-720', water: 'Maintain moisture', active: false },
  ],

  cotton: [
    { stage: 'Sowing & Germination', days: '1-15', water: 'Light irrigation at sowing', active: false },
    { stage: 'Vegetative (Square)', days: '16-60', water: 'Every 10 days; critical period', active: true },
    { stage: 'Boll Formation', days: '61-100', water: 'Most critical — maintain moisture', active: false },
    { stage: 'Boll Opening', days: '101-150', water: 'Stop irrigation before harvest', active: false },
  ],

  jute: [
    { stage: 'Establishment', days: '1-20', water: 'Adequate moisture', active: false },
    { stage: 'Rapid Growth', days: '21-70', water: 'Critical irrigation stage', active: true },
    { stage: 'Fiber Development', days: '71-110', water: 'Maintain moisture', active: false },
    { stage: 'Maturity', days: '111-130', water: 'Reduce irrigation', active: false },
  ],

  coffee: [
    { stage: 'Flower Initiation', days: '1-45', water: 'Blossom irrigation', active: false },
    { stage: 'Fruit Set', days: '46-120', water: 'Critical irrigation', active: true },
    { stage: 'Bean Development', days: '121-240', water: 'Maintain moisture', active: false },
    { stage: 'Ripening', days: '241-300', water: 'Reduce irrigation', active: false },
  ],

  pomegranate: [
    { stage: 'Pruning Recovery', days: '1-30', water: 'Light irrigation', active: false },
    { stage: 'Flowering', days: '31-90', water: 'Critical stage', active: true },
    { stage: 'Fruit Development', days: '91-180', water: 'Moderate irrigation', active: false },
    { stage: 'Ripening', days: '181-240', water: 'Reduce irrigation', active: false },
  ]
};
  const currentMonth = new Date().getMonth() + 1;
  const CROP_SEASON_START = {
    rice: 6, maize: 6, cotton: 5, jute: 4,
    banana: 2, mango: 3, grapes: 1,
    watermelon: 2, muskmelon: 2, papaya: 3,
    orange: 3, apple: 3, pomegranate: 2,
    coconut: 6, coffee: 4,
    chickpea: 11, lentil: 11,
    mothbeans: 7, mungbean: 7, blackgram: 7,
    pigeonpeas: 6, kidneybeans: 6,
  };

  const seasonStartMonth = CROP_SEASON_START[crop] ?? 6;
  let monthsElapsed = (currentMonth - seasonStartMonth + 12) % 12;
  monthsElapsed = Math.min(monthsElapsed, 11);

  // BUG 2 FIX: old code produced estimatedDayInSeason = 7*30+15 = 225 for lentil in June
  // (season starts Nov, 7 months elapsed). Lentil's last stage ends at day 100, so
  // day 225 matches NO stage → fallback always fires → always shows "Pod Fill" active
  // regardless of crop or month. Fix: clamp estimated day to the crop's total season length.
  const rawStages = GROWTH_STAGES[crop] ?? GROWTH_STAGES['rice'];
  const lastStageParts    = rawStages[rawStages.length - 1].days.split('-').map(Number);
  const totalSeasonDays   = lastStageParts[1] ?? lastStageParts[0] + 30;
  const estimatedDayInSeason = Math.min(
    Math.max(1, monthsElapsed * 30 + 15),
    totalSeasonDays   // clamp so we never fall off the end of the stage list
  );

  const growthStages = rawStages.map((stage) => {
    const parts = stage.days.split('-').map(Number);
    const startDay = parts[0];
    const endDay   = parts[1] ?? parts[0] + 30;
    const isCurrentStage =
      estimatedDayInSeason >= startDay && estimatedDayInSeason <= endDay;
    return { ...stage, active: isCurrentStage };
  });

  // Fallback: if NO stage is active (e.g., estimatedDay > all ranges),
  // mark the last stage as active so UI always shows something highlighted
  const anyActive = growthStages.some(s => s.active);
  if (!anyActive && growthStages.length > 0) {
    growthStages[growthStages.length - 1] = {
      ...growthStages[growthStages.length - 1],
      active: true,
    };
  }
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Active stage (used for stage-aware schedule tile text)
  const activeStage = growthStages.find(s => s.active) ?? growthStages[0];

const weeklySchedule = useMemo(() => {
  // BUG 1 FIX: when irrigNeed===0, ALL 7 tiles showed identical "Rain-fed — no irrigation needed"
  // because the branch returned the same object for every day.
  // New: interleave "Monitor" tiles every 3rd day so tiles carry useful, varied information.
  if (irrigNeed === 0) {
    return DAY_LABELS.map((day, idx) => {
      const isMonitorDay = idx % 3 === 0;
      return {
        day,
        water: false,
        icon: isMonitorDay ? '🔍' : '🌧️',
        text: isMonitorDay
          ? `Monitor: ${activeStage?.water ?? 'Check soil'}`
          : 'Rain-fed — no irrigation needed',
      };
    });
  }

  // BUG 1 FIX (minimal deficit): new bracket for 1–79 mm shows mid-week supplemental only
  if (irrigNeed < 80) {
    return DAY_LABELS.map((day, idx) => {
      const isSupplemental = idx === 3;
      return {
        day,
        water: isSupplemental,
        icon: isSupplemental ? '💧' : '🌤️',
        text: isSupplemental
          ? `Supplemental ~${dailyMm}mm if no rain`
          : 'Skip if rainfall > 5mm',
      };
    });
  }

  // BUG 6 FIX: irrigation tiles were identical "Irrigate ~Xmm" / "Rest day" for all crops.
  // Now irrigation tiles reference the active growth stage action for context.
  const interval = 7 / irrigDaysPerWeek;
  const irrigationDays = new Set(
    Array.from({ length: irrigDaysPerWeek }, (_, i) => Math.round(i * interval) % 7)
  );

  return DAY_LABELS.map((day, idx) => {
    const isIrrigationDay = irrigationDays.has(idx);
    return {
      day,
      water: isIrrigationDay,
      icon:  isIrrigationDay ? '💧' : '🌱',
      text:  isIrrigationDay
        ? `~${dailyMm}mm — ${activeStage?.water ?? 'irrigate now'}`
        : 'Monitor soil moisture',
    };
  });
}, [irrigDaysPerWeek, dailyMm, irrigNeed, activeStage]);
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 border border-border p-6 rounded-3xl flex flex-col gap-2">
        <span className="badge badge-teal w-fit uppercase tracking-widest text-[9px]">HYDROLOGICAL INTEGRITY</span>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">{t('title.irrigation_management', 'Precision Hydration Blueprint')}</h2>
        <p className="text-sm text-white">Dynamic scheduling designed to match moisture requirements, balancing active precipitation levels.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* BUG 4 FIX: was "Water Class" based on crop TOTAL need (always "Very Low" for lentil).
            Now shows actual irrigation DEFICIT class + crop demand as sub-label. */}
        <div className="kpi-card flex flex-col gap-2 justify-between">
          <span className="text-[10px] font-bold text-text-secondary uppercase">Irrigation Deficit Class</span>
          <span className={`text-lg font-extrabold ${irrigClassColor}`}>{irrigClassLabel}</span>
          <span className="text-[10px] text-text-muted">Crop demand: {cropWaterClass} ({totalWaterNeed} mm)</span>
        </div>
        {/* BUG 5 FIX: frequency colour was always text-orange even when irrigNeed=0 (no irrigation needed).
            Now colour reflects actual need: teal=fine, orange=action needed. */}
        <div className="kpi-card flex flex-col gap-2 justify-between">
          <span className="text-[10px] font-bold text-text-secondary uppercase">Optimal Interval</span>
          <span className={`text-lg font-extrabold ${irrigNeed === 0 ? 'text-teal-light' : irrigNeed < 300 ? 'text-teal-light' : 'text-orange'}`}>{frequency}</span>
          <span className="text-[10px] text-text-muted">
            {irrigNeed === 0 ? 'Rain covers 100% of demand' : `${irrigDaysPerWeek} session${irrigDaysPerWeek !== 1 ? 's' : ''}/week × ~${dailyMm}mm`}
          </span>
        </div>
        {/* BUG 3 FIX: progress bar colour was always bg-teal regardless of index value */}
        <div className="kpi-card flex flex-col gap-3">
          <span className="text-[10px] font-bold text-text-secondary uppercase">Moisture Profile Index</span>
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-extrabold text-text-primary">{moistureIndex}%</span>
            <span className="text-[10px] text-text-muted">{moistureIndex >= 80 ? 'Well-hydrated' : moistureIndex >= 55 ? 'Adequate' : 'Stressed'}</span>
          </div>
          <div className="progress-bar">
            <div className={`progress-bar-fill ${moistureIndex >= 75 ? 'bg-teal' : moistureIndex >= 50 ? 'bg-orange' : 'bg-danger'}`} style={{ width: `${moistureIndex}%` }}></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-1.5"><FaHistory className="text-teal" /> Moisture Development</h3>
          <div className="relative border-l border-border pl-6 space-y-6">
            {growthStages.map((stage, idx) => (
              <div key={idx} className="relative">
                <div className={`absolute -left-[30px] top-0.5 h-4 w-4 rounded-full border-2 bg-surface-card flex items-center justify-center ${stage.active ? 'border-teal animate-pulse-glow bg-teal/10' : 'border-border'}`}>
                  {stage.active && <div className="h-1.5 w-1.5 rounded-full bg-teal-light"></div>}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${stage.active ? 'text-teal-light' : 'text-text-primary'}`}>{stage.stage}</span>
                    <span className="text-[10px] font-bold text-text-muted uppercase">Days: {stage.days}</span>
                  </div>
                  <span className="text-[10px] text-text-secondary">{stage.water}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 glass-card p-6 flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-1.5"><FaCalendarAlt className="text-orange" /> Weekly Hydration Schedule</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {weeklySchedule.map((item, idx) => (
              <div key={idx} className={`kpi-card p-3 flex flex-col items-center justify-center gap-2 border text-center ${item.water ? 'border-teal/30 bg-teal/5' : 'border-border bg-surface'}`}>
                <span className="text-[10px] font-bold text-text-secondary uppercase">{item.day}</span>
                <span className="text-xl">{item.icon}</span>
                <span className="text-[8px] font-semibold text-text-primary leading-tight line-clamp-2 h-6">{item.text}</span>
              </div>
            ))}
          </div>
          {/* BUG 2 FIX: show which stage is currently active so user knows why tiles say what they say */}
          {activeStage && (
            <div className="flex items-start gap-2 bg-surface border border-border/60 rounded-xl p-3 mt-1">
              <span className="text-teal text-xs mt-0.5">💧</span>
              <p className="text-[10px] text-text-secondary leading-relaxed">
                <span className="font-bold text-text-primary">Current stage: {activeStage.stage}</span>
                {' — '}{activeStage.water}. Season day ≈ {estimatedDayInSeason}.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-4 glass-card p-6 flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-1.5"><FaBriefcase className="text-teal" /> Water Budget Analysis</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {seasonalBudgetCards.map((card, idx) => (
              <div key={idx} className="bg-surface p-4 rounded-xl border border-border/80 flex flex-col gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary">{card.label}</span>
                <span className="text-lg font-extrabold text-teal-light">{card.value}</span>
                <p className="text-[9px] text-text-muted leading-tight">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gradient-to-br from-teal-950/20 to-surface-card border border-teal-500/20 p-5 rounded-2xl flex flex-col justify-center gap-2">
          <h4 className="text-xs font-bold text-teal-light flex items-center gap-1.5 uppercase tracking-wider"><FaInfoCircle /> Advisory</h4>
          <p className="text-[9px] text-text-secondary leading-relaxed">
            {irrigNeed === 0
              ? `Rainfall (${rainfall}mm) fully covers ${selectedCrop} water needs — no active irrigation required this season.`
              : irrigNeed < 150
              ? `Low deficit of ${irrigNeed}mm detected. Light supplemental irrigation on dry spells only. Skip on any rain >8mm/day.`
              : irrigNeed < 400
              ? `Moderate deficit of ${irrigNeed}mm. Apply ~${dailyMm}mm per session on scheduled days. Pause if rainfall exceeds 12mm over 48 hours.`
              : `High deficit of ${irrigNeed}mm — ${selectedCrop} requires consistent irrigation in ${selectedDistrict || 'this district'}. Prefer drip over flood to reduce runoff by up to 40%.`
            }
          </p>
        </div>
      </div>
    </div>
  );
}

// --- PAGE 5: WeatherAdvisory ---
function WeatherAdvisory() {
  const { t } = useLanguage();
  
  const { weatherValues, selectedCrop, forecastData, cropDefaults } = useApp();
  const temp = weatherValues?.temperature || 28;
  const humidity = weatherValues?.humidity || 70;
  const rainfall = weatherValues?.rainfall || 1050;
  const ph = cropDefaults?.ph || weatherValues?.ph || 6.5;

  const heatStress = temp > 35 ? 'Severe Heat Stress' : temp > 30 ? 'Moderate Heat Stress' : 'Optimal range';
  const evapotranspiration = Math.round((temp * 0.15 + 1.2) * 10) / 10;
  const gdd = Math.max(0, Math.round((temp - 10) * 1.5));
  const frostRisk = temp < 4 ? 'High Frost Risk' : 'Zero Frost Risk';

  let stressLevel = 'optimal';
  let stressMessage = 'Thermal levels are ideal for crop development.';
  let bannerClass = 'from-teal-950/20 border-teal-500/20 text-teal-light bg-teal/5';

  if (temp > 33) {
    stressLevel = 'heat-stress';
    stressMessage = 'Elevated temperatures detected. Watch soil moisture depletion.';
    bannerClass = 'from-red-950/20 border-danger/20 text-danger bg-danger/5';
  } else if (temp < 12) {
    stressLevel = 'cold-stress';
    stressMessage = 'Cool metabolic temperatures. Crop growth will decelerate.';
    bannerClass = 'from-blue-950/20 border-blue-500/20 text-blue-400 bg-blue/5';
  }

  const daysForecast = forecastData
    ? forecastData.dates.map((date, i) => ({
        day: new Date(date).toLocaleDateString('en', {weekday: 'short'}),
        icon: forecastData.precipitation[i] > 20 ? '🌧️' : forecastData.precipitation[i] > 5 ? '🌦️' : '☀️',
        tempMin: Math.round(forecastData.temp_min[i]),
        tempMax: Math.round(forecastData.temp_max[i]),
        rain: Math.round(forecastData.precipitation[i])
      }))
    : [
        { day: 'Mon', icon: '☀️', tempMin: 22, tempMax: 30, rain: 0 },
        { day: 'Tue', icon: '🌤️', tempMin: 23, tempMax: 31, rain: 2 },
        { day: 'Wed', icon: '🌦️', tempMin: 22, tempMax: 29, rain: 15 },
        { day: 'Thu', icon: '🌧️', tempMin: 20, tempMax: 27, rain: 45 },
        { day: 'Fri', icon: '🌦️', tempMin: 21, tempMax: 28, rain: 10 },
        { day: 'Sat', icon: '🌤️', tempMin: 23, tempMax: 30, rain: 5 },
        { day: 'Sun', icon: '☀️', tempMin: 24, tempMax: 32, rain: 0 }
      ];

  return (
    <div className="flex flex-col gap-6">
      <div className={`bg-gradient-to-r ${bannerClass} border p-6 rounded-3xl flex items-start gap-4 relative overflow-hidden`}>
        <div className="p-3.5 rounded-2xl bg-surface/50 border border-border shrink-0 text-xl"><FaExclamationTriangle /></div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest">Environmental Status</span>
          <h2 className="text-lg font-bold text-text-primary capitalize">{stressLevel.replace('-', ' ')} Alert</h2>
          <p className="text-xs text-text-secondary leading-relaxed">{stressMessage}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6 flex flex-col gap-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-1.5"><FaCloudSun className="text-teal" /> Environmental Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="kpi-card flex flex-col gap-1">
              <span className="text-[9px] font-bold text-text-secondary uppercase">Air Temperature</span>
              <span className="text-xl font-extrabold text-text-primary">{temp}°C</span>
            </div>
            <div className="kpi-card flex flex-col gap-1">
              <span className="text-[9px] font-bold text-text-secondary uppercase">Relative Humidity</span>
              <span className="text-xl font-extrabold text-text-primary">{humidity}%</span>
            </div>
            <div className="kpi-card flex flex-col gap-1">
              <span className="text-[9px] font-bold text-text-secondary uppercase">Precipitation</span>
              <span className="text-xl font-extrabold text-text-primary">{rainfall} mm</span>
            </div>
            <div className="kpi-card flex flex-col gap-1">
              <span className="text-[9px] font-bold text-text-secondary uppercase">Soil pH</span>
              <span className="text-xl font-extrabold text-text-primary">{ph}</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3">Agro-Climatic Indicators</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-surface p-2.5 rounded-xl border border-border">
              <span className="text-xs font-semibold text-text-secondary">Heat Stress</span>
              <span className="text-xs font-bold text-text-primary">{heatStress}</span>
            </div>
            <div className="flex justify-between items-center bg-surface p-2.5 rounded-xl border border-border">
              <span className="text-xs font-semibold text-text-secondary">Evapotranspiration</span>
              <span className="text-xs font-bold text-text-primary">{evapotranspiration} mm/day</span>
            </div>
            <div className="flex justify-between items-center bg-surface p-2.5 rounded-xl border border-border">
              <span className="text-xs font-semibold text-text-secondary">GDD Accumulation</span>
              <span className="text-xs font-bold text-text-primary">{gdd} Units</span>
            </div>
            <div className="flex justify-between items-center bg-surface p-2.5 rounded-xl border border-border">
              <span className="text-xs font-semibold text-text-secondary">Frost Damage Risk</span>
              <span className="text-xs font-bold text-text-primary">{frostRisk}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 flex flex-col gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3">7-Day Predictive Meteorological Outlook</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {daysForecast.map((day, idx) => (
            <div key={idx} className="kpi-card p-4 flex flex-col items-center gap-2 border border-border/80 bg-surface">
              <span className="text-xs font-bold text-text-secondary uppercase">{day.day}</span>
              <span className="text-2xl">{day.icon}</span>
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-text-primary">{day.tempMax}° / {day.tempMin}°</span>
                <span className="text-[9px] font-semibold text-teal-light mt-1">🌧️ {day.rain}mm</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// --- PAGE 6: MarketIntelligence ---
function MarketIntelligence() {
  const { t } = useLanguage();
  const {
    encoders,
    selectedDistrict,
    marketResult,
    runMarketPrediction,
    loading,
    error,
  } = useApp();

  // ── ALL useState hooks MUST be declared first, before any useEffect or JSX ──
  const [market, setMarket] = useState('');
  const [commodity, setCommodity] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));

  // ── Auto-set commodity when crop changes ──────────────────────────────────
  useEffect(() => {
    if (encoders.markets?.length > 0 && !market) {
      setMarket(encoders.markets[0]);
    }
    if (encoders.commodities?.length > 0 && !commodity) {
      setCommodity(encoders.commodities[0]);  // just pick first commodity
    }
  }, [encoders]);

  const handleSubmit = async () => {
    // No district gate — backend handles all districts via nearest-neighbour fallback
    await runMarketPrediction({
      district: (selectedDistrict || 'East Godavari').toLowerCase(),
      market,
      commodity,
      year: parseInt(year),
      month: parseInt(month),
    });
  };
  const COMMODITY_HOLD_THRESHOLD = {
  'Maize':                       2000,
  'Arhar (Tur/Red Gram)(Whole)': 5500,
  'Green Gram (Moong)(Whole)':   6000,
  'Lentil (Masur)(Whole)':       6000,
  'Banana':                      2000,
  'Mango':                       3500,
  'Apple':                       8000,
  'Cotton':                      6500,
  };
  const holdThreshold = COMMODITY_HOLD_THRESHOLD[commodity] ?? 3200;
  const hasResult = marketResult && marketResult.success;
  const minPrice = hasResult ? marketResult.predictions.market_price.min_price_inr_per_quintal : '--';
  const maxPrice = hasResult ? marketResult.predictions.market_price.max_price_inr_per_quintal : '--';
  const modalPrice = hasResult ? marketResult.predictions.market_price.modal_price_inr_per_quintal : '--';
  
  const actionRecommendation = hasResult
  ? (modalPrice > holdThreshold ? 'HOLD STOCK (Rising Demand)' : 'SELL NOW (Peak Level)')
  : 'Run Prediction';
  const isFallback        = hasResult && marketResult.is_fallback;
  const fallbackDistrict  = hasResult ? marketResult.fallback_district : null;
  const confidencePenalty = hasResult ? (marketResult.fallback_confidence_penalty || 0) : 0;
  const confidence = hasResult ? Math.max(0, (modalPrice > holdThreshold ? 82 : 75) - confidencePenalty) : 0;

  const comparisonMandis = hasResult ? (() => {
  const dist = (selectedDistrict || '').toLowerCase();
  const isNorth = ['punjab','haryana','uttar pradesh','bihar','rajasthan'].some(s => dist.includes(s.split(' ')[0]));
  const isSouth = ['telangana','andhra','karnataka','tamil','kerala'].some(s => dist.includes(s.split(' ')[0]));
  const isEast  = ['west bengal','odisha','jharkhand','assam'].some(s => dist.includes(s.split(' ')[0]));
  const nearby = isNorth
      ?[{ name: `${selectedDistrict} District Mandi`, price: Math.round(modalPrice - 80),  trans: '₹60/q',  net: Math.round(modalPrice - 140), label: 'Local' },
        { name: 'Azadpur Wholesale Market',           price: Math.round(modalPrice + 180), trans: '₹160/q', net: Math.round(modalPrice + 20),  label: 'Highest Gross' },
        { name: 'Narela Grain Market',                price: Math.round(modalPrice + 90),  trans: '₹80/q',  net: Math.round(modalPrice + 10),  label: 'Optimal Net' }]
      : isSouth
      ? [{ name: `${selectedDistrict} Local Mandi`,    price: Math.round(modalPrice - 120), trans: '₹80/q',  net: Math.round(modalPrice - 200), label: 'Local' },
         { name: 'Koyambedu Wholesale Market',         price: Math.round(modalPrice + 210), trans: '₹140/q', net: Math.round(modalPrice + 70),  label: 'Highest Gross' },
         { name: 'Bowenpally Market',                  price: Math.round(modalPrice + 80),  trans: '₹90/q',  net: Math.round(modalPrice - 10),  label: 'Optimal Net' }]
      : isEast
      ? [{ name: `${selectedDistrict} Block Mandi`,    price: Math.round(modalPrice - 90),  trans: '₹70/q',  net: Math.round(modalPrice - 160), label: 'Local' },
         { name: 'Mechua Fruit Market Kolkata',        price: Math.round(modalPrice + 200), trans: '₹150/q', net: Math.round(modalPrice + 50),  label: 'Highest Gross' },
         { name: 'Dankuni Mandi',                      price: Math.round(modalPrice + 70),  trans: '₹85/q',  net: Math.round(modalPrice - 15),  label: 'Optimal Net' }]
      : [{ name: `${selectedDistrict} District Mandi`, price: Math.round(modalPrice - 100), trans: '₹75/q',  net: Math.round(modalPrice - 175), label: 'Local' },
         { name: 'Nearest State Mandi',                price: Math.round(modalPrice + 190), trans: '₹130/q', net: Math.round(modalPrice + 60),  label: 'Highest Gross' },
         { name: 'Regional Hub Market',                price: Math.round(modalPrice + 85),  trans: '₹95/q',  net: Math.round(modalPrice - 10),  label: 'Optimal Net' }];
    return nearby;
  })() : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 border border-border p-6 rounded-3xl flex flex-col gap-2">
        <span className="badge badge-teal w-fit uppercase tracking-widest text-[9px]">MARKET VALUE ENGINE</span>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">{t('title.market_prediction', 'Precision Mandi Analytics')}</h2>
        <p className="text-sm text-white">Analyze Mandi spot market rates, compare trade margins, and run seasonal crop pricing analytics.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 flex flex-col gap-5 h-fit">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-1.5"><FaStore className="text-teal" /> Parameters</h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-2">District</label>
              <input type="text" value={selectedDistrict || ''} disabled className="input-field uppercase bg-surface-elevated/40 text-text-muted font-bold" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-2">Target Mandi</label>
              <select value={market} onChange={(e) => setMarket(e.target.value)} className="select-field capitalize">
                {encoders.markets?.map((m) => <option key={m} value={m} className="bg-surface capitalize">{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-2">Commodity</label>
              <select value={commodity} onChange={(e) => setCommodity(e.target.value)} className="select-field">
                <option value="">-- Select Commodity --</option>
                 {encoders.commodities?.map((c) => (
                <option key={c} value={c} className="bg-surface">{c}</option>
              ))}
             </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-2">Year</label>
                <select value={year} onChange={(e) => setYear(e.target.value)} className="select-field">
                {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 3 + i).map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-2">Month</label>
                <select value={month} onChange={(e) => setMonth(e.target.value)} className="select-field">
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !market || !commodity}
              className="btn-primary w-full py-3.5 mt-2 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
            {loading
              ? <span className="loading-spinner"></span>
              : <>{t('button.predict_market', 'Predict Price')} <FaArrowRight /></>
            }
            </button>
            {error && (
              <div className="bg-danger/10 border border-danger/20 text-danger text-xs p-3 rounded-xl font-semibold mt-2">
                ⚠ {error}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="kpi-card flex flex-col gap-1 border-l-4 border-l-success">
              <span className="text-[10px] font-bold text-text-secondary uppercase">Mandi Minimum</span>
              <span className="text-xl font-extrabold text-success">₹{minPrice}</span>
            </div>
            <div className="kpi-card flex flex-col gap-1 border-l-4 border-l-teal">
              <span className="text-[10px] font-bold text-text-secondary uppercase">Mandi Modal</span>
              <span className="text-2xl font-extrabold text-teal-light">₹{modalPrice}</span>
            </div>
            <div className="kpi-card flex flex-col gap-1 border-l-4 border-l-orange">
              <span className="text-[10px] font-bold text-text-secondary uppercase">Mandi Maximum</span>
              <span className="text-xl font-extrabold text-orange">₹{maxPrice}</span>
            </div>
          </div>

          {isFallback && (
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
              <FaExclamationTriangle className="text-warning shrink-0 mt-0.5" size={14} />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-extrabold text-warning uppercase tracking-wider">
                  Estimated — Nearest Agricultural Region Used
                </span>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  <span className="font-bold text-text-primary capitalize">{selectedDistrict}</span> is not
                  directly covered by the market model. Prices are estimated using{' '}
                  <span className="font-bold text-teal-light capitalize">{fallbackDistrict}</span>, the nearest
                  supported agricultural region. Confidence is reduced accordingly.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-1.5"><FaUserCheck className="text-teal" /> AI Recommendation</h3>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-extrabold text-teal-light uppercase">{actionRecommendation}</span>
                  <span className="text-[10px] font-bold text-text-muted">{confidence}% Confidence</span>
                </div>
                <div className="progress-bar"><div className="progress-bar-fill bg-teal" style={{ width: `${confidence}%` }}></div></div>
              </div>
            </div>
            <div className="glass-card p-6 flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-1.5"><FaChartBar className="text-orange" /> Seasonality Chart</h3>
              <SeasonalityChart commodity={commodity} />
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 flex flex-col gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-1.5"><FaCoins className="text-teal" /> Net Realization Comparison</h3>
        <div className="overflow-x-auto">
          <table className="table-styled">
            <thead>
              <tr>
                <th>Mandi Location</th>
                <th>Spot Price</th>
                <th>Estimated Freight</th>
                <th>Net Realization</th>
                <th>Advisory</th>
              </tr>
            </thead>
            <tbody>
              {comparisonMandis.map((mandi, idx) => (
                <tr key={idx} className={mandi.label.includes('Highest') ? 'bg-teal/5' : ''}>
                  <td className="text-xs font-bold text-text-primary">{mandi.name}</td>
                  <td className="text-xs font-extrabold text-text-primary">₹{mandi.price}</td>
                  <td className="text-xs font-semibold text-text-secondary">{mandi.trans}</td>
                  <td className="text-xs font-extrabold text-teal-light">₹{mandi.net}</td>
                  <td><span className="badge badge-teal text-[8px] uppercase tracking-wider">{mandi.label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
const CROP_COSTS = {
  rice:        { seed: 3000,  fertilizer: 6000,  irrigation: 5000,  labor: 10000 },
  maize:       { seed: 3500,  fertilizer: 5000,  irrigation: 3000,  labor: 7500  },
  chickpea:    { seed: 2000,  fertilizer: 3500,  irrigation: 2000,  labor: 6000  },
  kidneybeans: { seed: 2500,  fertilizer: 3500,  irrigation: 2500,  labor: 6500  },
  pigeonpeas:  { seed: 1800,  fertilizer: 3000,  irrigation: 1800,  labor: 5500  },
  mothbeans:   { seed: 1500,  fertilizer: 2500,  irrigation: 1200,  labor: 4500  },
  mungbean:    { seed: 1800,  fertilizer: 2800,  irrigation: 1500,  labor: 5000  },
  blackgram:   { seed: 1800,  fertilizer: 3000,  irrigation: 1500,  labor: 5000  },
  lentil:      { seed: 2200,  fertilizer: 3500,  irrigation: 2000,  labor: 5500  },
  pomegranate: { seed: 8000,  fertilizer: 5000,  irrigation: 4500,  labor: 10000 },
  banana:      { seed: 12000, fertilizer: 9000,  irrigation: 6000,  labor: 18000 },
  mango:       { seed: 6000,  fertilizer: 4000,  irrigation: 3000,  labor: 8000  },
  grapes:      { seed: 15000, fertilizer: 10000, irrigation: 8000,  labor: 20000 },
  watermelon:  { seed: 4000,  fertilizer: 4500,  irrigation: 3500,  labor: 7000  },
  muskmelon:   { seed: 3500,  fertilizer: 4000,  irrigation: 3000,  labor: 6500  },
  apple:       { seed: 18000, fertilizer: 8000,  irrigation: 6000,  labor: 15000 },
  orange:      { seed: 7000,  fertilizer: 5000,  irrigation: 4000,  labor: 9000  },
  papaya:      { seed: 5000,  fertilizer: 5500,  irrigation: 4000,  labor: 8500  },
  coconut:     { seed: 8000,  fertilizer: 4500,  irrigation: 3500,  labor: 7000  },
  cotton:      { seed: 5000,  fertilizer: 7000,  irrigation: 4000,  labor: 12000 },
  jute:        { seed: 2000,  fertilizer: 4000,  irrigation: 2500,  labor: 8000  },
  coffee:      { seed: 10000, fertilizer: 7000,  irrigation: 5000,  labor: 14000 },
  default:     { seed: 3500,  fertilizer: 5500,  irrigation: 4000,  labor: 8000  },
  };
const CROP_BASE_PRICES = {
  rice: 2183, maize: 2090, chickpea: 5440, kidneybeans: 4500,
  pigeonpeas: 7000, mothbeans: 5400, mungbean: 8558, blackgram: 6950,
  lentil: 6425, pomegranate: 8000, banana: 1800, mango: 3500,
  grapes: 4000, watermelon: 1200, muskmelon: 1500, apple: 8000,
  orange: 3500, papaya: 1500, coconut: 3200, cotton: 6620,
  jute: 5050, coffee: 4800,
};
// --- PAGE 7: YieldCalculator ---
const NATIONAL_AVG_YIELD = {
  rice: 2.6, maize: 3.0, cotton: 0.5, banana: 35,
  mango: 9, grapes: 20, chickpea: 1.0, kidneybeans: 1.2,
  pigeonpeas: 0.9, mothbeans: 0.7, mungbean: 1.0, blackgram: 0.9,
  lentil: 1.0, pomegranate: 15, watermelon: 30, muskmelon: 18,
  apple: 12, orange: 18, papaya: 35, coconut: 9, jute: 2.5,
  coffee: 1.8, default: 2.8,
  };
function YieldCalculator() {
  const { t } = useLanguage();
  const {
  selectedDistrict,
  predictionResult,
  runPrediction,
  loading,
  weatherLoading,
  error,
  forecastData,
  fieldSize,        
  selectedCrop,     
  marketResult,    
} = useApp();
  
  const hasResult = predictionResult && predictionResult.success;
  const yieldPerHa = hasResult ? predictionResult.predictions.yield_prediction.estimated_yield_tonnes_per_ha : 4.8;
  const totalYield = Math.round(yieldPerHa * fieldSize * 10) / 10;  // keep ×10 for one decimal precision only

  const baseRatePerQuintal = CROP_BASE_PRICES[selectedCrop] ?? 2250;
  // 1 tonne = 10 quintals; totalYield in tonnes
  const baseRatePerTonne = baseRatePerQuintal * 10;
  // totalRevenue in Lakhs (÷ 100000)
  const totalRevenue = Math.round((totalYield * baseRatePerTonne) / 1000) / 100;
  // DEFAULT_WEATHER is defined at module scope — no local redeclaration needed
  
  const costModel = useMemo(() => {
    const c = CROP_COSTS[selectedCrop] || CROP_COSTS.default;
    const totalPerHa = c.seed + c.fertilizer + c.irrigation + c.labor;
    return { totalPerHa, totalFieldCost: totalPerHa * fieldSize, breakdown: c };
  }, [fieldSize, selectedCrop]);

  const breakEvenPrice = totalYield > 0 ? Math.round(costModel.totalFieldCost / (totalYield * 10)) : 0;
  const breakEvenYield = baseRatePerTonne > 0
  ? Math.round((costModel.totalFieldCost / baseRatePerTonne) * 10) / 10
  : 0;

  const scenarios = [
    { label: 'Low Demand Scenario', rate: baseRatePerQuintal * 0.85 },
    { label: 'Target / Standard Scenario', rate: baseRatePerQuintal },
    { label: 'Peak Market Scenario', rate: baseRatePerQuintal * 1.25 }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 border border-border p-6 rounded-3xl flex flex-col gap-2">
        <span className="badge badge-teal w-fit uppercase tracking-widest text-[9px]">ECONOMIC PROJECTIONS</span>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">{t('title.yield_scenarios', 'Economic Yield Optimizer')}</h2>
        <p className="text-sm text-white">Analyze total gross crop yields, evaluate break-even metrics, and simulate ROI profits.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-card p-6 flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3"><FaCalculator className="text-teal" /> Adjust Crop Commodities</h3>
            <CropGrid />
          </div>
        </div>
        <div><FieldSlider /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 flex items-center justify-between border-l-4 border-l-teal">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-text-secondary uppercase">Projected Yield</span>
            <span className="text-3xl font-extrabold text-teal-light">{totalYield} <span className="text-xs text-text-secondary font-medium">tonnes</span></span>
          </div>
        </div>
        <div className="glass-card p-6 flex items-center justify-between border-l-4 border-l-orange">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-text-secondary uppercase">Estimated Gross Revenue</span>
            <span className="text-3xl font-extrabold text-orange">₹{totalRevenue} <span className="text-xs text-text-secondary font-medium">Lakhs</span></span>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 flex flex-col gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-1.5"><FaBalanceScale className="text-teal" /> Break-Even Risk Thresholds</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface p-4 rounded-xl border border-border/80 flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase text-text-secondary">Safe Spot Price</span>
            <span className="text-lg font-extrabold text-text-primary">₹{breakEvenPrice} / q</span>
          </div>
          <div className="bg-surface p-4 rounded-xl border border-border/80 flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase text-text-secondary">Safe Yield Output</span>
            <span className={`text-lg font-extrabold ${breakEvenYield > totalYield ? 'text-danger' : 'text-text-primary'}`}>
            {breakEvenYield} tonnes
           </span>
          </div>
          <div className="bg-surface p-4 rounded-xl border border-border/80 flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase text-text-secondary">Net Investment</span>
            <span className="text-lg font-extrabold text-orange">₹{costModel.totalFieldCost.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 flex flex-col gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-1.5"><FaCoins className="text-orange" /> Scenario Margins</h3>
        <div className="overflow-x-auto">
          <table className="table-styled">
            <thead>
              <tr>
                <th>Demand Condition</th>
                <th>Price Rate</th>
                <th>Gross Output</th>
                <th>Net Margin</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((sc, idx) => {
                const grossVal = Math.round((totalYield * sc.rate * 10) / 100000 * 100) / 100;
                const profitVal = Math.round((grossVal - (costModel.totalFieldCost / 100000)) * 100) / 100;
                return (
                  <tr key={idx}>
                    <td className="text-xs font-bold text-text-primary">{sc.label}</td>
                    <td className="text-xs font-extrabold text-text-primary">₹{Math.round(sc.rate)}/q</td>
                    <td className="text-xs font-extrabold text-text-primary">₹{grossVal} Lakhs</td>
                    <td className={`text-xs font-extrabold ${profitVal >= 0 ? 'text-success' : 'text-danger'}`}>{profitVal >= 0 ? '+' : ''}₹{profitVal} Lakhs</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- PAGE 8: FullSeasonReport ---
function FullSeasonReport() {
  const { t } = useLanguage();
  const { predictionResult, selectedCrop, fieldSize, weatherValues, marketResult } = useApp();

  const hasResult = predictionResult && predictionResult.success;
  const temp = weatherValues?.temperature || 28;
  const yieldPerHa = (hasResult && predictionResult.predictions.yield_prediction.estimated_yield_tonnes_per_ha > 0.5)
  ? predictionResult.predictions.yield_prediction.estimated_yield_tonnes_per_ha
  : (NATIONAL_AVG_YIELD[selectedCrop] || NATIONAL_AVG_YIELD.default);
  const totalYield = Math.round(yieldPerHa * fieldSize * 10) / 10;
  const avgYield = NATIONAL_AVG_YIELD[selectedCrop] || NATIONAL_AVG_YIELD.default;
  const yieldPctDifference = Math.round(((yieldPerHa - avgYield) / avgYield) * 100);

  const baseRatePerQuintal = CROP_BASE_PRICES[selectedCrop] ?? 2250;
  const baseRatePerTonne = baseRatePerQuintal * 10;
  const grossRevenue = Math.round((totalYield * baseRatePerTonne));

  const fertBagPrice = predictionResult?.predictions?.fertilizer_price_prediction?.estimated_price_inr ?? 1350;

  const cropCost = CROP_COSTS[selectedCrop] ?? CROP_COSTS.default;
  // Use ML-predicted fertilizer bag price to scale fertilizer cost (assume ~8 bags/ha as baseline)
  const fertCostPerHa = Math.round((fertBagPrice / 1350) * cropCost.fertilizer);
  const expenses = [
     { category: 'Hybrid Seeds',       costPerHa: cropCost.seed },
     { category: 'Soil Fertilization', costPerHa: fertCostPerHa },
     { category: 'Water Systems',      costPerHa: cropCost.irrigation },
     { category: 'Harvest Labor',      costPerHa: cropCost.labor },
  ];

  const totalCost = expenses.reduce((acc, exp) => acc + (exp.costPerHa * fieldSize), 0);
  const netProfit = grossRevenue - totalCost;
  const roi = totalCost > 0 ? Math.round((netProfit / totalCost) * 100) : 0;
  const now = new Date();
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = now.getMonth();
  const sowingMonth = monthNames[m];
  const midMonth = monthNames[(m + 2) % 12];
  const harvestMonth = monthNames[(m + 4) % 12];
  const CROP_EVENTS = {
    rice:    ['Transplanting Done', 'Blast/BPH Risk Window', 'Pre-Harvest Drain'],
    maize:   ['Sowing Completed', 'Fall Armyworm Watch', 'Tasseling Critical Period'],
    cotton:  ['Planting Done', 'Bollworm Watch', 'Boll Maturity'],
    default: ['Sowing Completed', 'Pathology Risk Window', 'Pre-Harvest Window']
  };
  const events = CROP_EVENTS[selectedCrop] || CROP_EVENTS.default;
  const riskTimeline = [
    { date: `${sowingMonth} ${now.getDate()}`,       event: events[0], status: 'Completed', badge: 'badge-success' },
    { date: `${midMonth} 15`,                        event: events[1], status: 'Monitor',   badge: 'badge-warning' },
    { date: `${harvestMonth} 05`,                    event: events[2], status: 'Upcoming',  badge: 'badge-teal'    }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-gradient-to-r from-teal-900/40 to-surface-card border border-border p-6 rounded-3xl flex flex-col gap-2">
        <span className="badge badge-teal w-fit uppercase tracking-widest text-[9px]">FULL SEASON LEDGER</span>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-black">{t('title.full_report', 'Full Seasonal Performance Report')}</h2>
        <p className="text-sm text-black"> crop yields, seed-to-water inputs, resource efficiency indices, and crop health diagnostic reports.</p>
      </div>

      <div className="glass-card p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-surface-card to-teal-950/20">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-success uppercase tracking-wider">Net Profit valuation</span>
          <h3 className="text-3xl font-extrabold text-text-primary">₹{(netProfit / 100000).toFixed(2)} Lakhs <span className="text-xs text-text-secondary font-medium">Net Profit</span></h3>
          <p className="text-xs text-text-secondary">Your yield of {yieldPerHa} t/ha exceeds average levels by <span className="text-success font-bold">+{yieldPctDifference}%</span>.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        <div className="kpi-card flex flex-col gap-1">
           <span className="text-[9px] font-bold text-text-secondary uppercase">ROI</span>
           <span className={`text-xl font-extrabold ${roi >= 0 ? 'text-success' : 'text-danger'}`}>{roi}%</span>
        </div>
        <div className="kpi-card flex flex-col gap-1">
          <span className="text-[9px] font-bold text-text-secondary uppercase">Gross Harvest</span>
          <span className="text-xl font-extrabold text-text-primary">{totalYield} tonnes</span>
        </div>
        <div className="kpi-card flex flex-col gap-1">
          <span className="text-[9px] font-bold text-text-secondary uppercase">Gross Market Value</span>
          <span className="text-xl font-extrabold text-text-primary">₹{(grossRevenue / 100000).toFixed(2)} Lakhs</span>
        </div>
        <div className="kpi-card flex flex-col gap-1">
          <span className="text-[9px] font-bold text-text-secondary uppercase">Total Costs</span>
          <span className="text-xl font-extrabold text-text-primary">₹{(totalCost / 100000).toFixed(2)} Lakhs</span>
        </div>
        <div className="kpi-card flex flex-col gap-1">
          <span className="text-[9px] font-bold text-text-secondary uppercase">Est. Water Absorbed</span>
          <span className="text-xl font-extrabold text-teal-light">
            {weatherValues?.rainfall
              ? `${Math.round(weatherValues.rainfall * 0.85)} mm`
              : selectedCrop === 'rice' ? '1350 mm' : '520 mm'}
          </span>
        </div>
      </div>
       
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 flex flex-col gap-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3">Efficiency Indices</h3>
          {(() => {
            const soilScore = predictionResult?.predictions?.soil_health?.score || 75;
            const waterEff = weatherValues?.rainfall
               ?Math.min(92, Math.max(40, Math.round(40 + (Math.min(weatherValues.rainfall, 2500) / 2500) * 52)))
               : 72;
            const laborEff = fieldSize <= 5 ? 88 : fieldSize <= 15 ? 78 : 65;
            const rings = [
              { label: 'Water', pct: waterEff, color: '#167083' },
              { label: 'Nutrient', pct: soilScore, color: '#e87a4d' },
              { label: 'Labor', pct: laborEff, color: '#22c55e' }
            ];
            return (
              <div className="grid grid-cols-3 gap-2">
                {rings.map((r, i) => {
                  const offset = Math.round(175 * (1 - r.pct / 100));
                  return (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle cx="32" cy="32" r="28" fill="transparent" stroke="#2a3a4e" strokeWidth="4" />
                        <circle cx="32" cy="32" r="28" fill="transparent" stroke={r.color} strokeWidth="4" strokeDasharray="175" strokeDashoffset={offset} />
                      </svg>
                      <span className="text-[10px] font-bold">{r.label}: {r.pct}%</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        <div className="lg:col-span-2 glass-card p-6 flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-1.5"><FaCoins className="text-orange" /> Seasonal Profit & Loss</h3>
          <div className="overflow-x-auto">
            <table className="table-styled">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Investment Cost (₹/ha)</th>
                  <th>Total Cost (₹)</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp, idx) => {
                  const share = Math.round(((exp.costPerHa * fieldSize) / totalCost) * 100);
                  return (
                    <tr key={idx}>
                      <td className="text-xs font-bold text-text-primary">{exp.category}</td>
                      <td className="text-xs font-semibold text-text-primary">₹{exp.costPerHa}</td>
                      <td className="text-xs font-extrabold text-teal-light">₹{(exp.costPerHa * fieldSize).toLocaleString('en-IN')}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="progress-bar w-16"><div className="progress-bar-fill bg-orange" style={{ width: `${share}%` }}></div></div>
                          <span className="text-[10px] font-bold text-text-secondary">{share}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border pb-3 flex items-center gap-1.5"><FaCalendarCheck className="text-teal" /> Milestone Chronology</h3>
          <div className="space-y-4">
            {riskTimeline.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-surface p-3 rounded-xl border border-border">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-text-muted">{item.date}</span>
                  <span className="text-xs font-bold text-text-primary">{item.event}</span>
                </div>
                <span className={`badge ${item.badge} text-[8px] uppercase tracking-wider font-extrabold`}>{item.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 bg-gradient-to-br from-teal-950/20 to-surface-card border border-teal-500/20 p-6 rounded-3xl flex flex-col justify-center gap-3">
          <h3 className="text-xs font-extrabold text-teal-light flex items-center gap-2 uppercase tracking-wider"><FaInfoCircle size={14} /> AI Crop Rotation Recommendations</h3>
          <p className="text-xs text-text-secondary leading-relaxed">Your soil index suggests rotating with leguminous cover crops (such as chickpea or mungbean) next season to capture up to 80 kg/ha of biological nitrogen naturally and increase future yields by 15%.</p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. MAIN APP LAYOUT & ROUTING SHELL
// ==========================================
export default function App() {
  const { t, language, setLanguage, LANGUAGES } = useLanguage();
  const { selectedDistrict } = useApp();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigation = [
    { name: t('nav.overview', 'Overview'), path: '/', icon: FaLeaf },
    { name: t('nav.fertilizer', 'Soil & Fert'), path: '/fertilizer', icon: FaSeedling },
    { name: t('nav.pest', 'Pests & Dis'), path: '/pest', icon: FaBug },
    { name: t('nav.irrigation', 'Water & Irri'), path: '/irrigation', icon: FaTint },
    { name: t('nav.weather', 'Weather'), path: '/weather', icon: FaCloudSun },
    { name: t('nav.market', 'Market'), path: '/market', icon: FaStore },
    { name: t('nav.yield', 'Yield Opt'), path: '/yield', icon: FaCalculator },
    { name: t('nav.report', 'Full Report'), path: '/report', icon: FaFileInvoice }
  ];

  return (
    <div className="flex min-h-screen bg-surface text-text-primary overflow-x-hidden">
      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col border-r border-border bg-surface-card transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <FaLeaf className="text-teal text-2xl animate-pulse-glow" />
              <span className="font-extrabold text-xl tracking-tight gradient-text">AgroSense</span>
            </div>
          )}
          {sidebarCollapsed && <FaLeaf className="text-teal text-2xl mx-auto animate-pulse-glow" />}
          <button type="button" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="text-text-secondary hover:text-text-primary p-1 rounded hover:bg-surface-hover cursor-pointer">
            {sidebarCollapsed ? <FaExpandAlt size={16} /> : <FaCompressAlt size={16} />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-link ${isActive ? 'active' : ''} ${sidebarCollapsed ? 'justify-center tooltip' : ''}`}
                data-tooltip={sidebarCollapsed ? item.name : undefined}
              >
                <Icon size={18} className={isActive ? 'text-teal' : 'text-text-secondary'} />
                {!sidebarCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {!sidebarCollapsed && selectedDistrict && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface p-2.5 rounded-lg border border-border">
              <FaMapMarkerAlt className="text-orange" />
              <div className="truncate">
                <span className="block font-semibold uppercase tracking-wider text-[10px] text-text-muted">LOCATION</span>
                <span className="font-bold text-text-primary uppercase">{selectedDistrict}</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Sidebar - Mobile Panel */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/60 md:hidden backdrop-blur-sm transition-opacity duration-300" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed top-0 bottom-0 left-0 z-50 w-64 border-r border-border bg-surface-card flex flex-col transform transition-transform duration-300 md:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FaLeaf className="text-teal text-2xl animate-pulse-glow" />
            <span className="font-extrabold text-xl tracking-tight gradient-text">AgroSense</span>
          </div>
          <button type="button" onClick={() => setMobileOpen(false)} className="text-text-secondary hover:text-text-primary p-2 cursor-pointer"><FaCompressAlt size={18} /></button>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto" onClick={() => setMobileOpen(false)}>
          {navigation.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} className={`sidebar-link ${isActive ? 'active' : ''}`}><Icon size={18} /><span>{item.name}</span></Link>
            );
          })}
        </nav>
        {selectedDistrict && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface p-2.5 rounded-lg border border-border">
              <FaMapMarkerAlt className="text-orange" />
              <div className="truncate">
                <span className="font-bold text-text-primary uppercase">{selectedDistrict}</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-border bg-surface-card/80 backdrop-blur-md px-4 md:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="text-text-secondary hover:text-text-primary p-1.5 rounded-md hover:bg-surface-hover md:hidden border border-border cursor-pointer"><FaBars size={20} /></button>
            <div className="hidden md:flex flex-col"><h1 className="text-sm font-semibold text-text-secondary">{t('app.subtitle', 'Sustainable E-Agriculture Platform')}</h1></div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-2.5 py-1.5 hover:border-teal transition-all">
              <FaGlobe className="text-teal text-sm" />
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-transparent text-xs font-semibold text-text-primary outline-none cursor-pointer border-none pr-1">
                {LANGUAGES.map((lang) => <option key={lang.code} value={lang.code} className="bg-surface-card text-text-primary">{lang.native}</option>)}
              </select>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 animate-fade-in max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<FarmOverview />} />
            <Route path="/fertilizer" element={<FertilizerStrategy />} />
            <Route path="/pest" element={<PestIntelligence />} />
            <Route path="/irrigation" element={<IrrigationManagement />} />
            <Route path="/weather" element={<WeatherAdvisory />} />
            <Route path="/market" element={<MarketIntelligence />} />
            <Route path="/yield" element={<YieldCalculator />} />
            <Route path="/report" element={<FullSeasonReport />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}