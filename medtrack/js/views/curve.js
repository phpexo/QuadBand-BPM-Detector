import { el, card, stat, fmt, field, select } from '../ui/dom.js';
import { lineChart, legend, PALETTE } from '../ui/chart.js';
import { doseEvents, pastEvents, resolver } from '../model.js';
import {
  simulate, steadyState, terminalHalfLife, tMax, ratesFor, formatDuration,
  releasedPercent, calibrationFactor, concentration, MS_PER_DAY, NGDL_TO_NMOL_T,
} from '../pk/engine.js';
import { setSetting } from '../store.js';
import { activeCompounds } from '../safety/advice.js';

const MODES = [
  { value: 'serum', label: 'Serumspiegel (Modell)' },
  { value: 'amount', label: 'Zirkulierende Wirkstoffmenge (mg)' },
  { value: 'depot', label: 'Noch im Depot (mg)' },
];

export function render(ctx) {
  const { state, now, rerender } = ctx;
  const s = state.settings;
  const root = el('div', { class: 'view' });
  const past = pastEvents(state, now);

  if (!past.length) {
    return el('div', { class: 'view' }, card('Wirkstoffkurve',
      el('p', {}, 'Sobald du eine Gabe eingetragen hast, erscheint hier der berechnete Verlauf.'),
      el('a', { class: 'btn primary', href: '#/medikation' }, 'Zur Medikation')));
  }

  const mode = s.curveMode || 'serum';
  const events = doseEvents(state, { now, horizonDays: s.curveWindowFuture || 30 });

  // ---------------------------------------------------------------- Steuerung
  const controls = el('div', { class: 'controls' },
    field('Darstellung', select(MODES, mode, (v) => { setSetting('curveMode', v); rerender(); })),
    field('Rueckblick', select([7, 14, 30, 60, 90, 180, 365].map((d) => ({ value: d, label: `${d} Tage` })),
      s.curveWindowPast, (v) => { setSetting('curveWindowPast', Number(v)); rerender(); })),
    field('Vorschau', select([0, 7, 14, 30, 60, 90].map((d) => ({ value: d, label: d ? `${d} Tage` : 'keine' })),
      s.curveWindowFuture, (v) => { setSetting('curveWindowFuture', Number(v)); rerender(); })),
    field('Koerpergewicht', el('input', {
      type: 'number', value: s.weightKg, min: 30, max: 250, step: 1,
      onchange: (e) => { setSetting('weightKg', Number(e.target.value)); rerender(); },
    }), 'geht in das Verteilungsvolumen ein'));
  root.appendChild(controls);

  const sim = simulate(events, {
    fromDays: -(s.curveWindowPast || 30), toDays: s.curveWindowFuture || 30,
    points: 420, weightKg: s.weightKg, calibration: s.calibration || 1,
  });

  // Substanzen mit und ohne Blutspiegel-Schaetzung gehoeren nicht auf dieselbe Achse.
  const series = sim.series.map((serie, i) => {
    const values = mode === 'serum'
      ? (serie.serum || serie.relative)
      : mode === 'depot' ? serie.depot : serie.amount;
    const unit = mode === 'serum' ? (serie.serum ? 'ng/dl' : '% vom Maximum') : 'mg';
    return {
      label: `${serie.base} (${unit})`,
      color: PALETTE[i % PALETTE.length],
      points: sim.t.map((t, j) => [t, values[j]]),
      hasVd: !!serie.serum,
    };
  });
  const normalized = mode === 'serum' ? series.filter((x) => !x.hasVd) : [];
  const primary = mode === 'serum' ? series.filter((x) => x.hasVd) : series;
  for (const x of [primary[0], normalized[0]]) if (x) x.area = true;

  const bands = mode === 'serum' && primary.length
    ? [{ from: 300, to: 1000, color: 'var(--band)' }] : [];
  const baseOpts = {
    nowX: 0, height: 300, markers: past.map((d) => ({ x: d.t })),
    formatX: (v) => `${v > 0 ? '+' : ''}${Math.round(v)} d`,
    formatY: (v) => fmt.int(v),
  };

  root.appendChild(card('Verlauf',
    primary.length ? lineChart({ ...baseOpts, series: primary, bands }) : null,
    primary.length ? legend(primary) : null,
    bands.length
      ? el('p', { class: 'muted small' }, 'Blau hinterlegt: ueblicher Referenzbereich fuer Gesamt-Testosteron (300-1000 ng/dl). Laborreferenzen unterscheiden sich - massgeblich ist dein eigener Befund.')
      : null,
    normalized.length ? el('h3', {}, 'Substanzen ohne Blutspiegel-Schaetzung') : null,
    normalized.length ? lineChart({ ...baseOpts, series: normalized, height: 220, yMax: 105 }) : null,
    normalized.length ? legend(normalized) : null,
    normalized.length
      ? el('p', { class: 'warn-inline' }, 'Fuer diese Substanzen gibt es keine belastbaren humanen PK-Daten. Die Kurve ist auf 100 % normiert und zeigt nur den zeitlichen Verlauf, keinen Blutspiegel. Sie steht bewusst in einem eigenen Diagramm, damit sie nicht mit den ng/dl-Werten verwechselt wird.')
      : null));

  // ---------------------------------------------------------------- Substanz-Kennzahlen
  const active = activeCompounds(past, 0, 1);
  if (active.length) {
    const rows = el('div', { class: 'cmp-grid' });
    for (const a of active) {
      const c = a.compound;
      const { ka, ke } = ratesFor(c);
      const lastDose = past.filter((d) => d.compound.id === c.id).sort((x, y) => y.t - x.t)[0];
      const sinceLast = lastDose ? -lastDose.t : null;
      const conc = c.vdLPerKg ? concentration(a.amount, c, s.weightKg) * (s.calibration || 1) : null;
      rows.appendChild(el('div', { class: 'cmp-card' },
        el('h3', {}, c.name),
        el('div', { class: 'cmp-rows' },
          row('Ester-Halbwertszeit', `${formatDuration(c.tHalfAbs)}${c.absRange ? ` (Literaturspanne ${formatDuration(c.absRange[0])} - ${formatDuration(c.absRange[1])})` : ''}`),
          row('Terminale Halbwertszeit', formatDuration(terminalHalfLife(c))),
          row('Peak nach Einzeldosis', formatDuration(tMax(ka, ke))),
          row('Ester-Faktor', `${fmt.num(c.esterFactor * 100, 1)} % Basis-Hormon`),
          row('Letzte Gabe', sinceLast != null ? `vor ${formatDuration(sinceLast)}` : '-'),
          sinceLast != null ? row('Davon freigesetzt', `${fmt.num(releasedPercent(c, sinceLast), 1)} %`) : null,
          row('Aktuell zirkulierend', `${fmt.num(a.amount, 2)} mg`),
          conc != null ? row('Anteil am Serumspiegel', `${fmt.int(conc)} ng/dl`) : null,
          row('Datenqualitaet', confidenceLabel(c.confidence))),
        c.note ? el('p', { class: 'cmp-note' }, c.note) : null));
    }
    root.appendChild(card('Substanzen im Koerper', rows));
  }

  // ---------------------------------------------------------------- Steady State
  const protocols = (state.protocols || []).filter((p) => p.active);
  if (protocols.length) {
    const resolve = resolver(state);
    const list = el('div', { class: 'cmp-grid' });
    for (const p of protocols) {
      const c = resolve(p.compoundId);
      if (!c) continue;
      const ss = steadyState(c, Number(p.doseMg), Number(p.intervalDays), { weightKg: s.weightKg });
      const cal = s.calibration || 1;
      const start = p.startAt ? (now - Date.parse(p.startAt)) / MS_PER_DAY : null;
      list.appendChild(el('div', { class: 'cmp-card' },
        el('h3', {}, `${c.short || c.name} · ${p.doseMg} mg alle ${p.intervalDays} Tage`),
        el('div', { class: 'cmp-rows' },
          row('Basis-Hormon pro Woche', `${fmt.num(ss.weeklyBaseMg, 1)} mg`),
          ss.serum ? row('Erwarteter Mittelwert', `${fmt.int(ss.serum.avg * cal)} ng/dl (${fmt.num(ss.serum.avg * cal * NGDL_TO_NMOL_T, 1)} nmol/l)`) : null,
          ss.serum ? row('Spitze / Tal', `${fmt.int(ss.serum.max * cal)} / ${fmt.int(ss.serum.min * cal)} ng/dl`) : null,
          row('Schwankungsbreite', `${fmt.num(ss.fluctuationPercent, 0)} % (Peak/Tal ${fmt.num(ss.peakTroughRatio, 2)})`),
          row('90 % des Endniveaus nach', formatDuration(ss.timeTo90Percent)),
          row('95 % des Endniveaus nach', formatDuration(ss.timeTo95Percent)),
          start != null ? row('Protokoll laeuft seit', formatDuration(start)) : null,
          start != null ? row('Status', start >= ss.timeTo90Percent ? 'Fliessgleichgewicht erreicht' : `noch im Aufbau (${fmt.num((start / ss.timeTo90Percent) * 100, 0)} %)`) : null)));
    }
    root.appendChild(card('Fliessgleichgewicht deiner Protokolle', list,
      el('p', { class: 'muted small' },
        'Nach einer Aenderung dauert es rund 4-5 terminale Halbwertszeiten, bis sich ein neues Niveau eingestellt hat. Blutwerte vorher sind nur begrenzt aussagekraeftig.')));
  }

  // ---------------------------------------------------------------- Absetz-Szenario
  root.appendChild(decayCard(state, now));

  // ---------------------------------------------------------------- Kalibrierung
  root.appendChild(calibrationCard(state, now, rerender));

  root.appendChild(card('Wie die Kurve berechnet wird',
    el('p', {}, 'Zugrunde liegt ein Ein-Kompartiment-Modell mit Resorption erster Ordnung (Bateman-Funktion): Der Ester wird mit seiner Freisetzungs-Halbwertszeit aus dem Oeldepot abgegeben, das freie Hormon wird parallel eliminiert. Bei langen Estern ist die Freisetzung der langsamere Schritt - der Spiegel faellt deshalb mit der Ester-Halbwertszeit, nicht mit der des Hormons.'),
    el('p', { class: 'muted small' }, 'Das Modell bildet den Mittelwert einer Population ab. Reale Werte streuen individuell erheblich (Clearance, Verteilungsvolumen, SHBG, Injektionsort, Oelvolumen). Die Kurve ersetzt keine Blutabnahme - sie hilft, den richtigen Zeitpunkt dafuer zu waehlen.')));

  return root;
}

function row(label, value) {
  return value == null ? null : el('div', { class: 'cmp-row' },
    el('span', {}, label), el('b', {}, value));
}

function confidenceLabel(c) {
  return { high: 'gut belegt (Zulassungsdaten)', medium: 'einzelne Studien', low: 'nur Erfahrungswerte' }[c] || 'unbekannt';
}

function decayCard(state, now) {
  const past = pastEvents(state, now);
  if (!past.length) return null;
  const s = state.settings;
  const sim = simulate(past, { fromDays: 0, toDays: 180, points: 360, weightKg: s.weightKg, calibration: s.calibration || 1 });
  const lines = [];
  for (const serie of sim.series) {
    const values = serie.serum || serie.amount;
    const peak = values[0];
    const idx10 = values.findIndex((v) => v < peak * 0.1);
    const idx1 = values.findIndex((v) => v < peak * 0.01);
    lines.push(el('div', { class: 'cmp-row' },
      el('span', {}, `${serie.base}: unter 10 % des heutigen Werts`),
      el('b', {}, idx10 > 0 ? `nach ${formatDuration(sim.t[idx10])}` : 'innerhalb von Stunden')));
    if (idx1 > 0) {
      lines.push(el('div', { class: 'cmp-row' },
        el('span', {}, `${serie.base}: praktisch vollstaendig eliminiert`),
        el('b', {}, `nach ${formatDuration(sim.t[idx1])}`)));
    }
  }
  return card('Wenn ab heute keine weitere Gabe erfolgt',
    el('div', { class: 'cmp-rows' }, lines),
    el('p', { class: 'muted small' },
      'Nach dem Absetzen exogener Androgene braucht die koerpereigene Achse (LH/FSH) zusaetzlich Wochen bis Monate zur Erholung - dieser Teil laesst sich nicht aus der Kurve ablesen und gehoert aerztlich begleitet. Bei einer aerztlich verordneten Dauertherapie ist ein eigenmaechtiges Absetzen keine gute Idee: Sprich es vorher mit deinem Arzt ab.'));
}

function calibrationCard(state, now, rerender) {
  const s = state.settings;
  const panels = (state.panels || []).filter((p) => p.values?.total_t);
  const past = pastEvents(state, now);
  let suggestion = null;
  if (panels.length && past.length) {
    past.forEach((e) => { e.refMs = now; });
    const labs = panels.map((p) => ({ at: p.at, value: Number(p.values.total_t) }));
    const { factor, n } = calibrationFactor(past, labs, { weightKg: s.weightKg });
    if (n) suggestion = { factor, n };
  }
  return card('Kalibrierung auf deine Blutwerte',
    el('p', {}, 'Individuelle Clearance und Verteilungsvolumen weichen vom Modellmittelwert ab. Mit gemessenen Testosteronwerten laesst sich die Kurve auf dich anpassen.'),
    el('div', { class: 'controls' },
      field('Faktor', el('input', {
        type: 'number', step: 0.01, min: 0.2, max: 3, value: s.calibration || 1,
        onchange: (e) => { setSetting('calibration', Number(e.target.value) || 1); rerender(); },
      }), '1,00 = unveraendertes Modell')),
    suggestion
      ? el('p', {}, `Aus ${suggestion.n} Laborwert(en) errechneter Faktor: `,
          el('b', {}, fmt.num(suggestion.factor, 2)), ' ',
          el('button', { class: 'btn small', onclick: () => { setSetting('calibration', suggestion.factor); rerender(); } }, 'uebernehmen'))
      : el('p', { class: 'muted small' }, 'Trage unter "Labor" mindestens einen Gesamt-Testosteronwert mit Datum und Uhrzeit ein, dann wird hier automatisch ein Faktor vorgeschlagen.'));
}
