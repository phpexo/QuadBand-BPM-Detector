/**
 * Regelbasierte Hinweise zur Schadensminimierung.
 *
 * Diese Datei gibt bewusst KEINE Dosierungs- oder Kurempfehlungen. Sie
 * bewertet ausschliesslich das, was die nutzende Person selbst eingetragen
 * hat, und weist auf Kontrollen, Warnzeichen und aerztlichen Klaerungsbedarf hin.
 */

import { evaluatePanel, markerTrend } from './labs.js';
import { amountAt, MS_PER_DAY } from '../pk/engine.js';

export const LEVEL_ORDER = { emergency: 4, urgent: 3, warn: 2, info: 1, ok: 0 };

const days = (ms) => ms / MS_PER_DAY;
const since = (iso, now) => (iso ? days(now - Date.parse(iso)) : Infinity);

/**
 * Substanzen, von denen aktuell noch relevante Mengen im Koerper sind.
 * Massstab ist die hoechste Menge, die diese Substanz im bisherigen Verlauf
 * erreicht hat - nicht die Dosis: bei Flip-Flop-Kinetik zirkuliert immer nur
 * ein kleiner Bruchteil der Depotmenge gleichzeitig.
 */
export function activeCompounds(events, nowDays = 0, thresholdPercent = 5) {
  const byId = new Map();
  for (const d of events) {
    if (d.t > nowDays) continue;
    const cur = byId.get(d.compound.id) || { compound: d.compound, events: [], last: -Infinity };
    cur.events.push(d);
    cur.last = Math.max(cur.last, d.t);
    byId.set(d.compound.id, cur);
  }
  const out = [];
  for (const cur of byId.values()) {
    const first = Math.min(...cur.events.map((e) => e.t));
    let peak = 0;
    const steps = 200;
    for (let i = 0; i <= steps; i++) {
      peak = Math.max(peak, amountAt(cur.events, first + ((nowDays - first) * i) / steps));
    }
    const amount = amountAt(cur.events, nowDays);
    const depot = cur.events.reduce((sum, e) => sum + e.baseMg * Math.exp(-e.ka * (nowDays - e.t)), 0);
    if (peak > 0 && amount > (peak * thresholdPercent) / 100) {
      out.push({ compound: cur.compound, amount, depot, peak, last: cur.last });
    }
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/** Basis-Hormon-Menge pro Woche, gemittelt ueber die letzten `window` Tage. */
export function weeklyLoad(events, nowDays = 0, window = 28) {
  const out = {};
  for (const d of events) {
    if (d.t < nowDays - window || d.t > nowDays) continue;
    out[d.compound.base] = (out[d.compound.base] || 0) + d.baseMg;
  }
  for (const k of Object.keys(out)) out[k] = (out[k] / window) * 7;
  return out;
}

/**
 * Erzeugt die Hinweisliste.
 * state: { injections, panels, bodyLog, settings, doctorVisits }
 * events: aufbereitete Dosis-Ereignisse (siehe pk/engine.js)
 */
export function buildAdvice(state, events, now = Date.now()) {
  const out = [];
  const add = (a) => out.push(a);
  const settings = state.settings || {};
  const panels = [...(state.panels || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const lastPanel = panels[0];
  const active = activeCompounds(events, 0);
  const load = weeklyLoad(events, 0);
  const supraphysiological = (load.Testosteron || 0) > 200
    || Object.entries(load).some(([base, mg]) => base !== 'Testosteron' && mg > 0);

  // ---------------------------------------------------------------- Blutbild faellig
  const gap = since(lastPanel?.at, now);
  const interval = supraphysiological ? 90 : (settings.labIntervalDays || 180);
  if (!lastPanel) {
    add({ id: 'lab-baseline', level: 'urgent', title: 'Kein Ausgangsbefund hinterlegt',
      text: 'Ohne Ausgangswerte laesst sich spaeter nicht beurteilen, was sich veraendert hat. Ein vollstaendiges Basislabor (Blutbild, Leber, Niere, Lipide, Hormone, PSA) sollte vor oder zeitnah zu einer laufenden Therapie erhoben werden.',
      action: 'Termin beim Arzt vereinbaren und Basislabor abnehmen lassen.' });
  } else if (gap > interval) {
    add({ id: 'lab-due', level: gap > interval * 2 ? 'urgent' : 'warn',
      title: `Blutkontrolle ueberfaellig (letzte vor ${Math.round(gap)} Tagen)`,
      text: `Empfohlenes Kontrollintervall in deiner Situation: etwa alle ${interval} Tage. Nach jeder Dosis- oder Praeparateaenderung zusaetzlich nach 6-12 Wochen kontrollieren.`,
      action: 'Blutabnahme organisieren - Talwert kurz vor der naechsten Injektion.' });
  } else {
    add({ id: 'lab-ok', level: 'ok', title: 'Blutkontrolle aktuell',
      text: `Letzter Befund vor ${Math.round(gap)} Tagen. Naechste Kontrolle in etwa ${Math.max(0, Math.round(interval - gap))} Tagen.` });
  }

  // ---------------------------------------------------------------- Auffaellige Laborwerte
  if (lastPanel) {
    for (const r of evaluatePanel(lastPanel)) {
      if (r.level === 'ok' || r.level === 'watch') continue;
      add({
        id: `lab-${r.marker.id}`,
        level: r.level === 'urgent' ? 'urgent' : 'warn',
        title: `${r.marker.name}: ${r.value} ${r.marker.unit} - ${r.text}`,
        text: r.marker.hint || 'Wert liegt ausserhalb des ueblichen Bereichs.',
        action: r.level === 'urgent'
          ? 'Zeitnah aerztlich abklaeren lassen und den Befund mitnehmen.'
          : 'Beim naechsten Arzttermin ansprechen und im Verlauf kontrollieren.',
      });
    }
    // Haematokrit-Trend
    const hct = markerTrend(panels.slice().reverse(), 'hematocrit');
    if (hct.length >= 2) {
      const delta = hct[hct.length - 1].value - hct[hct.length - 2].value;
      if (delta >= 3) {
        add({ id: 'hct-trend', level: 'warn', title: `Haematokrit steigt (+${delta.toFixed(1)} Prozentpunkte)`,
          text: 'Ein rasch steigender Haematokrit erhoeht das Risiko fuer Thrombosen. Ausreichend trinken, Schlafapnoe abklaeren, Nikotin meiden.',
          action: 'Verlauf aerztlich besprechen, bevor der Wert die 54-%-Marke erreicht.' });
      }
    }
    // AI ohne Estradiol-Kontrolle
    const aiActive = active.some((c) => c.compound.cls === 'ai');
    if (aiActive && lastPanel.values?.estradiol == null) {
      add({ id: 'ai-blind', level: 'warn', title: 'Aromatasehemmer ohne Estradiol-Kontrolle',
        text: 'Aromatasehemmer ohne gemessenes Estradiol sind ein Blindflug. Zu niedriges Estradiol verursacht Gelenkschmerzen, Libidoverlust, Stimmungstiefs und langfristig Knochenschwund.',
        action: 'Estradiol per sensitivem Assay (LC-MS/MS) bestimmen lassen.' });
    }
  }

  // ---------------------------------------------------------------- Blutdruck
  const bp = [...(state.bodyLog || [])]
    .filter((b) => b.systolic && b.diastolic)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  if (bp) {
    const s = Number(bp.systolic), d = Number(bp.diastolic);
    if (s >= 180 || d >= 120) {
      add({ id: 'bp-crisis', level: 'emergency', title: `Blutdruckkrise: ${s}/${d} mmHg`,
        text: 'Werte ab 180/120 mmHg sind ein medizinischer Notfall, besonders mit Kopfschmerzen, Sehstoerungen, Brustschmerz oder Atemnot.',
        action: 'Sofort aerztliche Hilfe - im Zweifel Notruf 112.' });
    } else if (s >= 140 || d >= 90) {
      add({ id: 'bp-high', level: 'warn', title: `Blutdruck erhoeht: ${s}/${d} mmHg`,
        text: 'Bluthochdruck ist die haeufigste kardiovaskulaere Folge androgener Substanzen und verlaeuft lange ohne Symptome.',
        action: 'Ueber mehrere Tage morgens und abends messen und die Werte dem Arzt zeigen.' });
    } else if (s >= 130 || d >= 80) {
      add({ id: 'bp-watch', level: 'info', title: `Blutdruck im oberen Bereich: ${s}/${d} mmHg`,
        text: 'Noch kein Hochdruck, aber beobachtenswert. Salz, Schlaf und Ausdauertraining haben hier den groessten Hebel.' });
    }
  } else {
    add({ id: 'bp-missing', level: 'info', title: 'Kein Blutdruckwert erfasst',
      text: 'Der Blutdruck ist der Sicherheitsmarker, den du selbst zu Hause messen kannst - mindestens einmal pro Woche.',
      action: 'Oberarm-Messgeraet nutzen und Werte unter "Koerper" eintragen.' });
  }

  // ---------------------------------------------------------------- Substanzspezifisch
  const orals = active.filter((c) => c.compound.route === 'oral' && c.compound.cls === 'aas');
  if (orals.length) {
    const first = Math.min(...events.filter((e) => orals.some((o) => o.compound.id === e.compound.id)).map((e) => e.t));
    const weeks = Math.max(0, -first) / 7;
    add({ id: 'oral-liver', level: weeks > 8 ? 'warn' : 'info',
      title: `Orale Substanz seit ca. ${weeks.toFixed(1)} Wochen`,
      text: '17-alpha-alkylierte Orale belasten die Leber und senken HDL drastisch. Die Belastung steigt mit Dauer und Dosis; Alkohol und andere lebertoxische Mittel verstaerken sie.',
      action: 'Leberwerte (ALT, AST, GGT, Bilirubin) und Lipide kontrollieren lassen.' });
  }

  const nor19 = active.filter((c) => ['Nandrolon', 'Trenbolon'].includes(c.compound.base));
  if (nor19.length) {
    add({ id: 'nor19', level: 'info', title: '19-Nor-Substanz aktiv',
      text: 'Nandrolon und Trenbolon wirken progestagen. Typische Folgen sind Prolaktinanstieg, sexuelle Funktionsstoerungen und Stimmungsschwankungen.',
      action: 'Prolaktin mitbestimmen lassen; Libido und Stimmung im Tagebuch mitfuehren.' });
  }

  if (active.some((c) => c.compound.base === 'Trenbolon')) {
    add({ id: 'tren', level: 'warn', title: 'Trenbolon: keine humanen Studiendaten',
      text: 'Trenbolon wurde nie am Menschen pharmakokinetisch untersucht - alle Kurven hier sind Schaetzungen aus Veterinaerdaten. Bekannt sind starke HDL-Senkung, Blutdruckanstieg, Schlafstoerungen, Nachtschweiss, Herzbelastung und ausgepraegte psychische Nebenwirkungen.',
      action: 'Blutdruck engmaschig messen, Lipide und Nierenwerte kontrollieren, bei psychischen Veraenderungen aerztliche Hilfe suchen.' });
  }

  if (supraphysiological) {
    const list = Object.entries(load).map(([b, mg]) => `${b} ${Math.round(mg)} mg/Woche`).join(', ');
    add({ id: 'supra', level: 'warn', title: 'Dosis oberhalb des Substitutionsbereichs',
      text: `Aktuelle Wochenlast (Basis-Hormon): ${list}. Eine Substitutionstherapie liegt typischerweise bei etwa 70-140 mg Testosteron-Basis pro Woche. Darueber steigen Risiken fuer Herz, Blutdruck, Blutbild und Psyche ueberproportional.`,
      action: 'Kontrollen engmaschiger planen und das Vorgehen offen mit einem Arzt besprechen.' });
  }

  // ---------------------------------------------------------------- Arztkontakt
  const lastVisit = [...(state.doctorVisits || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  const visitGap = since(lastVisit?.at, now);
  if (visitGap > 365) {
    add({ id: 'doctor', level: 'warn', title: 'Seit ueber einem Jahr kein Arztkontakt dokumentiert',
      text: 'Eine dauerhafte Hormontherapie gehoert regelmaessig aerztlich begleitet - auch wenn alles gut laeuft.',
      action: 'Termin vereinbaren und unter "Arzt & Termine" eintragen.' });
  }

  // ---------------------------------------------------------------- Injektionshygiene
  const recent = (state.injections || [])
    .filter((i) => since(i.at, now) < 21 && i.site)
    .slice(0, 6);
  const sites = new Set(recent.map((i) => i.site));
  if (recent.length >= 4 && sites.size === 1) {
    add({ id: 'site-rotation', level: 'info', title: 'Injektionsstelle wird nicht gewechselt',
      text: `Die letzten ${recent.length} Injektionen gingen alle in dieselbe Stelle (${[...sites][0]}). Das beguenstigt Vernarbung, Verhaertungen und Abszesse.`,
      action: 'Stellen systematisch rotieren.' });
  }

  out.sort((a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level]);
  return out;
}

/** Statische Warnzeichen, die sofort aerztliche Hilfe erfordern. */
export const RED_FLAGS = [
  { sign: 'Brustschmerz, Druck oder Engegefuehl, Schmerz in Arm/Kiefer', why: 'Verdacht auf Herzinfarkt', act: 'Notruf 112' },
  { sign: 'Ploetzliche Atemnot, Bluthusten, stechender Schmerz beim Einatmen', why: 'Verdacht auf Lungenembolie', act: 'Notruf 112' },
  { sign: 'Einseitig geschwollene, warme, schmerzende Wade', why: 'Verdacht auf tiefe Venenthrombose', act: 'Sofort in die Notaufnahme' },
  { sign: 'Halbseitige Schwaeche, Sprach- oder Sehstoerung, haengender Mundwinkel', why: 'Verdacht auf Schlaganfall', act: 'Notruf 112' },
  { sign: 'Staerkste Kopfschmerzen mit Sehstoerungen, Blutdruck ueber 180/120', why: 'Hypertensive Krise', act: 'Notruf 112' },
  { sign: 'Gelbfaerbung von Haut oder Augen, entfaerbter Stuhl, dunkler Urin', why: 'Leberschaedigung', act: 'Umgehend aerztlich vorstellen' },
  { sign: 'Rote, ueberwaermte, stark schmerzende Injektionsstelle mit Fieber', why: 'Abszess oder Blutvergiftung', act: 'Umgehend aerztlich vorstellen' },
  { sign: 'Suizidgedanken, schwere Depression, unkontrollierbare Aggression', why: 'Psychische Krise', act: 'Telefonseelsorge 0800 111 0 111 oder Notruf 112' },
];

/** Grundregeln zur Injektionssicherheit (unabhaengig von der Substanz). */
export const INJECTION_SAFETY = [
  'Fuer jede Injektion eine neue, sterile Nadel verwenden - Aufziehkanuele und Injektionskanuele getrennt.',
  'Niemals Nadeln, Spritzen oder Ampullen mit anderen teilen (Hepatitis B/C, HIV).',
  'Haende waschen, Gummistopfen und Einstichstelle mit Alkoholtupfer desinfizieren und trocknen lassen.',
  'Injektionsstellen systematisch rotieren und Narbengewebe meiden.',
  'Nur oelige Loesungen intramuskulaer oder subkutan - niemals intravenoes.',
  'Gebrauchte Kanuelen in einen durchstichsicheren Behaelter, nicht in den Hausmuell.',
  'Bei Rotung, Schwellung, Ueberwaermung oder Fieber nach einer Injektion aerztlich vorstellen.',
];
