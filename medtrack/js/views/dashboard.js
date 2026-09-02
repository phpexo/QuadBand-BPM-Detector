import { el, card, stat, fmt } from '../ui/dom.js';
import { lineChart, legend, PALETTE } from '../ui/chart.js';
import { doseEvents, pastEvents, nextScheduled, bodyMetrics } from '../model.js';
import { simulate, amountAt, concentration, MS_PER_DAY } from '../pk/engine.js';
import { buildAdvice, activeCompounds, weeklyLoad } from '../safety/advice.js';
import { MARKER_BY_ID } from '../safety/labs.js';

const LEVEL_LABEL = { emergency: 'Notfall', urgent: 'Dringend', warn: 'Achtung', info: 'Hinweis', ok: 'In Ordnung' };

export function adviceCard(a) {
  return el('div', { class: `advice advice-${a.level}` },
    el('div', { class: 'advice-head' },
      el('span', { class: 'badge' }, LEVEL_LABEL[a.level] || a.level),
      el('strong', {}, a.title)),
    el('p', {}, a.text),
    a.action ? el('p', { class: 'advice-action' }, `→ ${a.action}`) : null);
}

export function render(ctx) {
  const { state, now } = ctx;
  const settings = state.settings;
  const events = doseEvents(state, { now, horizonDays: 45 });
  const past = pastEvents(state, now);
  const advice = buildAdvice(state, past, now);
  const active = activeCompounds(past, 0);
  const load = weeklyLoad(past, 0);
  const next = nextScheduled(state, now);

  const root = el('div', { class: 'view' });

  // ---------------------------------------------------------------- Kennzahlen
  const cards = el('div', { class: 'stat-grid' });

  const tCompounds = active.filter((c) => c.compound.base === 'Testosteron' && c.compound.vdLPerKg);
  if (tCompounds.length) {
    const amount = tCompounds.reduce((s, c) => s + c.amount, 0);
    const ngdl = concentration(amount, tCompounds[0].compound, settings.weightKg) * (settings.calibration || 1);
    cards.appendChild(stat('Testosteron im Serum (Modell)',
      `${fmt.int(ngdl)} ng/dl`, `${fmt.num(ngdl * 0.03467, 1)} nmol/l · geschaetzt`));
  }
  for (const c of active.filter((c) => !c.compound.vdLPerKg)) {
    cards.appendChild(stat(`${c.compound.base} aktiv`, `${fmt.num(c.amount, 2)} mg`, 'zirkulierende Wirkstoffmenge'));
  }
  const depotTotal = past.reduce((s, d) => s + (d.t <= 0 ? d.baseMg * Math.exp(-d.ka * -d.t) : 0), 0);
  cards.appendChild(stat('Im Depot verbleibend', `${fmt.num(depotTotal, 1)} mg`, 'noch nicht freigesetzt'));

  if (Object.keys(load).length) {
    cards.appendChild(stat('Wochenlast (Basis-Hormon)',
      Object.entries(load).map(([, mg]) => `${Math.round(mg)} mg`).join(' / '),
      `${Object.keys(load).join(' / ')} · Mittel der letzten 28 Tage`));
  }
  if (next) {
    cards.appendChild(stat('Naechste geplante Gabe',
      next.inDays < 0.05 ? 'jetzt faellig' : fmt.relDays(next.inDays),
      `${next.compound?.short || ''} ${next.doseMg} mg · ${fmt.dateTime(next.at)}`,
      next.inDays < 0 ? 'tone-warn' : ''));
  }
  const bodyLog = [...(state.bodyLog || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const lastBody = bodyLog[0];
  const bm = bodyMetrics(lastBody, settings.heightCm);
  if (bm) {
    cards.appendChild(stat('Koerpergewicht', `${fmt.num(bm.weight, 1)} kg`,
      bm.ffmi ? `FFMI ${fmt.num(bm.ffmi, 1)} · KFA ${fmt.num(bm.bodyFat, 1)} %` : `BMI ${fmt.num(bm.bmi, 1)}`));
  }
  const bp = bodyLog.find((b) => b.systolic);
  if (bp) {
    const tone = bp.systolic >= 140 || bp.diastolic >= 90 ? 'tone-warn' : '';
    cards.appendChild(stat('Blutdruck', `${bp.systolic}/${bp.diastolic}`, fmt.date(bp.at), tone));
  }
  const lastPanel = [...(state.panels || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  if (lastPanel?.values?.hematocrit) {
    const v = Number(lastPanel.values.hematocrit);
    cards.appendChild(stat('Haematokrit', `${fmt.num(v, 1)} %`, fmt.date(lastPanel.at),
      v >= 54 ? 'tone-urgent' : v >= 52 ? 'tone-warn' : ''));
  }
  root.appendChild(cards);

  // ---------------------------------------------------------------- Hinweise
  const top = advice.filter((a) => a.level !== 'ok').slice(0, 4);
  if (top.length) {
    root.appendChild(card('Was jetzt wichtig ist', ...top.map(adviceCard),
      advice.length > top.length
        ? el('a', { class: 'link', href: '#/sicherheit' }, `Alle ${advice.length} Hinweise ansehen`)
        : null));
  } else {
    root.appendChild(card('Status', el('p', { class: 'muted' },
      'Keine offenen Warnhinweise. Werte trotzdem regelmaessig eintragen - Trends sind aussagekraeftiger als Einzelwerte.')));
  }

  // ---------------------------------------------------------------- Kurve
  if (events.length) {
    const sim = simulate(events, {
      fromDays: -(settings.curveWindowPast || 30), toDays: settings.curveWindowFuture || 30,
      points: 300, weightKg: settings.weightKg, calibration: settings.calibration || 1,
    });
    const markers = past.map((d) => ({ x: d.t }));
    const opts = {
      markers, nowX: 0, height: 240,
      formatX: (v) => (v === 0 ? '0' : `${v > 0 ? '+' : ''}${Math.round(v)} d`),
      formatY: (v) => fmt.int(v),
    };
    const withVd = [], withoutVd = [];
    sim.series.forEach((serie, i) => {
      const target = serie.serum ? withVd : withoutVd;
      target.push({
        label: serie.serum ? `${serie.base} (ng/dl)` : `${serie.base} (% vom Maximum)`,
        color: PALETTE[i % PALETTE.length],
        points: sim.t.map((t, j) => [t, serie.serum ? serie.serum[j] : serie.relative[j]]),
        area: target.length === 0,
      });
    });
    root.appendChild(card('Wirkstoffverlauf',
      withVd.length ? lineChart({ ...opts, series: withVd }) : null,
      withVd.length ? legend(withVd) : null,
      withoutVd.length ? el('h3', {}, 'Ohne Blutspiegel-Schaetzung (relativer Verlauf)') : null,
      withoutVd.length ? lineChart({ ...opts, series: withoutVd, yMax: 105 }) : null,
      withoutVd.length ? legend(withoutVd) : null,
      el('p', { class: 'muted small' },
        'Links der "jetzt"-Linie steht der Verlauf aus deinen Eintraegen, rechts davon die Projektion aus deinen aktiven Protokollen.'),
      el('a', { class: 'link', href: '#/kurve' }, 'Detailansicht mit Halbwertszeiten oeffnen')));
  } else {
    root.appendChild(card('Noch keine Daten',
      el('p', {}, 'Trage deine erste Gabe unter "Medikation" ein - danach berechnet die App den Wirkstoffverlauf, die Halbwertszeitkurve und den Zeitpunkt bis zum Fliessgleichgewicht.'),
      el('a', { class: 'btn primary', href: '#/medikation' }, 'Gabe eintragen')));
  }

  // ---------------------------------------------------------------- Training
  const weekAgo = now - 7 * MS_PER_DAY;
  const weekWorkouts = (state.workouts || []).filter((w) => Date.parse(w.at) >= weekAgo);
  const weekSets = weekWorkouts.reduce((s, w) => s + (w.sets?.length || 0), 0);
  const weekVolume = weekWorkouts.reduce((s, w) =>
    s + (w.sets || []).reduce((v, x) => v + (Number(x.weight) || 0) * (Number(x.reps) || 0), 0), 0);
  root.appendChild(card('Training (letzte 7 Tage)',
    el('div', { class: 'stat-grid compact' },
      stat('Einheiten', String(weekWorkouts.length)),
      stat('Saetze', String(weekSets)),
      stat('Volumen', `${fmt.int(weekVolume)} kg`))));

  return root;
}
