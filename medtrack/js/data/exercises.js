/**
 * Uebungsdatenbank.
 *
 * Die Liste ist bewusst offen: eigene Uebungen werden im Store unter
 * customExercises gefuehrt und ueberall gleichwertig behandelt.
 *
 * type bestimmt, welche Felder beim Loggen erfasst werden:
 *   weight_reps          Gewicht x Wiederholungen (Standard)
 *   bodyweight_reps      nur Wiederholungen (Koerpergewicht)
 *   weighted_bodyweight  Zusatzgewicht x Wiederholungen (z. B. Klimmzuege mit Gurt)
 *   time                 Dauer in Sekunden (Planks, Haltearbeit)
 *   cardio               Dauer in Minuten + optional Distanz
 */

export const MUSCLES = {
  chest: 'Brust',
  lats: 'Latissimus',
  upperback: 'Oberer Ruecken',
  traps: 'Trapez / Nacken',
  lowerback: 'Unterer Ruecken',
  frontdelt: 'Schulter vorne',
  siddelt: 'Schulter seitlich',
  reardelt: 'Schulter hinten',
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  forearms: 'Unterarme',
  abs: 'Bauch',
  obliques: 'Seitliche Bauchmuskeln',
  quads: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  glutes: 'Gluteus',
  adductors: 'Adduktoren',
  calves: 'Waden',
  cardio: 'Ausdauer',
};

export const MUSCLE_ORDER = Object.keys(MUSCLES);

export const EQUIPMENT = {
  barbell: 'Langhantel',
  dumbbell: 'Kurzhantel',
  machine: 'Maschine',
  cable: 'Kabelzug',
  bodyweight: 'Koerpergewicht',
  kettlebell: 'Kettlebell',
  band: 'Band',
  other: 'Sonstiges',
};

const X = (id, name, equipment, primary, secondary = [], opts = {}) => ({
  id, name, equipment, primary, secondary,
  type: opts.type || 'weight_reps',
  compound: opts.compound ?? primary.length + secondary.length > 1,
  unilateral: !!opts.unilateral,
});

export const EXERCISES = [
  // ------------------------------------------------------------------ Brust
  X('bench-press', 'Bankdruecken', 'barbell', ['chest'], ['triceps', 'frontdelt']),
  X('incline-bench', 'Schraegbankdruecken', 'barbell', ['chest'], ['frontdelt', 'triceps']),
  X('decline-bench', 'Negativbankdruecken', 'barbell', ['chest'], ['triceps']),
  X('db-bench', 'Kurzhantel-Bankdruecken', 'dumbbell', ['chest'], ['triceps', 'frontdelt']),
  X('db-incline', 'Kurzhantel Schraegbank', 'dumbbell', ['chest'], ['frontdelt', 'triceps']),
  X('db-fly', 'Kurzhantel Fliegende', 'dumbbell', ['chest'], []),
  X('cable-fly', 'Kabelzug Fliegende', 'cable', ['chest'], []),
  X('pec-deck', 'Butterfly / Pec Deck', 'machine', ['chest'], []),
  X('chest-press-machine', 'Brustpresse (Maschine)', 'machine', ['chest'], ['triceps']),
  X('dips-chest', 'Dips (brustbetont)', 'bodyweight', ['chest'], ['triceps', 'frontdelt'], { type: 'weighted_bodyweight' }),
  X('pushup', 'Liegestuetze', 'bodyweight', ['chest'], ['triceps', 'frontdelt'], { type: 'bodyweight_reps' }),

  // ------------------------------------------------------------------ Ruecken
  X('deadlift', 'Kreuzheben', 'barbell', ['lowerback', 'hamstrings', 'glutes'], ['upperback', 'traps', 'forearms']),
  X('sumo-deadlift', 'Sumo-Kreuzheben', 'barbell', ['glutes', 'hamstrings'], ['lowerback', 'quads', 'traps']),
  X('rdl', 'Rumaenisches Kreuzheben', 'barbell', ['hamstrings', 'glutes'], ['lowerback']),
  X('barbell-row', 'Langhantelrudern', 'barbell', ['upperback', 'lats'], ['biceps', 'reardelt']),
  X('pendlay-row', 'Pendlay Row', 'barbell', ['upperback'], ['lats', 'biceps']),
  X('db-row', 'Kurzhantelrudern', 'dumbbell', ['lats', 'upperback'], ['biceps'], { unilateral: true }),
  X('tbar-row', 'T-Bar Rudern', 'machine', ['upperback', 'lats'], ['biceps']),
  X('cable-row', 'Rudern am Kabel', 'cable', ['upperback', 'lats'], ['biceps']),
  X('lat-pulldown', 'Latzug', 'cable', ['lats'], ['biceps', 'upperback']),
  X('pullup', 'Klimmzuege', 'bodyweight', ['lats'], ['biceps', 'upperback'], { type: 'weighted_bodyweight' }),
  X('chinup', 'Klimmzuege im Untergriff', 'bodyweight', ['lats', 'biceps'], ['upperback'], { type: 'weighted_bodyweight' }),
  X('straight-arm-pulldown', 'Ueberzuege am Kabel', 'cable', ['lats'], []),
  X('shrug', 'Shrugs', 'barbell', ['traps'], ['forearms']),
  X('hyperextension', 'Rueckenstrecker', 'bodyweight', ['lowerback'], ['glutes', 'hamstrings'], { type: 'weighted_bodyweight' }),
  X('good-morning', 'Good Morning', 'barbell', ['hamstrings', 'lowerback'], ['glutes']),

  // ------------------------------------------------------------------ Schultern
  X('ohp', 'Schulterdruecken (Langhantel)', 'barbell', ['frontdelt'], ['triceps', 'siddelt']),
  X('db-shoulder-press', 'Schulterdruecken (Kurzhantel)', 'dumbbell', ['frontdelt'], ['triceps', 'siddelt']),
  X('machine-shoulder-press', 'Schulterpresse (Maschine)', 'machine', ['frontdelt'], ['triceps']),
  X('lateral-raise', 'Seitheben', 'dumbbell', ['siddelt'], []),
  X('cable-lateral', 'Seitheben am Kabel', 'cable', ['siddelt'], []),
  X('front-raise', 'Frontheben', 'dumbbell', ['frontdelt'], []),
  X('rear-delt-fly', 'Reverse Fly', 'dumbbell', ['reardelt'], ['upperback']),
  X('face-pull', 'Face Pulls', 'cable', ['reardelt'], ['upperback', 'traps']),
  X('upright-row', 'Aufrechtes Rudern', 'barbell', ['siddelt', 'traps'], ['biceps']),

  // ------------------------------------------------------------------ Arme
  X('barbell-curl', 'Langhantel-Curls', 'barbell', ['biceps'], ['forearms']),
  X('db-curl', 'Kurzhantel-Curls', 'dumbbell', ['biceps'], ['forearms']),
  X('hammer-curl', 'Hammer-Curls', 'dumbbell', ['biceps', 'forearms'], []),
  X('preacher-curl', 'Scottcurls', 'barbell', ['biceps'], []),
  X('incline-curl', 'Schraegbank-Curls', 'dumbbell', ['biceps'], []),
  X('cable-curl', 'Curls am Kabel', 'cable', ['biceps'], []),
  X('close-grip-bench', 'Enges Bankdruecken', 'barbell', ['triceps'], ['chest', 'frontdelt']),
  X('skullcrusher', 'Stirndruecken', 'barbell', ['triceps'], []),
  X('triceps-pushdown', 'Trizepsdruecken am Kabel', 'cable', ['triceps'], []),
  X('overhead-triceps', 'Trizepsdruecken ueber Kopf', 'cable', ['triceps'], []),
  X('dips-triceps', 'Dips (trizepsbetont)', 'bodyweight', ['triceps'], ['chest'], { type: 'weighted_bodyweight' }),
  X('wrist-curl', 'Handgelenk-Curls', 'dumbbell', ['forearms'], []),
  X('reverse-curl', 'Reverse Curls', 'barbell', ['forearms', 'biceps'], []),

  // ------------------------------------------------------------------ Beine
  X('squat', 'Kniebeuge', 'barbell', ['quads', 'glutes'], ['lowerback', 'adductors']),
  X('front-squat', 'Frontkniebeuge', 'barbell', ['quads'], ['glutes', 'abs']),
  X('hack-squat', 'Hackenschmidt-Kniebeuge', 'machine', ['quads'], ['glutes']),
  X('leg-press', 'Beinpresse', 'machine', ['quads', 'glutes'], ['adductors']),
  X('bulgarian-split-squat', 'Bulgarian Split Squat', 'dumbbell', ['quads', 'glutes'], [], { unilateral: true }),
  X('lunge', 'Ausfallschritte', 'dumbbell', ['quads', 'glutes'], ['hamstrings'], { unilateral: true }),
  X('leg-extension', 'Beinstrecker', 'machine', ['quads'], []),
  X('leg-curl', 'Beinbeuger liegend', 'machine', ['hamstrings'], []),
  X('seated-leg-curl', 'Beinbeuger sitzend', 'machine', ['hamstrings'], []),
  X('hip-thrust', 'Hip Thrust', 'barbell', ['glutes'], ['hamstrings']),
  X('glute-kickback', 'Kickbacks am Kabel', 'cable', ['glutes'], [], { unilateral: true }),
  X('adductor-machine', 'Adduktorenmaschine', 'machine', ['adductors'], []),
  X('calf-raise-standing', 'Wadenheben stehend', 'machine', ['calves'], []),
  X('calf-raise-seated', 'Wadenheben sitzend', 'machine', ['calves'], []),
  X('calf-press', 'Wadenheben an der Beinpresse', 'machine', ['calves'], []),

  // ------------------------------------------------------------------ Rumpf
  X('crunch', 'Crunches', 'bodyweight', ['abs'], [], { type: 'bodyweight_reps' }),
  X('cable-crunch', 'Crunches am Kabel', 'cable', ['abs'], []),
  X('hanging-leg-raise', 'Beinheben haengend', 'bodyweight', ['abs'], ['obliques'], { type: 'weighted_bodyweight' }),
  X('ab-wheel', 'Bauchrad', 'other', ['abs'], ['obliques'], { type: 'bodyweight_reps' }),
  X('plank', 'Unterarmstuetz', 'bodyweight', ['abs'], ['obliques'], { type: 'time' }),
  X('side-plank', 'Seitstuetz', 'bodyweight', ['obliques'], [], { type: 'time', unilateral: true }),
  X('russian-twist', 'Russian Twist', 'other', ['obliques'], ['abs']),
  X('woodchopper', 'Holzhacker am Kabel', 'cable', ['obliques'], ['abs']),

  // ------------------------------------------------------------------ Ausdauer
  X('treadmill', 'Laufband', 'other', ['cardio'], [], { type: 'cardio' }),
  X('bike', 'Fahrradergometer', 'other', ['cardio'], [], { type: 'cardio' }),
  X('stairmaster', 'Stairmaster', 'other', ['cardio'], [], { type: 'cardio' }),
  X('rowing-machine', 'Rudergeraet', 'other', ['cardio'], ['upperback'], { type: 'cardio' }),
  X('elliptical', 'Crosstrainer', 'other', ['cardio'], [], { type: 'cardio' }),
  X('incline-walk', 'Gehen am Berg', 'other', ['cardio'], [], { type: 'cardio' }),
];

export const EXERCISE_BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export function allExercises(custom = []) {
  return [...EXERCISES, ...custom];
}

export function findExercise(id, custom = []) {
  return EXERCISE_BY_ID[id] || custom.find((e) => e.id === id) || null;
}

/** Uebungen nach Muskelgruppe gruppiert - fuer Auswahllisten. */
export function groupByMuscle(list) {
  const map = new Map(MUSCLE_ORDER.map((m) => [m, []]));
  for (const ex of list) {
    const key = ex.primary?.[0] || 'other';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ex);
  }
  return [...map.entries()].filter(([, v]) => v.length);
}
