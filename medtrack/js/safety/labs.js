/**
 * Labormarker mit Referenzbereichen und Bewertungslogik.
 *
 * Die Grenzwerte orientieren sich an gaengigen Laborreferenzen und den
 * Leitlinien zur Testosterontherapie (u. a. Endocrine Society 2018).
 * Referenzbereiche unterscheiden sich je nach Labor und Messmethode -
 * massgeblich ist immer der Bereich auf dem eigenen Befund.
 */

export const SEVERITY = { ok: 0, watch: 1, warn: 2, urgent: 3 };

export const UNIT_CONVERSIONS = {
  'ng/dl->nmol/l': 0.03467,
  'pg/ml->pmol/l': 3.671,
  'mg/dl->mmol/l (Chol)': 0.02586,
  'mg/dl->mmol/l (TG)': 0.01129,
  'mg/dl->mmol/l (Glc)': 0.0555,
  'mg/dl->umol/l (Krea)': 88.4,
};

export const MARKERS = [
  // --- Hormone ---------------------------------------------------------
  { id: 'total_t', group: 'Hormone', name: 'Gesamt-Testosteron', unit: 'ng/dl',
    alt: { unit: 'nmol/l', factor: 0.03467 }, ref: [300, 1000],
    low: 300, high: 1000, urgentHigh: 1500,
    hint: 'Unter TRT wird ueblicherweise ein Talwert im mittleren Normbereich angestrebt. Abnahme moeglichst standardisiert kurz vor der naechsten Injektion.' },
  { id: 'free_t', group: 'Hormone', name: 'Freies Testosteron', unit: 'pg/ml',
    ref: [50, 210], low: 50, high: 250,
    hint: 'Aussagekraeftiger als Gesamt-T, wenn SHBG auffaellig ist.' },
  { id: 'shbg', group: 'Hormone', name: 'SHBG', unit: 'nmol/l', ref: [10, 57], low: 10, high: 57 },
  { id: 'estradiol', group: 'Hormone', name: 'Estradiol (sensitiv/LC-MS)', unit: 'pg/ml',
    alt: { unit: 'pmol/l', factor: 3.671 }, ref: [10, 42], low: 10, high: 60, urgentHigh: 120,
    hint: 'Estradiol ist fuer Knochen, Libido und Lipide notwendig. Zu tiefe Werte sind genauso ein Problem wie zu hohe. Immer sensitiver Assay (LC-MS/MS).' },
  { id: 'lh', group: 'Hormone', name: 'LH', unit: 'U/l', ref: [1.7, 8.6], low: 1.7, high: 8.6,
    hint: 'Unter exogenem Testosteron regelhaft supprimiert - das ist erwartbar, kein eigener Befund.' },
  { id: 'fsh', group: 'Hormone', name: 'FSH', unit: 'U/l', ref: [1.5, 12.4], low: 1.5, high: 12.4 },
  { id: 'prolactin', group: 'Hormone', name: 'Prolaktin', unit: 'ng/ml', ref: [4, 15], high: 20, urgentHigh: 50,
    hint: 'Relevant vor allem unter 19-Nor-Substanzen (Nandrolon, Trenbolon).' },
  { id: 'igf1', group: 'Hormone', name: 'IGF-1', unit: 'ng/ml', ref: [90, 250], high: 300 },
  { id: 'tsh', group: 'Hormone', name: 'TSH', unit: 'mU/l', ref: [0.4, 4.0], low: 0.4, high: 4.0 },
  { id: 'cortisol', group: 'Hormone', name: 'Cortisol (morgens)', unit: 'ug/dl', ref: [6, 23], low: 6, high: 23 },

  // --- Blutbild --------------------------------------------------------
  { id: 'hematocrit', group: 'Blutbild', name: 'Haematokrit', unit: '%', ref: [40, 50],
    high: 52, urgentHigh: 54, critical: true,
    hint: 'Wichtigster Sicherheitsmarker unter Testosteron. Ab 52 % engmaschig kontrollieren, ab 54 % besteht Handlungsbedarf (Dosisanpassung, Therapiepause oder Aderlass - aerztlich zu entscheiden).' },
  { id: 'hemoglobin', group: 'Blutbild', name: 'Haemoglobin', unit: 'g/dl', ref: [13.5, 17.5], high: 18, urgentHigh: 19 },
  { id: 'rbc', group: 'Blutbild', name: 'Erythrozyten', unit: 'Mio/ul', ref: [4.5, 5.9], high: 6.1 },
  { id: 'platelets', group: 'Blutbild', name: 'Thrombozyten', unit: '1000/ul', ref: [150, 400], low: 150, high: 400 },
  { id: 'ferritin', group: 'Blutbild', name: 'Ferritin', unit: 'ng/ml', ref: [30, 300], low: 30, high: 400 },

  // --- Lipide / Herz-Kreislauf ----------------------------------------
  { id: 'hdl', group: 'Lipide & Herz', name: 'HDL-Cholesterin', unit: 'mg/dl',
    alt: { unit: 'mmol/l', factor: 0.02586 }, ref: [40, 90], low: 40, urgentLow: 25, critical: true,
    hint: 'Anabolika - besonders orale 17-alpha-alkylierte und Trenbolon - senken HDL stark. Ein HDL unter 25 mg/dl ist kardiovaskulaer deutlich ungünstig.' },
  { id: 'ldl', group: 'Lipide & Herz', name: 'LDL-Cholesterin', unit: 'mg/dl',
    alt: { unit: 'mmol/l', factor: 0.02586 }, ref: [0, 116], high: 130, urgentHigh: 190 },
  { id: 'apob', group: 'Lipide & Herz', name: 'ApoB', unit: 'mg/dl', ref: [0, 90], high: 100, urgentHigh: 130,
    hint: 'Besserer Risikomarker als LDL allein.' },
  { id: 'triglycerides', group: 'Lipide & Herz', name: 'Triglyceride', unit: 'mg/dl',
    alt: { unit: 'mmol/l', factor: 0.01129 }, ref: [0, 150], high: 200, urgentHigh: 500 },
  { id: 'lpa', group: 'Lipide & Herz', name: 'Lipoprotein(a)', unit: 'nmol/l', ref: [0, 75], high: 125,
    hint: 'Genetisch bestimmt, einmal im Leben messen lassen.' },
  { id: 'crp', group: 'Lipide & Herz', name: 'hs-CRP', unit: 'mg/l', ref: [0, 3], high: 3, urgentHigh: 10 },
  { id: 'homocysteine', group: 'Lipide & Herz', name: 'Homocystein', unit: 'umol/l', ref: [0, 12], high: 15 },

  // --- Leber -----------------------------------------------------------
  { id: 'alt', group: 'Leber', name: 'ALT (GPT)', unit: 'U/l', ref: [0, 50], high: 60, urgentHigh: 150, critical: true,
    hint: 'Nach hartem Training kann ALT/AST auch ohne Leberschaden steigen. GGT und Bilirubin helfen bei der Einordnung.' },
  { id: 'ast', group: 'Leber', name: 'AST (GOT)', unit: 'U/l', ref: [0, 50], high: 60, urgentHigh: 150 },
  { id: 'ggt', group: 'Leber', name: 'GGT', unit: 'U/l', ref: [0, 60], high: 70, urgentHigh: 200,
    hint: 'Steigt im Gegensatz zu ALT/AST nicht durch Muskelarbeit - deshalb der spezifischere Leberwert.' },
  { id: 'bilirubin', group: 'Leber', name: 'Bilirubin gesamt', unit: 'mg/dl', ref: [0, 1.2], high: 1.5, urgentHigh: 3,
    hint: 'Gelbfaerbung von Haut oder Augen ist ein Notfallzeichen.' },
  { id: 'alp', group: 'Leber', name: 'Alkalische Phosphatase', unit: 'U/l', ref: [40, 130], high: 150 },

  // --- Niere / Stoffwechsel -------------------------------------------
  { id: 'creatinine', group: 'Niere & Stoffwechsel', name: 'Kreatinin', unit: 'mg/dl',
    alt: { unit: 'umol/l', factor: 88.4 }, ref: [0.7, 1.3], high: 1.4, urgentHigh: 2.0,
    hint: 'Bei viel Muskelmasse und Kreatin-Einnahme oft leicht erhoeht. Cystatin C ist dann aussagekraeftiger.' },
  { id: 'cystatinc', group: 'Niere & Stoffwechsel', name: 'Cystatin C', unit: 'mg/l', ref: [0.5, 1.0], high: 1.1 },
  { id: 'egfr', group: 'Niere & Stoffwechsel', name: 'eGFR', unit: 'ml/min', ref: [90, 200], low: 60, urgentLow: 45 },
  { id: 'glucose', group: 'Niere & Stoffwechsel', name: 'Nuechternglukose', unit: 'mg/dl',
    alt: { unit: 'mmol/l', factor: 0.0555 }, ref: [70, 99], high: 110, urgentHigh: 126 },
  { id: 'hba1c', group: 'Niere & Stoffwechsel', name: 'HbA1c', unit: '%', ref: [4.0, 5.6], high: 5.7, urgentHigh: 6.5 },

  // --- Prostata / Sonstiges -------------------------------------------
  { id: 'psa', group: 'Prostata', name: 'PSA', unit: 'ng/ml', ref: [0, 4], high: 4, urgentHigh: 10, critical: true,
    hint: 'Vor Beginn einer Testosterontherapie und im Verlauf kontrollieren. Ein Anstieg um mehr als 1,4 ng/ml innerhalb eines Jahres gehoert abgeklaert.' },
  { id: 'vitd', group: 'Prostata', name: 'Vitamin D (25-OH)', unit: 'ng/ml', ref: [30, 60], low: 20, high: 100 },
];

export const MARKER_BY_ID = Object.fromEntries(MARKERS.map((m) => [m.id, m]));
export const MARKER_GROUPS = [...new Set(MARKERS.map((m) => m.group))];

/** Bewertet einen Einzelwert. */
export function evaluateMarker(markerId, value) {
  const m = MARKER_BY_ID[markerId];
  if (!m || value == null || Number.isNaN(value)) return null;
  let level = 'ok', text = 'im Referenzbereich';

  if (m.urgentHigh != null && value >= m.urgentHigh) { level = 'urgent'; text = 'deutlich zu hoch'; }
  else if (m.urgentLow != null && value <= m.urgentLow) { level = 'urgent'; text = 'deutlich zu niedrig'; }
  else if (m.high != null && value > m.high) { level = 'warn'; text = 'zu hoch'; }
  else if (m.low != null && value < m.low) { level = 'warn'; text = 'zu niedrig'; }
  else if (m.ref && value > m.ref[1]) { level = 'watch'; text = 'leicht ueber dem Referenzbereich'; }
  else if (m.ref && value < m.ref[0]) { level = 'watch'; text = 'leicht unter dem Referenzbereich'; }

  return { marker: m, value, level, text, severity: SEVERITY[level] };
}

/** Bewertet einen kompletten Laborbefund. */
export function evaluatePanel(panel) {
  const results = [];
  for (const [id, value] of Object.entries(panel.values || {})) {
    const r = evaluateMarker(id, Number(value));
    if (r) results.push(r);
  }
  results.sort((a, b) => b.severity - a.severity);
  return results;
}

/** Trend eines Markers ueber mehrere Befunde. */
export function markerTrend(panels, markerId) {
  return panels
    .filter((p) => p.values && p.values[markerId] != null && p.values[markerId] !== '')
    .map((p) => ({ at: p.at, value: Number(p.values[markerId]) }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export function convert(markerId, value, toAlt) {
  const m = MARKER_BY_ID[markerId];
  if (!m?.alt) return value;
  return toAlt ? value * m.alt.factor : value / m.alt.factor;
}
