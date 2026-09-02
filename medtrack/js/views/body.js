import { el, card, stat, fmt, field, toLocalInput, fromLocalInput, table, confirmDelete, clear } from '../ui/dom.js';
import { lineChart, PALETTE } from '../ui/chart.js';
import { addItem, removeItem, toCsv, downloadFile } from '../store.js';
import { bodyMetrics, navyBodyFat } from '../model.js';
import { MS_PER_DAY } from '../pk/engine.js';

const MEASURES = [
  { id: 'neckCm', label: 'Hals (cm)' },
  { id: 'shoulderCm', label: 'Schultern (cm)' },
  { id: 'chestCm', label: 'Brust (cm)' },
  { id: 'waistCm', label: 'Taille (cm)' },
  { id: 'hipCm', label: 'Huefte (cm)' },
  { id: 'armCm', label: 'Oberarm (cm)' },
  { id: 'thighCm', label: 'Oberschenkel (cm)' },
  { id: 'calfCm', label: 'Wade (cm)' },
];

export const SIDE_EFFECTS = [
  'Akne', 'Nachtschweiss', 'Wassereinlagerungen', 'Schlafstoerungen', 'Reizbarkeit',
  'Gelenkschmerzen', 'Brustdruesen-Veraenderung', 'Haarausfall', 'Libidoverlust',
  'Erektionsprobleme', 'Kopfschmerzen', 'Atemnot bei Belastung', 'Herzstolpern',
];

const SCALES = [
  { id: 'mood', label: 'Stimmung' },
  { id: 'energy', label: 'Energie' },
  { id: 'libido', label: 'Libido' },
  { id: 'sleepQuality', label: 'Schlafqualitaet' },
];

export function render(ctx) {
  const { state, rerender } = ctx;
  const log = [...(state.bodyLog || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const root = el('div', { class: 'view' });

  const latest = log[0];
  const bm = bodyMetrics(latest, state.settings.heightCm);
  if (bm) {
    root.appendChild(el('div', { class: 'stat-grid' },
      stat('Gewicht', `${fmt.num(bm.weight, 1)} kg`, fmt.date(latest.at)),
      bm.bodyFat != null ? stat('Koerperfett', `${fmt.num(bm.bodyFat, 1)} %`, bm.lean ? `${fmt.num(bm.lean, 1)} kg fettfrei` : null) : null,
      bm.ffmi ? stat('FFMI', fmt.num(bm.ffmi, 1), `normiert ${fmt.num(bm.normFfmi, 1)}`) : null,
      stat('BMI', fmt.num(bm.bmi, 1), `${state.settings.heightCm} cm`),
      latest.systolic ? stat('Blutdruck', `${latest.systolic}/${latest.diastolic}`,
        latest.restingHr ? `Ruhepuls ${latest.restingHr}` : null,
        latest.systolic >= 140 || latest.diastolic >= 90 ? 'tone-warn' : '') : null));
  }

  root.appendChild(newEntryCard(ctx));

  if (log.length >= 2) {
    root.appendChild(chartsCard(log));
  }

  const rows = log.slice(0, 100).map((b) => [
    fmt.date(b.at),
    b.weightKg ? `${fmt.num(b.weightKg, 1)} kg` : '-',
    b.bodyFat ? `${fmt.num(b.bodyFat, 1)} %` : '-',
    b.waistCm ? `${fmt.num(b.waistCm, 1)} cm` : '-',
    b.systolic ? `${b.systolic}/${b.diastolic}` : '-',
    b.restingHr || '-',
    (b.sides || []).join(', ') || '-',
    el('button', { class: 'btn small danger', onclick: () => {
      if (confirmDelete()) { removeItem('bodyLog', b.id); rerender(); }
    } }, 'loeschen'),
  ]);
  root.appendChild(card('Verlauf',
    table(['Datum', 'Gewicht', 'KFA', 'Taille', 'RR', 'Ruhepuls', 'Nebenwirkungen', ''], rows),
    log.length ? el('div', { class: 'row-actions' },
      el('button', { class: 'btn', onclick: () => exportCsv(log) }, 'Als CSV exportieren')) : null));

  return root;
}

function newEntryCard(ctx) {
  const { state, rerender } = ctx;
  const draft = { at: toLocalInput(), sides: [] };
  const bfHint = el('span', { class: 'field-hint' }, 'optional');

  const recalcNavy = () => {
    const est = navyBodyFat({ waistCm: Number(draft.waistCm), neckCm: Number(draft.neckCm), heightCm: state.settings.heightCm });
    bfHint.textContent = est ? `Schaetzung nach US-Navy-Formel: ${fmt.num(est, 1)} %` : 'optional';
  };

  const num = (key, label, props = {}) => field(label, el('input', {
    type: 'number', step: 'any', placeholder: '-', ...props,
    oninput: (e) => { draft[key] = e.target.value === '' ? undefined : Number(e.target.value); if (key === 'waistCm' || key === 'neckCm') recalcNavy(); },
  }));

  const sideBoxes = el('div', { class: 'chips' }, SIDE_EFFECTS.map((s) =>
    el('label', { class: 'chip' },
      el('input', { type: 'checkbox', onchange: (e) => {
        if (e.target.checked) draft.sides.push(s);
        else draft.sides = draft.sides.filter((x) => x !== s);
      } }), el('span', {}, s))));

  const scaleInputs = el('div', { class: 'form-grid dense' }, SCALES.map((s) =>
    field(`${s.label} (1-5)`, el('input', { type: 'range', min: 1, max: 5, step: 1, value: 3,
      oninput: (e) => { draft[s.id] = Number(e.target.value); } }))));

  return card('Neuen Eintrag anlegen',
    el('form', { onsubmit: (e) => {
      e.preventDefault();
      addItem('bodyLog', { ...draft, at: fromLocalInput(draft.at), sides: [...draft.sides] });
      rerender();
    } },
      el('div', { class: 'form-grid' },
        field('Zeitpunkt', el('input', { type: 'datetime-local', value: draft.at, required: true,
          onchange: (e) => { draft.at = e.target.value; } })),
        num('weightKg', 'Gewicht (kg)', { min: 30, max: 300 }),
        (() => { const f = num('bodyFat', 'Koerperfett (%)', { min: 2, max: 60 }); f.appendChild(bfHint); return f; })(),
        num('systolic', 'Blutdruck systolisch', { min: 60, max: 260 }),
        num('diastolic', 'Blutdruck diastolisch', { min: 30, max: 180 }),
        num('restingHr', 'Ruhepuls (/min)', { min: 30, max: 200 }),
        num('sleepHours', 'Schlaf (h)', { min: 0, max: 16 })),
      el('details', { class: 'lab-group' }, el('summary', {}, 'Umfaenge'),
        el('div', { class: 'form-grid dense' }, MEASURES.map((m) => num(m.id, m.label, { min: 10, max: 250 })))),
      el('details', { class: 'lab-group' }, el('summary', {}, 'Befinden'), scaleInputs),
      el('details', { class: 'lab-group', open: true }, el('summary', {}, 'Nebenwirkungen beobachtet'), sideBoxes,
        el('p', { class: 'muted small' }, 'Diese Angaben sind fuer ein Arztgespraech oft wertvoller als einzelne Messwerte - sie zeigen den zeitlichen Zusammenhang zu Dosisaenderungen.')),
      field('Notiz', el('input', { type: 'text', placeholder: 'optional', oninput: (e) => { draft.note = e.target.value; } })),
      el('div', { class: 'form-actions' }, el('button', { class: 'btn primary', type: 'submit' }, 'Speichern'))));
}

function movingAverage(points, window = 7) {
  return points.map((p, i) => {
    const from = Math.max(0, i - window + 1);
    const slice = points.slice(from, i + 1);
    return [p[0], slice.reduce((s, x) => s + x[1], 0) / slice.length];
  });
}

function chartsCard(log) {
  const asc = [...log].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const t0 = Date.parse(asc[0].at);
  const x = (b) => (Date.parse(b.at) - t0) / MS_PER_DAY;
  const host = el('div', {});

  const weight = asc.filter((b) => b.weightKg).map((b) => [x(b), Number(b.weightKg)]);
  if (weight.length >= 2) {
    host.appendChild(el('h3', {}, 'Gewicht'));
    host.appendChild(lineChart({
      series: [
        { label: 'Gewicht (kg)', color: PALETTE[0], points: weight, dots: weight, width: 1.5 },
        { label: 'Gleitender Schnitt', color: PALETTE[2], points: movingAverage(weight), dashed: true },
      ],
      height: 220,
      yMin: Math.min(...weight.map((p) => p[1])) - 2,
      yMax: Math.max(...weight.map((p) => p[1])) + 2,
      formatX: (v) => fmt.date(new Date(t0 + v * MS_PER_DAY).toISOString()),
      formatY: (v) => fmt.num(v, 1),
    }));
  }

  const bpS = asc.filter((b) => b.systolic).map((b) => [x(b), Number(b.systolic)]);
  const bpD = asc.filter((b) => b.diastolic).map((b) => [x(b), Number(b.diastolic)]);
  if (bpS.length >= 2) {
    host.appendChild(el('h3', {}, 'Blutdruck'));
    host.appendChild(lineChart({
      series: [
        { label: 'systolisch', color: PALETTE[1], points: bpS, dots: bpS },
        { label: 'diastolisch', color: PALETTE[0], points: bpD, dots: bpD },
      ],
      bands: [{ from: 0, to: 120, color: 'var(--band-ok)' }],
      height: 220, yMin: 50, yMax: Math.max(160, ...bpS.map((p) => p[1])) + 10,
      formatX: (v) => fmt.date(new Date(t0 + v * MS_PER_DAY).toISOString()),
      formatY: (v) => fmt.int(v),
    }));
    host.appendChild(el('p', { class: 'muted small' },
      'Zielbereich fuer Normalwerte: unter 120/80 mmHg. Ab 140/90 mmHg besteht Handlungsbedarf.'));
  }

  return card('Trends', host);
}

function exportCsv(log) {
  const columns = [
    { label: 'Datum', get: (b) => new Date(b.at).toISOString() },
    { label: 'Gewicht kg', get: (b) => b.weightKg ?? '' },
    { label: 'KFA %', get: (b) => b.bodyFat ?? '' },
    ...MEASURES.map((m) => ({ label: m.label, get: (b) => b[m.id] ?? '' })),
    { label: 'RR sys', get: (b) => b.systolic ?? '' },
    { label: 'RR dia', get: (b) => b.diastolic ?? '' },
    { label: 'Ruhepuls', get: (b) => b.restingHr ?? '' },
    { label: 'Nebenwirkungen', get: (b) => (b.sides || []).join(', ') },
    { label: 'Notiz', get: (b) => b.note || '' },
  ];
  downloadFile(`koerperdaten-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(log, columns), 'text/csv');
}
