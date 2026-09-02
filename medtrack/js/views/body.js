import {
  el, card, stat, fmt, field, select, tabs, stepper, responsiveTable,
  toLocalInput, fromLocalInput, confirmDelete, clear,
} from '../ui/dom.js';
import { lineChart, PALETTE } from '../ui/chart.js';
import { addItem, removeItem, setSetting, toCsv, downloadFile } from '../store.js';
import {
  metrics, MEASUREMENTS, SITE_LABELS, SITES_MALE_3, SITES_FEMALE_3, SITES_7,
  navyBodyFat, calipperBodyFat, movingAverage, weightChangeRate, asymmetries,
  whtrRating, ffmiRating,
} from '../body/metrics.js';
import { MS_PER_DAY } from '../pk/engine.js';
import { addPhoto, listPhotos, deletePhoto, objectUrl, photoStats } from '../photos.js';

export const SIDE_EFFECTS = [
  'Akne', 'Nachtschweiss', 'Wassereinlagerungen', 'Schlafstoerungen', 'Reizbarkeit',
  'Gelenkschmerzen', 'Brustdruesen-Veraenderung', 'Haarausfall', 'Libidoverlust',
  'Erektionsprobleme', 'Kopfschmerzen', 'Atemnot bei Belastung', 'Herzstolpern',
  'Stimmungstief', 'Appetitlosigkeit', 'Verdauungsprobleme',
];

const SCALES = [
  { id: 'mood', label: 'Stimmung' },
  { id: 'energy', label: 'Energie' },
  { id: 'libido', label: 'Libido' },
  { id: 'sleepQuality', label: 'Schlafqualitaet' },
  { id: 'stress', label: 'Stress' },
  { id: 'soreness', label: 'Muskelkater' },
];

const TABS = [
  { id: 'entry', label: 'Erfassen' },
  { id: 'trends', label: 'Verlauf' },
  { id: 'measures', label: 'Masse' },
  { id: 'photos', label: 'Fotos' },
];

export function render(ctx) {
  const { state, rerender } = ctx;
  const active = state.settings.bodyTab || 'entry';
  const root = el('div', { class: 'view' });

  root.appendChild(summaryCards(state));
  root.appendChild(tabs(TABS, active, (id) => { setSetting('bodyTab', id); rerender(); }));

  const views = { entry: entryTab, trends: trendsTab, measures: measuresTab, photos: photosTab };
  root.appendChild((views[active] || entryTab)(ctx));
  return root;
}

const sortedLog = (state) => [...(state.bodyLog || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

function summaryCards(state) {
  const log = sortedLog(state);
  const latest = log[0];
  if (!latest) return el('div', {});
  const m = metrics(latest, state.settings);
  const grid = el('div', { class: 'stat-grid' });

  if (m.weight) {
    const points = log.filter((b) => b.weightKg).map((b) => ({ at: b.at, value: Number(b.weightKg) })).reverse();
    const rate = weightChangeRate(points);
    grid.appendChild(stat('Gewicht', `${fmt.num(m.weight, 1)} kg`,
      rate ? `${rate.perWeek >= 0 ? '+' : ''}${fmt.num(rate.perWeek, 2)} kg/Woche` : fmt.date(latest.at)));
  }
  if (m.bodyFat != null) {
    grid.appendChild(stat('Koerperfett', `${fmt.num(m.bodyFat, 1)} %`,
      `${m.bodyFatSource}${m.lean ? ` · ${fmt.num(m.lean, 1)} kg fettfrei` : ''}`));
  }
  if (m.ffmi) {
    grid.appendChild(stat('FFMI', fmt.num(m.ffmi, 1),
      `normiert ${fmt.num(m.normFfmi, 1)} · ${ffmiRating(m.normFfmi, state.settings.sex)}`));
  }
  if (m.whtr) {
    const r = whtrRating(m.whtr);
    grid.appendChild(stat('Taille / Groesse', fmt.num(m.whtr, 2), r?.text,
      r?.level === 'warn' ? 'tone-warn' : r?.level === 'urgent' ? 'tone-urgent' : ''));
  }
  if (latest.systolic) {
    grid.appendChild(stat('Blutdruck', `${latest.systolic}/${latest.diastolic}`,
      latest.restingHr ? `Ruhepuls ${latest.restingHr}` : fmt.date(latest.at),
      latest.systolic >= 140 || latest.diastolic >= 90 ? 'tone-warn' : ''));
  }
  if (m.bmi) grid.appendChild(stat('BMI', fmt.num(m.bmi, 1), 'bei viel Muskelmasse wenig aussagekraeftig'));
  return grid;
}

// ---------------------------------------------------------------------------
// Erfassen
// ---------------------------------------------------------------------------

function entryTab(ctx) {
  const { state, rerender } = ctx;
  const host = el('div', { class: 'view' });
  const settings = state.settings;
  const draft = { at: toLocalInput(), sides: [], folds: {} };
  const bfHint = el('span', { class: 'field-hint' }, 'leer lassen, wenn geschaetzt werden soll');

  const recalc = () => {
    const navy = navyBodyFat({
      waistCm: draft.waistCm, neckCm: draft.neckCm, hipCm: draft.hipCm,
      heightCm: settings.heightCm, sex: settings.sex,
    });
    const cal = calipperBodyFat(draft.folds, { sex: settings.sex, age: settings.age });
    const parts = [];
    if (cal != null) parts.push(`Caliper: ${fmt.num(cal, 1)} %`);
    if (navy != null) parts.push(`Navy (Umfaenge): ${fmt.num(navy, 1)} %`);
    bfHint.textContent = parts.length ? parts.join(' · ') : 'leer lassen, wenn geschaetzt werden soll';
  };

  const num = (key, label, opts = {}) => field(label, el('input', {
    type: 'number', step: 'any', placeholder: '-', inputmode: 'decimal', ...opts,
    oninput: (e) => { draft[key] = e.target.value === '' ? undefined : Number(e.target.value); recalc(); },
  }));

  const foldInputs = () => {
    const set = settings.sex === 'f' ? [...new Set([...SITES_FEMALE_3, ...SITES_7])] : [...new Set([...SITES_MALE_3, ...SITES_7])];
    return el('div', { class: 'form-grid dense' }, set.map((site) =>
      field(`${SITE_LABELS[site]} (mm)`, el('input', {
        type: 'number', step: 'any', min: 1, inputmode: 'decimal', placeholder: '-',
        oninput: (e) => {
          if (e.target.value === '') delete draft.folds[site];
          else draft.folds[site] = Number(e.target.value);
          recalc();
        },
      }))));
  };

  const sideBoxes = el('div', { class: 'chips' }, SIDE_EFFECTS.map((s) =>
    el('label', { class: 'chip' },
      el('input', { type: 'checkbox', onchange: (e) => {
        if (e.target.checked) draft.sides.push(s);
        else draft.sides = draft.sides.filter((x) => x !== s);
      } }), el('span', {}, s))));

  host.appendChild(card('Neuer Eintrag',
    el('form', { onsubmit: (e) => {
      e.preventDefault();
      addItem('bodyLog', { ...draft, at: fromLocalInput(draft.at), sides: [...draft.sides], folds: { ...draft.folds } });
      rerender();
    } },
      el('div', { class: 'form-grid' },
        field('Zeitpunkt', el('input', { type: 'datetime-local', value: draft.at, required: true,
          onchange: (e) => { draft.at = e.target.value; } })),
        num('weightKg', 'Gewicht (kg)', { min: 30, max: 300 }),
        (() => { const f = num('bodyFat', 'Koerperfett (%)', { min: 2, max: 60 }); f.appendChild(bfHint); return f; })()),

      el('details', { class: 'lab-group', open: true }, el('summary', {}, 'Kreislauf'),
        el('div', { class: 'form-grid dense' },
          num('systolic', 'Blutdruck systolisch', { min: 60, max: 260 }),
          num('diastolic', 'Blutdruck diastolisch', { min: 30, max: 180 }),
          num('restingHr', 'Ruhepuls (/min)', { min: 30, max: 220 }),
          num('spo2', 'Sauerstoffsaettigung (%)', { min: 70, max: 100 }))),

      el('details', { class: 'lab-group' }, el('summary', {}, 'Umfaenge'),
        el('div', { class: 'form-grid dense' }, MEASUREMENTS.map((m) => num(m.id, `${m.label} (cm)`, { min: 10, max: 250 }))),
        el('p', { class: 'muted small' }, 'Immer an derselben Stelle, zur selben Tageszeit und im selben Zustand messen (Arm angespannt oder entspannt - nur konsequent gleich).')),

      el('details', { class: 'lab-group' }, el('summary', {}, 'Caliper-Messung (Hautfalten)'),
        foldInputs(),
        el('p', { class: 'muted small' },
          settings.sex === 'f'
            ? 'Drei Stellen (Trizeps, Hueftkamm, Oberschenkel) oder alle sieben ergeben eine Schaetzung nach Jackson-Pollock.'
            : 'Drei Stellen (Brust, Bauch, Oberschenkel) oder alle sieben ergeben eine Schaetzung nach Jackson-Pollock.')),

      el('details', { class: 'lab-group' }, el('summary', {}, 'Alltag & Befinden'),
        el('div', { class: 'form-grid dense' },
          num('sleepHours', 'Schlaf (h)', { min: 0, max: 16 }),
          num('steps', 'Schritte', { min: 0, max: 100000 }),
          num('kcal', 'Kalorien (kcal)', { min: 0, max: 12000 }),
          num('proteinG', 'Eiweiss (g)', { min: 0, max: 800 }),
          num('waterL', 'Wasser (l)', { min: 0, max: 15 })),
        el('div', { class: 'form-grid dense' }, SCALES.map((s) =>
          field(`${s.label} (1-5)`, el('input', { type: 'range', min: 1, max: 5, step: 1, value: 3,
            oninput: (e) => { draft[s.id] = Number(e.target.value); } }))))),

      el('details', { class: 'lab-group', open: true }, el('summary', {}, 'Nebenwirkungen beobachtet'),
        sideBoxes,
        el('p', { class: 'muted small' },
          'Diese Angaben sind im Arztgespraech oft wertvoller als einzelne Messwerte, weil sie den zeitlichen Zusammenhang zu Dosisaenderungen zeigen.')),

      field('Notiz', el('input', { type: 'text', placeholder: 'optional', oninput: (e) => { draft.note = e.target.value; } })),
      el('div', { class: 'form-actions' }, el('button', { class: 'btn primary wide', type: 'submit' }, 'Speichern')))));

  const log = sortedLog(state);
  if (log.length) {
    host.appendChild(card('Letzte Eintraege',
      responsiveTable(['Datum', 'Gewicht', 'KFA', 'Taille', 'RR', 'Puls', 'Nebenwirkungen', ''],
        log.slice(0, 20).map((b) => [
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
        ])),
      el('div', { class: 'row-actions' },
        el('button', { class: 'btn', onclick: () => exportCsv(log) }, 'Als CSV exportieren'))));
  }
  return host;
}

// ---------------------------------------------------------------------------
// Verlauf
// ---------------------------------------------------------------------------

const TREND_FIELDS = [
  { id: 'weightKg', label: 'Gewicht', unit: 'kg', avg: true },
  { id: 'bodyFat', label: 'Koerperfett', unit: '%', avg: true },
  { id: 'systolic', label: 'Blutdruck systolisch', unit: 'mmHg', ref: [0, 120] },
  { id: 'diastolic', label: 'Blutdruck diastolisch', unit: 'mmHg', ref: [0, 80] },
  { id: 'restingHr', label: 'Ruhepuls', unit: '/min' },
  { id: 'sleepHours', label: 'Schlaf', unit: 'h' },
  { id: 'steps', label: 'Schritte', unit: '' },
  { id: 'kcal', label: 'Kalorien', unit: 'kcal' },
  { id: 'proteinG', label: 'Eiweiss', unit: 'g' },
  ...MEASUREMENTS.map((m) => ({ id: m.id, label: m.label, unit: 'cm' })),
];

function trendsTab(ctx) {
  const { state } = ctx;
  const host = el('div', { class: 'view' });
  const log = [...(state.bodyLog || [])].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (log.length < 2) {
    host.appendChild(card('Zu wenige Daten', el('p', {}, 'Ab dem zweiten Eintrag entstehen hier Verlaufskurven.')));
    return host;
  }

  const available = TREND_FIELDS.filter((f) => log.some((b) => b[f.id] != null && b[f.id] !== ''));
  let current = available.find((f) => f.id === (state.settings.bodyTrend || 'weightKg')) || available[0];
  const chartHost = el('div', {});

  const draw = () => {
    clear(chartHost);
    const points = log.filter((b) => b[current.id] != null && b[current.id] !== '')
      .map((b) => ({ at: b.at, value: Number(b[current.id]) }));
    if (points.length < 2) { chartHost.appendChild(el('p', { class: 'muted' }, 'Mindestens zwei Werte noetig.')); return; }
    const t0 = Date.parse(points[0].at);
    const x = (p) => (Date.parse(p.at) - t0) / MS_PER_DAY;
    const raw = points.map((p) => [x(p), p.value]);
    const series = [{ label: `${current.label} (${current.unit})`, color: PALETTE[0], points: raw, dots: raw, width: 1.5 }];
    if (current.avg && points.length >= 4) {
      series.push({ label: 'gleitender Schnitt (7)', color: PALETTE[2], points: movingAverage(points, 7).map((p) => [x(p), p.value]), dashed: true });
    }
    const values = raw.map((p) => p[1]);
    chartHost.appendChild(lineChart({
      series,
      bands: current.ref ? [{ from: current.ref[0], to: current.ref[1], color: 'var(--band-ok)' }] : [],
      height: 260,
      yMin: Math.min(...values) * 0.95,
      yMax: Math.max(...values) * 1.05,
      formatX: (v) => fmt.date(new Date(t0 + v * MS_PER_DAY).toISOString()),
      formatY: (v) => fmt.num(v, 1),
    }));
    const rate = weightChangeRate(points);
    if (rate) {
      chartHost.appendChild(el('p', { class: 'muted small' },
        `Veraenderung ueber die letzten ${Math.round(rate.days)} Tage: ${rate.perWeek >= 0 ? '+' : ''}${fmt.num(rate.perWeek, 2)} ${current.unit}/Woche`
        + (current.id === 'weightKg' && rate.percentPerWeek != null ? ` (${fmt.num(rate.percentPerWeek, 2)} % des Koerpergewichts)` : '')));
    }
  };

  host.appendChild(card('Verlauf',
    field('Wert', select(available.map((f) => ({ value: f.id, label: f.label })), current.id, (v) => {
      current = available.find((f) => f.id === v); setSetting('bodyTrend', v); draw();
    })),
    chartHost));
  draw();
  return host;
}

// ---------------------------------------------------------------------------
// Masse
// ---------------------------------------------------------------------------

function measuresTab(ctx) {
  const { state } = ctx;
  const host = el('div', { class: 'view' });
  const log = sortedLog(state);
  const latest = log.find((b) => MEASUREMENTS.some((m) => b[m.id]));
  if (!latest) {
    host.appendChild(card('Keine Umfaenge erfasst',
      el('p', {}, 'Trage unter "Erfassen" im Abschnitt Umfaenge deine Masse ein - danach siehst du hier Veraenderungen und Seitenunterschiede.')));
    return host;
  }

  // Vergleich je Mass: nicht jeder Eintrag enthaelt alle Umfaenge, deshalb wird
  // fuer jede Stelle der letzte Eintrag gesucht, der sie tatsaechlich enthaelt.
  const previousFor = (id) => log.find((b) => b !== latest && b[id] != null && b[id] !== '');
  host.appendChild(card(`Umfaenge vom ${fmt.date(latest.at)}`,
    responsiveTable(['Stelle', 'Aktuell', 'Vorher', 'Differenz'],
      MEASUREMENTS.filter((m) => latest[m.id]).map((m) => {
        const now = Number(latest[m.id]);
        const prev = previousFor(m.id);
        const before = prev ? Number(prev[m.id]) : null;
        const diff = before != null ? now - before : null;
        return [
          m.label, `${fmt.num(now, 1)} cm`,
          before != null ? `${fmt.num(before, 1)} cm (${fmt.date(prev.at)})` : 'erste Messung',
          diff != null ? el('span', { class: diff > 0 ? 'up' : diff < 0 ? 'down' : '' },
            `${diff > 0 ? '+' : ''}${fmt.num(diff, 1)} cm`) : '-',
        ];
      }))));

  const asym = asymmetries(latest);
  if (asym.length) {
    host.appendChild(card('Seitenunterschiede',
      responsiveTable(['Stelle', 'Links', 'Rechts', 'Differenz'],
        asym.map((a) => [
          a.label, `${fmt.num(a.left, 1)} cm`, `${fmt.num(a.right, 1)} cm`,
          el('span', { class: a.notable ? 'up' : '' }, `${fmt.num(a.diff, 1)} cm (${fmt.num(a.percent, 1)} %)`),
        ])),
      el('p', { class: 'muted small' },
        'Kleine Unterschiede sind normal - fast niemand ist symmetrisch. Ab etwa 3 % lohnt es sich, einseitige Uebungen einzubauen und die Technik pruefen zu lassen.')));
  }

  const m = metrics(latest, state.settings);
  host.appendChild(card('Abgeleitete Werte',
    el('div', { class: 'cmp-rows' },
      row('Fettfreie Masse', m.lean ? `${fmt.num(m.lean, 1)} kg` : null),
      row('Fettmasse', m.fatMass ? `${fmt.num(m.fatMass, 1)} kg` : null),
      row('FFMI', m.ffmi ? `${fmt.num(m.ffmi, 1)} (normiert ${fmt.num(m.normFfmi, 1)})` : null),
      row('Einordnung FFMI', m.normFfmi ? ffmiRating(m.normFfmi, state.settings.sex) : null),
      row('Taille / Groesse', m.whtr ? `${fmt.num(m.whtr, 2)} - ${whtrRating(m.whtr)?.text}` : null),
      row('Taille / Huefte', m.whr ? fmt.num(m.whr, 2) : null),
      row('BMI', m.bmi ? fmt.num(m.bmi, 1) : null)),
    el('p', { class: 'muted small' },
      'Der FFMI setzt die fettfreie Masse ins Verhaeltnis zur Koerpergroesse. Werte ueber etwa 25 (normiert) gelten als ohne Hormonunterstuetzung kaum erreichbar - als Einordnung, nicht als Ziel.')));
  return host;
}

const row = (label, value) => (value == null ? null
  : el('div', { class: 'cmp-row' }, el('span', {}, label), el('b', {}, value)));

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

function photosTab(ctx) {
  const host = el('div', { class: 'view' });
  const gallery = el('div', { class: 'photo-grid' }, el('p', { class: 'muted' }, 'Wird geladen …'));
  const info = el('p', { class: 'muted small' });

  const refresh = async () => {
    try {
      const photos = await listPhotos();
      const stats = await photoStats();
      clear(gallery);
      info.textContent = `${stats.count} Aufnahmen · ${(stats.bytes / 1048576).toFixed(1)} MB lokal gespeichert`;
      if (!photos.length) {
        gallery.appendChild(el('p', { class: 'muted' }, 'Noch keine Aufnahmen.'));
        return;
      }
      for (const p of photos) {
        const url = objectUrl(p);
        gallery.appendChild(el('figure', { class: 'photo' },
          el('img', { src: url, alt: `Aufnahme vom ${fmt.date(p.at)}`, loading: 'lazy' }),
          el('figcaption', {},
            el('span', {}, fmt.date(p.at)),
            p.note ? el('span', { class: 'muted' }, p.note) : null,
            el('button', { class: 'btn small danger', onclick: async () => {
              if (confirmDelete('Aufnahme loeschen?')) { await deletePhoto(p.id); URL.revokeObjectURL(url); refresh(); }
            } }, 'loeschen'))));
      }
    } catch (err) {
      clear(gallery);
      gallery.appendChild(el('p', { class: 'warn-inline' }, `Fotospeicher nicht verfuegbar: ${err.message}`));
    }
  };

  const draft = { at: toLocalInput(), note: '', pose: 'front' };
  host.appendChild(card('Fortschrittsfotos',
    el('p', { class: 'muted small' },
      'Die Bilder liegen verkleinert in der lokalen Datenbank des Browsers und verlassen das Geraet nicht. Sie sind nicht Teil der JSON-Sicherung - lade sie bei einem Geraetewechsel vorher einzeln herunter.'),
    el('div', { class: 'form-grid' },
      field('Zeitpunkt', el('input', { type: 'datetime-local', value: draft.at, onchange: (e) => { draft.at = e.target.value; } })),
      field('Pose', select([
        { value: 'front', label: 'Front' }, { value: 'side', label: 'Seite' },
        { value: 'back', label: 'Ruecken' }, { value: 'other', label: 'Sonstige' },
      ], draft.pose, (v) => { draft.pose = v; })),
      field('Notiz', el('input', { type: 'text', placeholder: 'optional', oninput: (e) => { draft.note = e.target.value; } }))),
    el('label', { class: 'btn primary wide' }, 'Foto aufnehmen oder waehlen',
      el('input', {
        type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' },
        onchange: async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            await addPhoto(file, { at: fromLocalInput(draft.at), note: draft.note, pose: draft.pose });
            refresh();
          } catch (err) { alert(`Foto konnte nicht gespeichert werden: ${err.message}`); }
        },
      })),
    info));
  host.appendChild(card('Galerie', gallery));
  refresh();
  return host;
}

function exportCsv(log) {
  const columns = [
    { label: 'Datum', get: (b) => new Date(b.at).toISOString() },
    { label: 'Gewicht kg', get: (b) => b.weightKg ?? '' },
    { label: 'KFA %', get: (b) => b.bodyFat ?? '' },
    ...MEASUREMENTS.map((m) => ({ label: `${m.label} cm`, get: (b) => b[m.id] ?? '' })),
    { label: 'RR sys', get: (b) => b.systolic ?? '' },
    { label: 'RR dia', get: (b) => b.diastolic ?? '' },
    { label: 'Ruhepuls', get: (b) => b.restingHr ?? '' },
    { label: 'Schlaf h', get: (b) => b.sleepHours ?? '' },
    { label: 'Schritte', get: (b) => b.steps ?? '' },
    { label: 'kcal', get: (b) => b.kcal ?? '' },
    { label: 'Eiweiss g', get: (b) => b.proteinG ?? '' },
    { label: 'Nebenwirkungen', get: (b) => (b.sides || []).join(', ') },
    { label: 'Notiz', get: (b) => b.note || '' },
  ];
  downloadFile(`koerperdaten-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(log, columns), 'text/csv');
}
