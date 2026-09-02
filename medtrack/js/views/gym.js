import { el, card, stat, fmt, field, select, toLocalInput, fromLocalInput, table, confirmDelete, clear } from '../ui/dom.js';
import { lineChart, PALETTE } from '../ui/chart.js';
import { addItem, removeItem, update, uid, toCsv, downloadFile } from '../store.js';
import { e1rm, totalVolume } from '../model.js';
import { MS_PER_DAY } from '../pk/engine.js';

export const EXERCISES = [
  { name: 'Bankdruecken', muscles: ['Brust', 'Trizeps', 'Schulter'] },
  { name: 'Schraegbankdruecken', muscles: ['Brust', 'Schulter'] },
  { name: 'Kurzhantel-Bankdruecken', muscles: ['Brust', 'Trizeps'] },
  { name: 'Kniebeuge', muscles: ['Quadrizeps', 'Gluteus', 'Ruecken'] },
  { name: 'Frontkniebeuge', muscles: ['Quadrizeps'] },
  { name: 'Kreuzheben', muscles: ['Ruecken', 'Beinbeuger', 'Gluteus'] },
  { name: 'Rumaenisches Kreuzheben', muscles: ['Beinbeuger', 'Gluteus'] },
  { name: 'Schulterdruecken', muscles: ['Schulter', 'Trizeps'] },
  { name: 'Klimmzuege', muscles: ['Ruecken', 'Bizeps'] },
  { name: 'Latzug', muscles: ['Ruecken', 'Bizeps'] },
  { name: 'Langhantelrudern', muscles: ['Ruecken', 'Bizeps'] },
  { name: 'Beinpresse', muscles: ['Quadrizeps', 'Gluteus'] },
  { name: 'Beinbeuger', muscles: ['Beinbeuger'] },
  { name: 'Beinstrecker', muscles: ['Quadrizeps'] },
  { name: 'Wadenheben', muscles: ['Waden'] },
  { name: 'Bizepscurls', muscles: ['Bizeps'] },
  { name: 'Trizepsdruecken', muscles: ['Trizeps'] },
  { name: 'Seitheben', muscles: ['Schulter'] },
  { name: 'Butterfly', muscles: ['Brust'] },
  { name: 'Face Pulls', muscles: ['Schulter', 'Ruecken'] },
  { name: 'Bauchrollen / Crunches', muscles: ['Bauch'] },
  { name: 'Cardio (Minuten)', muscles: ['Ausdauer'] },
];

export function render(ctx) {
  const { state, rerender, now } = ctx;
  const workouts = [...(state.workouts || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const root = el('div', { class: 'view' });

  const week = workouts.filter((w) => Date.parse(w.at) >= now - 7 * MS_PER_DAY);
  const month = workouts.filter((w) => Date.parse(w.at) >= now - 28 * MS_PER_DAY);
  root.appendChild(el('div', { class: 'stat-grid' },
    stat('Einheiten (7 T)', String(week.length)),
    stat('Volumen (7 T)', `${fmt.int(week.reduce((s, w) => s + totalVolume(w.sets), 0))} kg`),
    stat('Saetze (7 T)', String(week.reduce((s, w) => s + (w.sets?.length || 0), 0))),
    stat('Einheiten (28 T)', String(month.length))));

  root.appendChild(newWorkoutCard(ctx));
  if (workouts.length >= 2) root.appendChild(progressCard(state));
  if (workouts.length) root.appendChild(volumeCard(state, now));

  for (const w of workouts.slice(0, 30)) {
    root.appendChild(card(null,
      el('div', { class: 'panel-head' },
        el('h2', {}, w.name || 'Training'),
        el('span', { class: 'muted' }, fmt.dateTime(w.at)),
        el('span', { class: 'badge' }, `${w.sets?.length || 0} Saetze · ${fmt.int(totalVolume(w.sets))} kg`),
        el('button', { class: 'btn small danger', onclick: () => {
          if (confirmDelete('Training loeschen?')) { removeItem('workouts', w.id); rerender(); }
        } }, 'loeschen')),
      table(['Uebung', 'Gewicht', 'Wdh.', 'RPE', 'e1RM'],
        (w.sets || []).map((s) => [
          s.exercise, s.weight ? `${fmt.num(s.weight, 1)} kg` : '-', s.reps ?? '-', s.rpe ?? '-',
          s.weight && s.reps ? `${fmt.num(e1rm(Number(s.weight), Number(s.reps)), 1)} kg` : '-',
        ])),
      w.note ? el('p', { class: 'muted' }, w.note) : null));
  }

  if (workouts.length) {
    root.appendChild(el('div', { class: 'row-actions' },
      el('button', { class: 'btn', onclick: () => exportCsv(workouts) }, 'Trainingsdaten als CSV exportieren')));
  }

  return root;
}

function exerciseNames(state) {
  return [...new Set([...EXERCISES.map((e) => e.name), ...(state.workouts || []).flatMap((w) => (w.sets || []).map((s) => s.exercise))])].sort();
}

function newWorkoutCard(ctx) {
  const { state, rerender } = ctx;
  const draft = { at: toLocalInput(), name: '', note: '', sets: [] };
  const setList = el('div', { class: 'set-list' });
  const names = exerciseNames(state);

  const renderSets = () => {
    clear(setList);
    if (!draft.sets.length) {
      setList.appendChild(el('p', { class: 'muted small' }, 'Noch keine Saetze hinzugefuegt.'));
      return;
    }
    draft.sets.forEach((s, i) => {
      setList.appendChild(el('div', { class: 'set-row' },
        el('span', {}, `${i + 1}. ${s.exercise}`),
        el('span', {}, `${s.weight} kg × ${s.reps}${s.rpe ? ` @RPE ${s.rpe}` : ''}`),
        el('span', { class: 'muted' }, `e1RM ${fmt.num(e1rm(s.weight, s.reps), 1)} kg`),
        el('button', { class: 'btn small danger', type: 'button', onclick: () => { draft.sets.splice(i, 1); renderSets(); } }, '×')));
    });
    setList.appendChild(el('p', { class: 'muted small' },
      `Gesamtvolumen: ${fmt.int(totalVolume(draft.sets))} kg`));
  };
  renderSets();

  const setDraft = { exercise: names[0], weight: '', reps: '', rpe: '' };
  const datalist = el('datalist', { id: 'exercise-list' }, names.map((n) => el('option', { value: n })));

  const addSetRow = el('div', { class: 'form-grid dense' },
    field('Uebung', el('input', { type: 'text', list: 'exercise-list', value: setDraft.exercise,
      oninput: (e) => { setDraft.exercise = e.target.value; } })),
    field('Gewicht (kg)', el('input', { type: 'number', step: 'any', min: 0,
      oninput: (e) => { setDraft.weight = e.target.value; } })),
    field('Wiederholungen', el('input', { type: 'number', step: 1, min: 0,
      oninput: (e) => { setDraft.reps = e.target.value; } })),
    field('RPE', el('input', { type: 'number', step: 0.5, min: 1, max: 10,
      oninput: (e) => { setDraft.rpe = e.target.value; } })),
    el('div', { class: 'form-actions' }, el('button', { class: 'btn', type: 'button', onclick: () => {
      if (!setDraft.exercise || setDraft.reps === '') return;
      draft.sets.push({ exercise: setDraft.exercise, weight: Number(setDraft.weight) || 0,
        reps: Number(setDraft.reps), rpe: setDraft.rpe ? Number(setDraft.rpe) : null });
      renderSets();
    } }, 'Satz hinzufuegen')));

  return card('Training erfassen',
    el('form', { onsubmit: (e) => {
      e.preventDefault();
      if (!draft.sets.length) { alert('Bitte mindestens einen Satz hinzufuegen.'); return; }
      addItem('workouts', { at: fromLocalInput(draft.at), name: draft.name, note: draft.note, sets: [...draft.sets] });
      rerender();
    } },
      el('div', { class: 'form-grid' },
        field('Zeitpunkt', el('input', { type: 'datetime-local', value: draft.at, required: true,
          onchange: (e) => { draft.at = e.target.value; } })),
        field('Bezeichnung', el('input', { type: 'text', placeholder: 'z. B. Push A',
          oninput: (e) => { draft.name = e.target.value; } })),
        field('Notiz', el('input', { type: 'text', placeholder: 'optional',
          oninput: (e) => { draft.note = e.target.value; } }))),
      datalist, addSetRow, setList,
      el('div', { class: 'form-actions' }, el('button', { class: 'btn primary', type: 'submit' }, 'Training speichern'))));
}

function progressCard(state) {
  const perExercise = new Map();
  for (const w of state.workouts || []) {
    for (const s of w.sets || []) {
      if (!s.weight || !s.reps) continue;
      const list = perExercise.get(s.exercise) || [];
      list.push({ at: w.at, value: e1rm(Number(s.weight), Number(s.reps)) });
      perExercise.set(s.exercise, list);
    }
  }
  const candidates = [...perExercise.entries()].filter(([, v]) => v.length >= 2).map(([k]) => k).sort();
  if (!candidates.length) return null;

  let current = candidates[0];
  const host = el('div', {});
  const draw = () => {
    clear(host);
    // Bestwert je Tag
    const byDay = new Map();
    for (const p of perExercise.get(current)) {
      const day = new Date(p.at).toISOString().slice(0, 10);
      byDay.set(day, Math.max(byDay.get(day) || 0, p.value));
    }
    const entries = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const t0 = Date.parse(entries[0][0]);
    const points = entries.map(([d, v]) => [(Date.parse(d) - t0) / MS_PER_DAY, v]);
    host.appendChild(lineChart({
      series: [{ label: `${current} – geschaetztes 1RM`, color: PALETTE[3], points, dots: points }],
      height: 220,
      yMin: Math.min(...points.map((p) => p[1])) * 0.9,
      yMax: Math.max(...points.map((p) => p[1])) * 1.1,
      formatX: (v) => fmt.date(new Date(t0 + v * MS_PER_DAY).toISOString()),
      formatY: (v) => `${fmt.int(v)} kg`,
    }));
    const best = Math.max(...points.map((p) => p[1]));
    host.appendChild(el('p', { class: 'muted small' },
      `Bester geschaetzter Maximalwert: ${fmt.num(best, 1)} kg (Formel nach Epley, gilt zuverlaessig bis etwa 10 Wiederholungen).`));
  };
  draw();
  return card('Kraftentwicklung',
    field('Uebung', select(candidates.map((c) => ({ value: c, label: c })), current, (v) => { current = v; draw(); })),
    host);
}

function volumeCard(state, now) {
  const weeks = 12;
  const buckets = new Array(weeks).fill(0);
  const sets = new Array(weeks).fill(0);
  for (const w of state.workouts || []) {
    const age = (now - Date.parse(w.at)) / MS_PER_DAY;
    const idx = weeks - 1 - Math.floor(age / 7);
    if (idx >= 0 && idx < weeks) {
      buckets[idx] += totalVolume(w.sets);
      sets[idx] += (w.sets || []).length;
    }
  }
  const points = buckets.map((v, i) => [i - (weeks - 1), v]);
  return card('Wochenvolumen (letzte 12 Wochen)',
    lineChart({
      series: [{ label: 'Volumen (kg)', color: PALETTE[2], points, dots: points, area: true }],
      height: 200, formatX: (v) => (Math.round(v) === 0 ? 'diese Woche' : `${Math.round(v)}`),
      formatY: (v) => fmt.int(v),
    }),
    el('p', { class: 'muted small' },
      `Saetze pro Woche aktuell: ${sets[weeks - 1]}. Sprunghafte Volumensteigerungen sind ein haeufiger Grund fuer Verletzungen und Ueberlastung.`));
}

function exportCsv(workouts) {
  const rows = workouts.flatMap((w) => (w.sets || []).map((s) => ({ ...s, at: w.at, workout: w.name })));
  const columns = [
    { label: 'Datum', get: (r) => new Date(r.at).toISOString() },
    { label: 'Training', get: (r) => r.workout || '' },
    { label: 'Uebung', get: (r) => r.exercise },
    { label: 'Gewicht kg', get: (r) => r.weight },
    { label: 'Wiederholungen', get: (r) => r.reps },
    { label: 'RPE', get: (r) => r.rpe ?? '' },
    { label: 'e1RM kg', get: (r) => (r.weight && r.reps ? e1rm(r.weight, r.reps).toFixed(1) : '') },
  ];
  downloadFile(`training-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, columns), 'text/csv');
}
