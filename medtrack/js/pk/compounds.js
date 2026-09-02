/**
 * Substanz-Datenbank.
 *
 * esterFactor  = Massenanteil des freien Hormons am Ester (MW_Base / MW_Ester).
 *                100 mg Testosteron Enantat = 72 mg Testosteron.
 * tHalfAbs     = Freisetzungs-/Resorptions-Halbwertszeit aus dem Depot (Tage).
 * tHalfElim    = Eliminations-Halbwertszeit des freien Wirkstoffs (Tage).
 * vdLPerKg     = Verteilungsvolumen (L/kg) - nur gesetzt, wenn belastbare
 *                Humandaten existieren. Ohne Vd wird kein Serumwert in ng/dl
 *                geschaetzt, sondern nur eine relative Kurve gezeigt.
 * confidence   = Datenqualitaet: 'high' (Zulassungsstudien / SmPC),
 *                'medium' (publizierte Einzelstudien), 'low' (nur
 *                Erfahrungswerte, keine humane PK-Studie).
 */

export const CLASSES = {
  aas: 'Anabol-androgenes Steroid',
  ai: 'Aromatasehemmer',
  serm: 'SERM',
  gonadotropin: 'Gonadotropin',
  ar5: '5-Alpha-Reduktasehemmer',
  dopamine: 'Dopaminagonist',
  peptide: 'Peptid / Hormon',
  sarm: 'SARM (nicht zugelassen)',
  support: 'Begleitmedikation',
};

export const ROUTES = {
  im: 'i.m. Injektion',
  sc: 's.c. Injektion',
  oral: 'oral',
  transdermal: 'transdermal',
};

/** Freies Testosteron: t1/2 ca. 1 h. Analog fuer die anderen Basis-Hormone. */
const H = (hours) => hours / 24;

export const COMPOUNDS = [
  // ---------------------------------------------------------------- Testosteron
  {
    id: 'test-propionate', name: 'Testosteron Propionat', short: 'Test P',
    cls: 'aas', base: 'Testosteron', route: 'im',
    esterFactor: 0.837, tHalfAbs: 0.9, tHalfElim: H(1), vdLPerKg: 1.0,
    confidence: 'medium', medical: true,
    absRange: [0.8, 2.0],
    note: 'Kurzer Ester, sehr schwankende Spiegel. Haeufige Injektionen noetig.',
  },
  {
    id: 'test-phenylpropionate', name: 'Testosteron Phenylpropionat', short: 'Test PP',
    cls: 'aas', base: 'Testosteron', route: 'im',
    esterFactor: 0.686, tHalfAbs: 2.0, tHalfElim: H(1), vdLPerKg: 1.0,
    confidence: 'low', absRange: [1.5, 2.5], medical: true,
  },
  {
    id: 'test-isocaproate', name: 'Testosteron Isocaproat', short: 'Test I',
    cls: 'aas', base: 'Testosteron', route: 'im',
    esterFactor: 0.746, tHalfAbs: 4.0, tHalfElim: H(1), vdLPerKg: 1.0,
    confidence: 'medium', absRange: [3.0, 5.0], medical: true,
  },
  {
    id: 'test-enanthate', name: 'Testosteron Enantat', short: 'Test E',
    cls: 'aas', base: 'Testosteron', route: 'im',
    esterFactor: 0.720, tHalfAbs: 4.5, tHalfElim: H(1), vdLPerKg: 1.0,
    confidence: 'high', absRange: [4.0, 5.5], medical: true,
    note: 'Standard in der TRT. Spiegel erreichen nach ca. 5-6 Wochen ein Fliessgleichgewicht.',
  },
  {
    id: 'test-cypionate', name: 'Testosteron Cypionat', short: 'Test C',
    cls: 'aas', base: 'Testosteron', route: 'im',
    esterFactor: 0.700, tHalfAbs: 5.0, tHalfElim: H(1), vdLPerKg: 1.0,
    confidence: 'high', absRange: [4.0, 8.0], medical: true,
  },
  {
    id: 'test-decanoate', name: 'Testosteron Decanoat', short: 'Test D',
    cls: 'aas', base: 'Testosteron', route: 'im',
    esterFactor: 0.651, tHalfAbs: 7.5, tHalfElim: H(1), vdLPerKg: 1.0,
    confidence: 'medium', absRange: [6.0, 9.0], medical: true,
  },
  {
    id: 'test-undecanoate-im', name: 'Testosteron Undecanoat (i.m., Rizinusoel)', short: 'TU (Nebido)',
    cls: 'aas', base: 'Testosteron', route: 'im',
    esterFactor: 0.632, tHalfAbs: 33.9, tHalfElim: H(1), vdLPerKg: 1.0,
    confidence: 'high', absRange: [29, 39], medical: true,
    note: 'Zugelassenes Depot-Praeparat, Intervall meist 10-14 Wochen. Sehr traege Kinetik: Anpassungen wirken erst nach Monaten.',
  },
  {
    id: 'test-suspension', name: 'Testosteron Base (waessrige Suspension)', short: 'Test Susp',
    cls: 'aas', base: 'Testosteron', route: 'im',
    esterFactor: 1.0, tHalfAbs: 0.4, tHalfElim: H(1), vdLPerKg: 1.0,
    confidence: 'low', absRange: [0.2, 0.8], medical: false,
  },
  {
    id: 'test-gel', name: 'Testosteron Gel (transdermal)', short: 'Gel',
    cls: 'aas', base: 'Testosteron', route: 'transdermal',
    esterFactor: 1.0, tHalfAbs: 0.35, tHalfElim: H(1), vdLPerKg: 1.0,
    bioavailability: 0.10, confidence: 'high', absRange: [0.2, 0.5], medical: true,
    note: 'Ca. 10 % Resorption. Achtung: Uebertragung auf Partner/Kinder durch Hautkontakt moeglich.',
  },

  // ---------------------------------------------------------------- Trenbolon
  {
    id: 'tren-acetate', name: 'Trenbolon Acetat', short: 'Tren A',
    cls: 'aas', base: 'Trenbolon', route: 'im',
    esterFactor: 0.865, tHalfAbs: 1.0, tHalfElim: H(1.5),
    confidence: 'low', absRange: [0.8, 1.5], medical: false,
    note: 'Keine humane PK-Studie vorhanden - alle Werte sind Schaetzungen aus Veterinaerdaten und Erfahrungsberichten.',
  },
  {
    id: 'tren-enanthate', name: 'Trenbolon Enantat', short: 'Tren E',
    cls: 'aas', base: 'Trenbolon', route: 'im',
    esterFactor: 0.707, tHalfAbs: 7.0, tHalfElim: H(1.5),
    confidence: 'low', absRange: [5.0, 8.0], medical: false,
    note: 'Keine humane PK-Studie. Langer Ester: Nebenwirkungen klingen nach Absetzen nur langsam ab.',
  },
  {
    id: 'tren-hexa', name: 'Trenbolon Hexahydrobenzylcarbonat', short: 'Parabolan',
    cls: 'aas', base: 'Trenbolon', route: 'im',
    esterFactor: 0.682, tHalfAbs: 8.0, tHalfElim: H(1.5),
    confidence: 'low', absRange: [7.0, 14.0], medical: false,
  },

  // ---------------------------------------------------------------- Nandrolon
  {
    id: 'nandrolone-decanoate', name: 'Nandrolon Decanoat', short: 'Deca',
    cls: 'aas', base: 'Nandrolon', route: 'im',
    esterFactor: 0.640, tHalfAbs: 7.0, tHalfElim: H(2.6),
    confidence: 'high', absRange: [6.0, 12.0], medical: true,
    note: 'Als Arzneimittel zugelassen (u. a. Osteoporose, Anaemie). Sehr lange Nachweisbarkeit (Monate).',
  },
  {
    id: 'nandrolone-pp', name: 'Nandrolon Phenylpropionat', short: 'NPP',
    cls: 'aas', base: 'Nandrolon', route: 'im',
    esterFactor: 0.675, tHalfAbs: 2.7, tHalfElim: H(2.6),
    confidence: 'medium', absRange: [2.0, 3.5], medical: true,
  },

  // ---------------------------------------------------------------- Weitere Injektabile
  {
    id: 'boldenone-undecylenate', name: 'Boldenon Undecylenat', short: 'EQ',
    cls: 'aas', base: 'Boldenon', route: 'im',
    esterFactor: 0.633, tHalfAbs: 14.0, tHalfElim: H(2),
    confidence: 'low', absRange: [12, 16], medical: false,
    note: 'Veterinaerpraeparat. Bekannt fuer Anstieg des Haematokrits.',
  },
  {
    id: 'drostanolone-propionate', name: 'Drostanolon Propionat', short: 'Masteron P',
    cls: 'aas', base: 'Drostanolon', route: 'im',
    esterFactor: 0.845, tHalfAbs: 2.0, tHalfElim: H(1),
    confidence: 'low', absRange: [1.5, 2.5], medical: false,
  },
  {
    id: 'drostanolone-enanthate', name: 'Drostanolon Enantat', short: 'Masteron E',
    cls: 'aas', base: 'Drostanolon', route: 'im',
    esterFactor: 0.731, tHalfAbs: 5.0, tHalfElim: H(1),
    confidence: 'low', absRange: [4.0, 10.0], medical: false,
  },
  {
    id: 'methenolone-enanthate', name: 'Methenolon Enantat', short: 'Primo E',
    cls: 'aas', base: 'Methenolon', route: 'im',
    esterFactor: 0.730, tHalfAbs: 10.5, tHalfElim: H(2),
    confidence: 'medium', absRange: [9.0, 12.0], medical: true,
  },
  {
    id: 'trestolone-acetate', name: 'Trestolon Acetat (MENT)', short: 'MENT',
    cls: 'aas', base: 'Trestolon', route: 'im',
    esterFactor: 0.873, tHalfAbs: 0.5, tHalfElim: H(1),
    confidence: 'low', absRange: [0.3, 1.0], medical: false,
    note: 'Sehr starke Suppression der eigenen Achse, starke Aromatisierung.',
  },

  // ---------------------------------------------------------------- Orale AAS
  {
    id: 'oxandrolone', name: 'Oxandrolon', short: 'Anavar',
    cls: 'aas', base: 'Oxandrolon', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(0.5), tHalfElim: H(9),
    confidence: 'high', medical: true,
    note: '17-alpha-alkyliert: Leberbelastung, ausgepraegte HDL-Senkung.',
  },
  {
    id: 'stanozolol-oral', name: 'Stanozolol (oral)', short: 'Winstrol',
    cls: 'aas', base: 'Stanozolol', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(0.5), tHalfElim: H(9),
    confidence: 'medium', medical: true,
    note: '17-alpha-alkyliert: hepatotoxisch, sehr starke HDL-Senkung, Gelenkbeschwerden.',
  },
  {
    id: 'methandienone', name: 'Methandienon', short: 'Dbol',
    cls: 'aas', base: 'Methandienon', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(0.5), tHalfElim: H(5),
    confidence: 'medium', medical: false,
    note: '17-alpha-alkyliert: hepatotoxisch, starke Wassereinlagerung und Blutdruckanstieg.',
  },
  {
    id: 'oxymetholone', name: 'Oxymetholon', short: 'Anadrol',
    cls: 'aas', base: 'Oxymetholon', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(0.5), tHalfElim: H(8.5),
    confidence: 'medium', medical: true,
    note: 'Hoechste Lebertoxizitaet der gaengigen Oralen.',
  },
  {
    id: 'turinabol', name: 'Chlordehydromethyltestosteron', short: 'Tbol',
    cls: 'aas', base: 'Turinabol', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(0.5), tHalfElim: H(16),
    confidence: 'low', medical: false,
  },
  {
    id: 'methenolone-acetate', name: 'Methenolon Acetat (oral)', short: 'Primo oral',
    cls: 'aas', base: 'Methenolon', route: 'oral',
    esterFactor: 0.878, tHalfAbs: H(0.5), tHalfElim: H(5),
    confidence: 'low', medical: false,
  },

  // ---------------------------------------------------------------- Begleitmedikation
  {
    id: 'anastrozole', name: 'Anastrozol', short: 'Anastrozol',
    cls: 'ai', base: 'Anastrozol', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(1), tHalfElim: H(46),
    confidence: 'high', medical: true,
    note: 'Off-Label bei TRT. Zu starke Estradiol-Senkung schadet Knochen, Libido und Lipiden.',
  },
  {
    id: 'exemestane', name: 'Exemestan', short: 'Aromasin',
    cls: 'ai', base: 'Exemestan', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(1), tHalfElim: H(24),
    confidence: 'high', medical: true,
    note: 'Irreversibler (suizidaler) Hemmer - die Wirkdauer ist laenger als die Halbwertszeit.',
  },
  {
    id: 'letrozole', name: 'Letrozol', short: 'Letrozol',
    cls: 'ai', base: 'Letrozol', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(1), tHalfElim: 2.0,
    confidence: 'high', medical: true,
  },
  {
    id: 'tamoxifen', name: 'Tamoxifen', short: 'Nolva',
    cls: 'serm', base: 'Tamoxifen', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(4), tHalfElim: 6.0,
    confidence: 'high', medical: true,
    note: 'Aktiver Metabolit Endoxifen hat eine noch laengere Halbwertszeit (ca. 14 Tage).',
  },
  {
    id: 'raloxifene', name: 'Raloxifen', short: 'Ralox',
    cls: 'serm', base: 'Raloxifen', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(1), tHalfElim: H(27.7),
    confidence: 'high', medical: true,
  },
  {
    id: 'clomifene', name: 'Clomifen', short: 'Clomid',
    cls: 'serm', base: 'Clomifen', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(2), tHalfElim: 5.0,
    confidence: 'medium', medical: true,
    note: 'Isomer Zuclomifen reichert ueber Wochen an - Sehstoerungen und Stimmungstiefs moeglich.',
  },
  {
    id: 'enclomiphene', name: 'Enclomifen', short: 'Enclo',
    cls: 'serm', base: 'Enclomifen', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(1), tHalfElim: H(10),
    confidence: 'low', medical: false,
  },
  {
    id: 'hcg', name: 'hCG', short: 'hCG',
    cls: 'gonadotropin', base: 'hCG', route: 'sc',
    esterFactor: 1.0, tHalfAbs: H(4), tHalfElim: H(33), unit: 'IE',
    confidence: 'high', medical: true,
    note: 'Erhaelt Hodenvolumen und Spermiogenese unter TRT. Dosis in IE, nicht in mg.',
  },
  {
    id: 'cabergoline', name: 'Cabergolin', short: 'Caber',
    cls: 'dopamine', base: 'Cabergolin', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(2), tHalfElim: 2.8,
    confidence: 'high', medical: true,
    note: 'Nur bei nachgewiesener Hyperprolaktinaemie sinnvoll. Herzklappen-Risiko bei Dauergebrauch.',
  },
  {
    id: 'finasteride', name: 'Finasterid', short: 'Fin',
    cls: 'ar5', base: 'Finasterid', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(1), tHalfElim: H(6),
    confidence: 'high', medical: true,
    note: 'Wirkdauer deutlich laenger als die Halbwertszeit (irreversible Enzymhemmung).',
  },
  {
    id: 'dutasteride', name: 'Dutasterid', short: 'Duta',
    cls: 'ar5', base: 'Dutasterid', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(2), tHalfElim: 35.0,
    confidence: 'high', medical: true,
  },
  {
    id: 'hgh', name: 'Somatropin (hGH)', short: 'hGH',
    cls: 'peptide', base: 'Somatropin', route: 'sc',
    esterFactor: 1.0, tHalfAbs: H(2), tHalfElim: H(3.4), unit: 'IE',
    confidence: 'high', medical: true,
    note: 'IGF-1 ist der relevante Verlaufsmarker, nicht der hGH-Spiegel selbst.',
  },
  {
    id: 'telmisartan', name: 'Telmisartan', short: 'Telmi',
    cls: 'support', base: 'Telmisartan', route: 'oral',
    esterFactor: 1.0, tHalfAbs: H(1), tHalfElim: 1.0,
    confidence: 'high', medical: true,
    note: 'Blutdrucksenker - nur nach aerztlicher Verordnung.',
  },
];

export const COMPOUND_BY_ID = Object.fromEntries(COMPOUNDS.map((c) => [c.id, c]));

export function findCompound(id, customList = []) {
  return COMPOUND_BY_ID[id] || customList.find((c) => c.id === id) || null;
}

/** Basis-Hormon-Menge einer Dosis (mg bzw. IE). */
export function baseAmount(compound, doseMg) {
  const f = compound.esterFactor ?? 1;
  const bio = compound.bioavailability ?? 1;
  return doseMg * f * bio;
}
