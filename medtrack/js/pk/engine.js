/**
 * Pharmakokinetik-Engine.
 *
 * Modell: Ein-Kompartiment-Modell mit Resorption erster Ordnung aus dem
 * oeligen Depot (Bateman-Funktion). Fuer lange Ester ist die Freisetzung
 * langsamer als die Elimination ("Flip-Flop-Kinetik") - die beobachtete
 * terminale Halbwertszeit entspricht dann der Ester-Halbwertszeit. Das
 * ergibt sich aus der Gleichung automatisch, es braucht keine Fallunterscheidung.
 *
 *   A(t) = D_base * ka/(ka-ke) * (e^(-ke*t) - e^(-ka*t))     [mg im Blutkreislauf]
 *   Depot(t) = D_base * e^(-ka*t)                            [mg noch im Depot]
 *
 * Alle Zeiten in Tagen. Alle Mengen in mg (bzw. IE) Basis-Hormon.
 */

import { baseAmount } from './compounds.js';

export const LN2 = Math.LN2;
export const MS_PER_DAY = 86400000;

export const rate = (halfLifeDays) => LN2 / halfLifeDays;

/** Umrechnung mg/L -> ng/dl (1 mg/L = 100000 ng/dl). */
export const MGL_TO_NGDL = 1e5;
/** Testosteron: ng/dl -> nmol/l. */
export const NGDL_TO_NMOL_T = 0.03467;

export function ratesFor(compound) {
  return {
    ka: rate(compound.tHalfAbs),
    ke: rate(compound.tHalfElim ?? compound.tHalfAbs / 50),
  };
}

/** Wirkstoffmenge im zentralen Kompartiment t Tage nach einer Einzeldosis. */
export function bateman(baseMg, ka, ke, t) {
  if (t <= 0 || baseMg <= 0) return 0;
  const d = ka - ke;
  // Grenzfall ka ~ ke: A(t) = D * ka * t * e^(-ka t)
  if (Math.abs(d) < 1e-9) return baseMg * ka * t * Math.exp(-ka * t);
  return (baseMg * ka / d) * (Math.exp(-ke * t) - Math.exp(-ka * t));
}

/** Noch nicht freigesetzter Anteil im Depot. */
export function depotRemaining(baseMg, ka, t) {
  if (t <= 0) return baseMg;
  return baseMg * Math.exp(-ka * t);
}

/** Zeitpunkt des Maximums nach einer Einzeldosis (Tage). */
export function tMax(ka, ke) {
  if (Math.abs(ka - ke) < 1e-9) return 1 / ka;
  return Math.log(ka / ke) / (ka - ke);
}

/** Terminale Halbwertszeit = die langsamere der beiden Phasen. */
export function terminalHalfLife(compound) {
  const { ka, ke } = ratesFor(compound);
  return LN2 / Math.min(ka, ke);
}

/**
 * Wandelt Logbuch-Eintraege in Dosis-Ereignisse um.
 * entries: [{ at: ISO-String|Date|number, compoundId, doseMg }]
 */
export function buildDoseEvents(entries, resolve, refMs) {
  const ref = refMs ?? Date.now();
  const out = [];
  for (const e of entries) {
    const compound = resolve(e.compoundId);
    if (!compound) continue;
    const ms = e.at instanceof Date ? e.at.getTime() : typeof e.at === 'number' ? e.at : Date.parse(e.at);
    if (Number.isNaN(ms)) continue;
    const { ka, ke } = ratesFor(compound);
    out.push({
      t: (ms - ref) / MS_PER_DAY,   // relativ zum Referenzzeitpunkt ("jetzt" = 0)
      ms,
      baseMg: baseAmount(compound, Number(e.doseMg) || 0),
      doseMg: Number(e.doseMg) || 0,
      ka, ke, compound, entry: e,
    });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Summierte Wirkstoffmenge aller Dosen zum Zeitpunkt t (Superposition). */
export function amountAt(events, t) {
  let sum = 0;
  for (const d of events) sum += bateman(d.baseMg, d.ka, d.ke, t - d.t);
  return sum;
}

export function depotAt(events, t) {
  let sum = 0;
  for (const d of events) if (t >= d.t) sum += depotRemaining(d.baseMg, d.ka, t - d.t);
  return sum;
}

/** Serumkonzentration in ng/dl - nur wenn ein Verteilungsvolumen hinterlegt ist. */
export function concentration(amountMg, compound, weightKg) {
  if (!compound.vdLPerKg) return null;
  const vd = compound.vdLPerKg * weightKg;
  return (amountMg / vd) * MGL_TO_NGDL;
}

/**
 * Simuliert einen Zeitraum. Rueckgabe enthaelt eine Zeitachse und je eine
 * Reihe pro Basis-Hormon (z. B. "Testosteron", "Trenbolon") - Ester der
 * gleichen Basis werden zusammengefasst, weil sie im Koerper identisch wirken.
 */
export function simulate(events, { fromDays, toDays, points = 400, weightKg = 80, calibration = 1 }) {
  const step = (toDays - fromDays) / (points - 1);
  const t = new Array(points);
  const bases = new Map();

  for (const d of events) {
    if (!bases.has(d.compound.base)) {
      bases.set(d.compound.base, {
        base: d.compound.base,
        cls: d.compound.cls,
        unit: d.compound.unit || 'mg',
        amount: new Array(points).fill(0),
        depot: new Array(points).fill(0),
        serum: new Array(points).fill(0),
        hasVd: true,
      });
    }
    if (!d.compound.vdLPerKg) bases.get(d.compound.base).hasVd = false;
  }

  for (let i = 0; i < points; i++) {
    const time = fromDays + i * step;
    t[i] = time;
    for (const d of events) {
      const s = bases.get(d.compound.base);
      const a = bateman(d.baseMg, d.ka, d.ke, time - d.t);
      s.amount[i] += a;
      if (time >= d.t) s.depot[i] += depotRemaining(d.baseMg, d.ka, time - d.t);
      if (d.compound.vdLPerKg) {
        s.serum[i] += (a / (d.compound.vdLPerKg * weightKg)) * MGL_TO_NGDL * calibration;
      }
    }
  }

  const series = [...bases.values()].map((s) => {
    if (!s.hasVd) s.serum = null;
    // Relative Kurve (0-100 %) fuer Substanzen ohne belastbares Vd
    const peak = Math.max(...s.amount, 1e-12);
    s.relative = s.amount.map((v) => (v / peak) * 100);
    return s;
  });

  return { t, series, step };
}

/**
 * Kennzahlen fuer ein regelmaessiges Protokoll (gleiche Dosis, festes Intervall).
 * Numerisch ueber Superposition - robust auch bei Flip-Flop-Kinetik.
 */
export function steadyState(compound, doseMg, intervalDays, { weightKg = 80 } = {}) {
  const { ka, ke } = ratesFor(compound);
  const base = baseAmount(compound, doseMg);
  const tTerm = LN2 / Math.min(ka, ke);
  const horizon = Math.max(20 * tTerm, intervalDays * 10);
  const n = Math.ceil(horizon / intervalDays) + 1;
  const events = [];
  for (let i = 0; i < n; i++) events.push({ t: i * intervalDays, baseMg: base, ka, ke });

  const last = (n - 1) * intervalDays;
  let min = Infinity, max = -Infinity, sum = 0;
  const steps = 400;
  for (let i = 0; i <= steps; i++) {
    const t = last + (i / steps) * intervalDays;
    const a = amountAt(events, t);
    min = Math.min(min, a); max = Math.max(max, a); sum += a;
  }
  const avg = sum / (steps + 1);
  const conv = (a) => concentration(a, compound, weightKg);

  return {
    tTerminalHalfLife: tTerm,
    timeTo90Percent: 3.32 * tTerm,
    timeTo95Percent: 4.32 * tTerm,
    peakTroughRatio: min > 0 ? max / min : Infinity,
    fluctuationPercent: avg > 0 ? ((max - min) / avg) * 100 : 0,
    amount: { min, max, avg },
    serum: compound.vdLPerKg ? { min: conv(min), max: conv(max), avg: conv(avg) } : null,
    weeklyBaseMg: base * (7 / intervalDays),
  };
}

/**
 * Kalibrierungsfaktor aus einem gemessenen Laborwert: Wie stark weicht der
 * reale Spiegel vom Modell ab? Individuelle Unterschiede in Clearance und
 * Verteilungsvolumen sind gross - deshalb ist diese Anpassung wichtig.
 */
export function calibrationFactor(events, labs, { weightKg = 80, base = 'Testosteron' } = {}) {
  const points = [];
  for (const lab of labs) {
    const ms = Date.parse(lab.at);
    if (Number.isNaN(ms)) continue;
    const tDays = (ms - (events[0]?.refMs ?? Date.now())) / MS_PER_DAY;
    let predicted = 0;
    for (const d of events) {
      if (d.compound.base !== base || !d.compound.vdLPerKg) continue;
      const a = bateman(d.baseMg, d.ka, d.ke, tDays - d.t);
      predicted += (a / (d.compound.vdLPerKg * weightKg)) * MGL_TO_NGDL;
    }
    if (predicted > 0) points.push(lab.value / predicted);
  }
  if (!points.length) return { factor: 1, n: 0 };
  points.sort((a, b) => a - b);
  const mid = Math.floor(points.length / 2);
  const factor = points.length % 2 ? points[mid] : (points[mid - 1] + points[mid]) / 2;
  return { factor, n: points.length };
}

/** Anteil der Dosis, der zum Zeitpunkt t bereits freigesetzt wurde (%). */
export function releasedPercent(compound, tDays) {
  const { ka } = ratesFor(compound);
  return (1 - Math.exp(-ka * tDays)) * 100;
}

export function formatDuration(days) {
  if (!Number.isFinite(days)) return '-';
  if (days < 1 / 24) return `${Math.round(days * 24 * 60)} min`;
  if (days < 2) return `${(days * 24).toFixed(1)} h`;
  if (days < 90) return `${days.toFixed(1)} d`;
  return `${(days / 7).toFixed(1)} Wochen`;
}
