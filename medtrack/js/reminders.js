/**
 * Erinnerungen.
 *
 * Eine reine Web-App ohne Server kann keine Benachrichtigungen schicken,
 * waehrend sie geschlossen ist. Deshalb zwei Wege:
 *
 *  1. Benachrichtigungen, solange die App geoeffnet ist oder beim Oeffnen
 *     (faellige Punkte werden nachgemeldet).
 *  2. Kalender-Export (.ics) mit Voralarm - der funktioniert unabhaengig
 *     davon, ob die App laeuft, und ist der zuverlaessigere Weg.
 */

import { MS_PER_DAY } from './pk/engine.js';
import { projectedDoses, resolver } from './model.js';

export const REMINDER_KINDS = {
  injection: { label: 'Injektion faellig', lead: 0 },
  lab: { label: 'Blutkontrolle faellig', lead: 0 },
  doctor: { label: 'Arzttermin', lead: 0 },
  bloodpressure: { label: 'Blutdruck messen', lead: 0 },
};

/**
 * Alles, was ansteht - vergangenes (ueberfaellig) und kommendes.
 * Rein berechnend, damit testbar.
 */
export function dueItems(state, now = Date.now(), horizonDays = 14) {
  const settings = state.settings || {};
  const enabled = settings.reminders || {};
  const out = [];
  const resolve = resolver(state);

  // ---------------------------------------------------------------- Injektionen
  if (enabled.injection !== false) {
    for (const dose of projectedDoses(state, horizonDays, now)) {
      const c = resolve(dose.compoundId);
      out.push({
        key: `injection:${dose.compoundId}:${dose.at}`,
        kind: 'injection',
        at: dose.at,
        title: `Injektion faellig: ${c?.short || c?.name || dose.compoundId}`,
        body: `${dose.doseMg} ${c?.unit || 'mg'}${c ? ` · ${c.name}` : ''}`,
      });
    }
    // Ueberfaellig: geplanter Zeitpunkt liegt in der Vergangenheit
    const overdue = projectedDoses(state, 0, now - horizonDays * MS_PER_DAY)
      .filter((d) => Date.parse(d.at) < now);
    for (const dose of overdue.slice(-1)) {
      const c = resolve(dose.compoundId);
      out.push({
        key: `injection-overdue:${dose.compoundId}:${dose.at}`,
        kind: 'injection', at: dose.at, overdue: true,
        title: `Injektion ueberfaellig: ${c?.short || c?.name}`,
        body: `Geplant war ${new Date(dose.at).toLocaleString('de-DE')}.`,
      });
    }
  }

  // ---------------------------------------------------------------- Blutkontrolle
  if (enabled.lab !== false) {
    const last = [...(state.panels || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    const interval = (settings.labIntervalDays || 180) * MS_PER_DAY;
    const at = last ? Date.parse(last.at) + interval : now;
    if (at <= now + horizonDays * MS_PER_DAY) {
      out.push({
        key: `lab:${new Date(at).toISOString().slice(0, 10)}`,
        kind: 'lab', at: new Date(at).toISOString(), overdue: at < now,
        title: last ? 'Blutkontrolle faellig' : 'Ausgangslabor noch nicht erfasst',
        body: last
          ? `Letzter Befund vom ${new Date(last.at).toLocaleDateString('de-DE')}. Talwert kurz vor der naechsten Injektion abnehmen lassen.`
          : 'Ohne Ausgangswerte laesst sich der Verlauf spaeter nicht beurteilen.',
      });
    }
  }

  // ---------------------------------------------------------------- Arzttermin
  if (enabled.doctor !== false) {
    for (const v of state.doctorVisits || []) {
      if (!v.nextAt) continue;
      const t = Date.parse(v.nextAt);
      if (t > now + horizonDays * MS_PER_DAY) continue;
      out.push({
        key: `doctor:${v.id}`, kind: 'doctor', at: v.nextAt, overdue: t < now,
        title: `Arzttermin: ${v.type || 'Kontrolle'}`,
        body: v.note || 'Befunde und aktuelle Medikation mitnehmen.',
      });
    }
  }

  // ---------------------------------------------------------------- Blutdruck
  if (enabled.bloodpressure) {
    const last = [...(state.bodyLog || [])]
      .filter((b) => b.systolic).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    const every = (settings.bpIntervalDays || 7) * MS_PER_DAY;
    const at = last ? Date.parse(last.at) + every : now;
    if (at <= now + horizonDays * MS_PER_DAY) {
      out.push({
        key: `bp:${new Date(at).toISOString().slice(0, 10)}`,
        kind: 'bloodpressure', at: new Date(at).toISOString(), overdue: at < now,
        title: 'Blutdruck messen',
        body: 'Der Blutdruck ist der Sicherheitsmarker, den du selbst zu Hause kontrollieren kannst.',
      });
    }
  }

  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export function overdueItems(state, now = Date.now()) {
  return dueItems(state, now).filter((i) => Date.parse(i.at) <= now);
}

// ---------------------------------------------------------------------------
// Benachrichtigungen im Browser
// ---------------------------------------------------------------------------

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

async function show(title, options) {
  if (notificationPermission() !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) await reg.showNotification(title, options);
    else new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Meldet faellige Punkte - jeden nur einmal. Was bereits gemeldet wurde,
 * steht in settings.notified.
 */
export async function notifyDue(state, saveNotified, now = Date.now()) {
  const already = state.settings?.notified || {};
  const fresh = overdueItems(state, now).filter((i) => !already[i.key]);
  const sent = [];
  for (const item of fresh) {
    const ok = await show(item.title, {
      body: item.body,
      tag: item.key,
      icon: './icons/icon.svg',
      badge: './icons/icon.svg',
      requireInteraction: item.kind === 'injection',
    });
    if (ok) sent.push(item.key);
  }
  if (sent.length && saveNotified) {
    const stamp = new Date(now).toISOString();
    saveNotified(Object.fromEntries(sent.map((k) => [k, stamp])));
  }
  return sent;
}

/** Timer fuer Punkte, die faellig werden, waehrend die App offen ist. */
export function scheduleWhileOpen(state, onDue, now = Date.now(), windowHours = 12) {
  const timers = [];
  const limit = now + windowHours * 3600000;
  for (const item of dueItems(state, now, 1)) {
    const t = Date.parse(item.at);
    if (t <= now || t > limit) continue;
    timers.push(setTimeout(() => onDue(item), t - now));
  }
  return () => timers.forEach(clearTimeout);
}

// ---------------------------------------------------------------------------
// Kalender-Export
// ---------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');

function icsDate(d) {
  const x = new Date(d);
  return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}${pad(x.getUTCSeconds())}Z`;
}

const icsEscape = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Zeilen auf 75 Oktette falten, wie es der Standard verlangt. */
function fold(line) {
  if (line.length <= 73) return line;
  const parts = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) { parts.push(` ${rest.slice(0, 72)}`); rest = rest.slice(72); }
  if (rest) parts.push(` ${rest}`);
  return parts.join('\r\n');
}

/**
 * Erzeugt eine .ics-Datei mit allen anstehenden Terminen inklusive Voralarm.
 * Import in Google Kalender, Apple Kalender oder Outlook - dann erinnert das
 * Telefon auch bei geschlossener App.
 */
export function buildIcs(state, { now = Date.now(), horizonDays = 120, alarmMinutes = 30 } = {}) {
  const items = dueItems(state, now, horizonDays).filter((i) => Date.parse(i.at) >= now);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MedTrack//DE', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', 'X-WR-CALNAME:MedTrack',
  ];
  for (const item of items) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${item.key.replace(/[^a-zA-Z0-9:_-]/g, '-')}@medtrack`);
    lines.push(`DTSTAMP:${icsDate(now)}`);
    lines.push(`DTSTART:${icsDate(item.at)}`);
    lines.push('DURATION:PT15M');
    lines.push(fold(`SUMMARY:${icsEscape(item.title)}`));
    lines.push(fold(`DESCRIPTION:${icsEscape(item.body || '')}`));
    lines.push('BEGIN:VALARM');
    lines.push(`TRIGGER:-PT${alarmMinutes}M`);
    lines.push('ACTION:DISPLAY');
    lines.push(fold(`DESCRIPTION:${icsEscape(item.title)}`));
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
