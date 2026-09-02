/**
 * Koerperzusammensetzung und Masse. Reine Rechenfunktionen.
 *
 * Alle Koerperfett-Formeln sind Schaetzverfahren mit einem Fehler von
 * mehreren Prozentpunkten. Fuer den Verlauf sind sie brauchbar, solange man
 * immer dieselbe Methode und dieselbe Messstelle verwendet - als Absolutwert
 * sind sie es nicht.
 */

export const SITES_MALE_3 = ['chest', 'abdomen', 'thigh'];
export const SITES_FEMALE_3 = ['triceps', 'suprailiac', 'thigh'];
export const SITES_7 = ['chest', 'midaxillary', 'triceps', 'subscapular', 'abdomen', 'suprailiac', 'thigh'];

export const SITE_LABELS = {
  chest: 'Brust', abdomen: 'Bauch', thigh: 'Oberschenkel', triceps: 'Trizeps',
  suprailiac: 'Hueftkamm', subscapular: 'Schulterblatt', midaxillary: 'Mittlere Achsellinie',
};

/** Siri-Gleichung: Koerperdichte -> Fettanteil. */
const siri = (density) => (density > 0 ? 495 / density - 450 : null);
const clampBf = (v) => (Number.isFinite(v) ? Math.max(2, Math.min(60, v)) : null);

/** US-Navy-Methode aus Umfaengen. */
export function navyBodyFat({ waistCm, neckCm, hipCm, heightCm, sex = 'm' }) {
  const h = Number(heightCm);
  const waist = Number(waistCm), neck = Number(neckCm), hip = Number(hipCm);
  if (!h || !waist || !neck) return null;
  if (sex === 'f') {
    if (!hip) return null;
    const v = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(h)) - 450;
    return clampBf(v);
  }
  if (waist - neck <= 0) return null;
  const v = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450;
  return clampBf(v);
}

/** Jackson-Pollock, 3 oder 7 Messstellen (Caliper, Angaben in mm). */
export function calipperBodyFat(folds = {}, { sex = 'm', age = 30 } = {}) {
  const sites = Object.entries(folds).filter(([, v]) => Number(v) > 0);
  const sum = sites.reduce((s, [, v]) => s + Number(v), 0);
  const keys = sites.map(([k]) => k).sort().join(',');
  const has = (list) => list.slice().sort().join(',') === keys;
  let density = null;

  if (has(SITES_7)) {
    density = sex === 'f'
      ? 1.097 - 0.00046971 * sum + 0.00000056 * sum * sum - 0.00012828 * age
      : 1.112 - 0.00043499 * sum + 0.00000055 * sum * sum - 0.00028826 * age;
  } else if (sex === 'f' ? has(SITES_FEMALE_3) : has(SITES_MALE_3)) {
    density = sex === 'f'
      ? 1.0994921 - 0.0009929 * sum + 0.0000023 * sum * sum - 0.0001392 * age
      : 1.10938 - 0.0008267 * sum + 0.0000016 * sum * sum - 0.0002574 * age;
  } else {
    return null; // unvollstaendiger Satz an Messstellen
  }
  return clampBf(siri(density));
}

/** Alle abgeleiteten Kennzahlen eines Eintrags. */
export function metrics(entry, profile = {}) {
  if (!entry) return null;
  const heightCm = Number(entry.heightCm || profile.heightCm) || 0;
  const h = heightCm / 100;
  const weight = Number(entry.weightKg) || 0;
  const sex = entry.sex || profile.sex || 'm';
  const age = Number(entry.age || profile.age) || 30;

  const navy = navyBodyFat({ waistCm: entry.waistCm, neckCm: entry.neckCm, hipCm: entry.hipCm, heightCm, sex });
  const caliper = calipperBodyFat(entry.folds || {}, { sex, age });
  const bodyFat = entry.bodyFat != null && entry.bodyFat !== ''
    ? Number(entry.bodyFat)
    : (caliper ?? navy);

  const lean = weight && bodyFat != null ? weight * (1 - bodyFat / 100) : null;
  const fatMass = weight && bodyFat != null ? weight * (bodyFat / 100) : null;

  return {
    weight: weight || null,
    bodyFat: bodyFat != null ? Number(bodyFat) : null,
    bodyFatSource: entry.bodyFat != null && entry.bodyFat !== '' ? 'eingetragen' : caliper != null ? 'Caliper' : navy != null ? 'Navy' : null,
    navy, caliper,
    lean, fatMass,
    bmi: weight && h ? weight / (h * h) : null,
    ffmi: lean && h ? lean / (h * h) : null,
    normFfmi: lean && h ? lean / (h * h) + 6.1 * (1.8 - h) : null,
    whtr: entry.waistCm && heightCm ? Number(entry.waistCm) / heightCm : null,
    whr: entry.waistCm && entry.hipCm ? Number(entry.waistCm) / Number(entry.hipCm) : null,
  };
}

/**
 * Einordnung des Taille-zu-Groesse-Verhaeltnisses. Aussagekraeftiger als der
 * BMI, weil er das Bauchfett erfasst und Muskelmasse nicht als Uebergewicht wertet.
 */
export function whtrRating(whtr) {
  if (whtr == null) return null;
  if (whtr < 0.4) return { level: 'watch', text: 'sehr schlank' };
  if (whtr < 0.5) return { level: 'ok', text: 'guenstig' };
  if (whtr < 0.6) return { level: 'warn', text: 'erhoehtes Risiko' };
  return { level: 'urgent', text: 'deutlich erhoehtes Risiko' };
}

/** FFMI-Einordnung. Werte deutlich ueber 25 sind ohne Hormone kaum erreichbar. */
export function ffmiRating(normFfmi, sex = 'm') {
  if (normFfmi == null) return null;
  const scale = sex === 'f'
    ? [[13, 'unterdurchschnittlich'], [16, 'durchschnittlich'], [18, 'sehr gut trainiert'], [20, 'sehr hoch']]
    : [[18, 'unterdurchschnittlich'], [20, 'durchschnittlich'], [22, 'gut trainiert'], [25, 'sehr gut trainiert']];
  for (const [limit, text] of scale) if (normFfmi < limit) return text;
  return 'ausserhalb des natuerlich ueblichen Bereichs';
}

/** Gleitender Mittelwert - taegliche Gewichtsschwankungen sind Wasser, kein Fett. */
export function movingAverage(points, window = 7) {
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1);
    return { ...p, value: slice.reduce((s, x) => s + x.value, 0) / slice.length };
  });
}

/** Veraenderungsrate in kg pro Woche und in Prozent des Koerpergewichts. */
export function weightChangeRate(points, weeks = 4) {
  if (points.length < 2) return null;
  const cutoff = Date.parse(points[points.length - 1].at) - weeks * 7 * 86400000;
  const recent = points.filter((p) => Date.parse(p.at) >= cutoff);
  if (recent.length < 2) return null;
  const first = recent[0], last = recent[recent.length - 1];
  const days = (Date.parse(last.at) - Date.parse(first.at)) / 86400000;
  if (days <= 0) return null;
  const perWeek = ((last.value - first.value) / days) * 7;
  return { perWeek, percentPerWeek: last.value ? (perWeek / last.value) * 100 : null, days };
}

/** Umfaenge, die erfasst werden koennen. Paarweise Messungen werden L/R gefuehrt. */
export const MEASUREMENTS = [
  { id: 'neckCm', label: 'Hals' },
  { id: 'shoulderCm', label: 'Schultern' },
  { id: 'chestCm', label: 'Brust' },
  { id: 'waistCm', label: 'Taille (Nabelhoehe)' },
  { id: 'hipCm', label: 'Huefte' },
  { id: 'armLeftCm', label: 'Oberarm links' },
  { id: 'armRightCm', label: 'Oberarm rechts' },
  { id: 'forearmLeftCm', label: 'Unterarm links' },
  { id: 'forearmRightCm', label: 'Unterarm rechts' },
  { id: 'thighLeftCm', label: 'Oberschenkel links' },
  { id: 'thighRightCm', label: 'Oberschenkel rechts' },
  { id: 'calfLeftCm', label: 'Wade links' },
  { id: 'calfRightCm', label: 'Wade rechts' },
];

/** Seitenunterschiede - relevant bei Dysbalancen. */
export function asymmetries(entry) {
  const pairs = [
    ['Oberarm', 'armLeftCm', 'armRightCm'],
    ['Unterarm', 'forearmLeftCm', 'forearmRightCm'],
    ['Oberschenkel', 'thighLeftCm', 'thighRightCm'],
    ['Wade', 'calfLeftCm', 'calfRightCm'],
  ];
  const out = [];
  for (const [label, l, r] of pairs) {
    const a = Number(entry?.[l]), b = Number(entry?.[r]);
    if (!a || !b) continue;
    const diff = Math.abs(a - b);
    const percent = (diff / Math.max(a, b)) * 100;
    out.push({ label, left: a, right: b, diff, percent, notable: percent >= 3 });
  }
  return out;
}
