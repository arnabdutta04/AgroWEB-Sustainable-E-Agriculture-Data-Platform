// ─── Fertilizer Conflict Resolver ────────────────────────────────────────────
// Maps disease names (prefix match) to fertilizer constraints.
// severity: "critical" | "moderate" | "low"
// restrictions: fertilizer names to avoid or cap
// nCap: maximum safe N kg/ha when this disease is active at High risk

export const DISEASE_FERT_CONFLICTS = {
  "Rice Blast": {
    severity: "critical",
    reason: "Excess nitrogen creates lush, soft tissue that dramatically increases blast susceptibility.",
    nCap: 60,
    avoidFertilizers: ["Urea", "General Purpose Fertilizer"],
    preferFertilizers: ["DAP", "Muriate of Potash", "Balanced NPK Fertilizer"],
    splitDosing: true,
    message: "⚠ Blast risk detected: cap N at 60 kg/ha and split into 3 doses. Avoid urea top-dressing at tillering.",
  },
  "Bacterial Leaf": {
    severity: "critical",
    reason: "High nitrogen promotes succulent growth and open stomata — entry points for Xanthomonas.",
    nCap: 70,
    avoidFertilizers: ["Urea"],
    preferFertilizers: ["DAP", "Muriate of Potash"],
    splitDosing: true,
    message: "⚠ Bacterial blight risk: reduce N, apply potassium to strengthen cell walls.",
  },
  "Sheath Rot": {
    severity: "moderate",
    reason: "Excessive nitrogen at booting stage worsens sheath rot incidence.",
    nCap: 80,
    avoidFertilizers: ["Urea"],
    preferFertilizers: ["Balanced NPK Fertilizer", "DAP"],
    splitDosing: true,
    message: "⚠ Sheath rot risk: reduce N at booting, maintain K for tissue strength.",
  },
  "Whitefly": {
    severity: "critical",
    reason: "High N produces soft phloem-rich tissue that whitefly colonies thrive on.",
    nCap: 80,
    avoidFertilizers: ["Urea", "General Purpose Fertilizer"],
    preferFertilizers: ["Balanced NPK Fertilizer", "Muriate of Potash"],
    splitDosing: false,
    message: "⚠ Whitefly risk: reduce nitrogen, increase potassium to harden leaf tissue.",
  },
  "Cotton Leaf Curl": {
    severity: "critical",
    reason: "Excess N increases leaf curl virus severity by promoting vector (whitefly) populations.",
    nCap: 80,
    avoidFertilizers: ["Urea"],
    preferFertilizers: ["Balanced NPK Fertilizer"],
    splitDosing: false,
    message: "⚠ Leaf curl virus risk: cap nitrogen, avoid lush vegetative growth.",
  },
  "Fusarium Wilt": {
    severity: "critical",
    reason: "Nitrogen imbalance disrupts soil microbiome, reducing Trichoderma populations that suppress Fusarium.",
    nCap: 50,
    avoidFertilizers: ["Urea", "General Purpose Fertilizer"],
    preferFertilizers: ["Compost", "Organic Fertilizer", "DAP"],
    splitDosing: false,
    message: "⚠ Fusarium wilt risk: shift to organic/compost fertilizer, reduce synthetic N.",
  },
  "Sigatoka": {
    severity: "moderate",
    reason: "High N produces dense soft canopy that traps humidity, favouring Sigatoka spore germination.",
    nCap: 80,
    avoidFertilizers: [],
    preferFertilizers: ["Balanced NPK Fertilizer", "Muriate of Potash"],
    splitDosing: true,
    message: "⚠ Sigatoka risk: reduce canopy N, increase K for leaf wax thickness.",
  },
  "Powdery Mildew": {
    severity: "moderate",
    reason: "Excess nitrogen promotes succulent growth with thin cell walls susceptible to powdery mildew.",
    nCap: 70,
    avoidFertilizers: ["Urea"],
    preferFertilizers: ["Balanced NPK Fertilizer", "Muriate of Potash"],
    splitDosing: false,
    message: "⚠ Powdery mildew risk: reduce N rate, apply sulphur-compatible fertilizer.",
  },
  "Downy Mildew": {
    severity: "moderate",
    reason: "High N in humid conditions accelerates downy mildew by producing soft leaf tissue.",
    nCap: 75,
    avoidFertilizers: ["Urea"],
    preferFertilizers: ["DAP", "Balanced NPK Fertilizer"],
    splitDosing: true,
    message: "⚠ Downy mildew risk: reduce N, improve drainage before applying fertilizer.",
  },
  "Stem Rot": {
    severity: "moderate",
    reason: "Waterlogged soils from over-irrigation combine with high N to worsen stem rot.",
    nCap: 70,
    avoidFertilizers: ["Urea"],
    preferFertilizers: ["DAP", "Muriate of Potash"],
    splitDosing: false,
    message: "⚠ Stem rot risk: avoid urea in waterlogged fields, apply K to strengthen stems.",
  },
  "Leaf Rust": {
    severity: "low",
    reason: "Standard NPK can continue but avoid late-season nitrogen which prolongs the green period.",
    nCap: 90,
    avoidFertilizers: [],
    preferFertilizers: ["DAP", "Muriate of Potash"],
    splitDosing: false,
    message: "ℹ Leaf rust detected: avoid late N top-dressing to reduce grain-fill period vulnerability.",
  },
};

/**
 * Resolve conflict between disease risk and fertilizer recommendation.
 *
 * @param {string} primaryDisease  - From computeDiseaseRisk()
 * @param {string} riskLevel       - "High" | "Medium" | "Low"
 * @param {number} N               - Current N kg/ha
 * @param {string} recommendedFert - From fertilizer_type model
 * @returns {{ hasConflict, adjustedN, adjustedFert, warningMessage, severity }}
 */
export function resolveFertilizerConflict(primaryDisease, riskLevel, N, recommendedFert) {
  if (!primaryDisease || riskLevel === "Low") {
    return { hasConflict: false, adjustedN: N, adjustedFert: recommendedFert, warningMessage: null, severity: null };
  }

  // Find matching conflict rule (prefix match, same as disease symptom lookup)
  const matchedKey = Object.keys(DISEASE_FERT_CONFLICTS).find(k =>
    primaryDisease.startsWith(k)
  );

  if (!matchedKey) {
    return { hasConflict: false, adjustedN: N, adjustedFert: recommendedFert, warningMessage: null, severity: null };
  }

  const rule = DISEASE_FERT_CONFLICTS[matchedKey];

  // Only apply critical/moderate rules at High risk; apply low rules at Medium+
  const shouldApply =
    (rule.severity === "critical" && riskLevel === "High") ||
    (rule.severity === "moderate" && (riskLevel === "High" || riskLevel === "Medium")) ||
    (rule.severity === "low" && riskLevel !== "Low");

  if (!shouldApply) {
    return { hasConflict: false, adjustedN: N, adjustedFert: recommendedFert, warningMessage: null, severity: null };
  }

  const hasNConflict = N > rule.nCap;
  const hasFertConflict = rule.avoidFertilizers.includes(recommendedFert);
  const hasConflict = hasNConflict || hasFertConflict;

  if (!hasConflict) {
    return { hasConflict: false, adjustedN: N, adjustedFert: recommendedFert, warningMessage: null, severity: null };
  }

  // Apply adjustments
  const adjustedN = hasNConflict ? rule.nCap : N;
  let adjustedFert = recommendedFert;
  if (hasFertConflict && rule.preferFertilizers.length > 0) {
    adjustedFert = rule.preferFertilizers[0];
  }

  return {
    hasConflict: true,
    adjustedN,
    adjustedFert,
    originalN: N,
    originalFert: recommendedFert,
    warningMessage: rule.message,
    severity: rule.severity,
    reason: rule.reason,
    splitDosing: rule.splitDosing,
  };
}