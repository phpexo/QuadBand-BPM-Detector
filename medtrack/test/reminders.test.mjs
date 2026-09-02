import test from 'node:test';
import assert from 'node:assert/strict';
import { dueItems, overdueItems, buildIcs } from '../js/reminders.js';

const NOW = Date.parse('2026-06-01T12:00:00Z');
const D = 86400000;
const daysAgo = (d) => new Date(NOW - d * D).toISOString();

const baseState = (extra = {}) => ({
  settings: { labIntervalDays: 180, reminders: { injection: true, lab: true, doctor: true, bloodpressure: false } },
  protocols: [], injections: [], panels: [], bodyLog: [], doctorVisits: [], customCompounds: [],
  ...extra,
});

test('Injektionstermine folgen aus Protokoll und letzter Gabe', () => {
  const state = baseState({
    protocols: [{ id: 'p', compoundId: 'test-enanthate', doseMg: 62.5, intervalDays: 3.5, active: true, startAt: daysAgo(30) }],
    injections: [{ id: 'i', at: daysAgo(1), compoundId: 'test-enanthate', doseMg: 62.5 }],
  });
  const items = dueItems(state, NOW, 14).filter((i) => i.kind === 'injection' && !i.overdue);
  assert.ok(items.length >= 3, `erwartet mehrere Termine, bekommen ${items.length}`);
  const first = Date.parse(items[0].at);
  // Letzte Gabe vor 1 Tag, Intervall 3,5 Tage -> naechste in 2,5 Tagen
  assert.ok(Math.abs((first - NOW) / D - 2.5) < 0.01, `${(first - NOW) / D}`);
  assert.match(items[0].title, /Injektion faellig/);
  // Abstand zwischen den Terminen entspricht dem Intervall
  assert.ok(Math.abs((Date.parse(items[1].at) - first) / D - 3.5) < 0.01);
});

test('Pausiertes Protokoll erzeugt keine Termine', () => {
  const state = baseState({
    protocols: [{ id: 'p', compoundId: 'test-enanthate', doseMg: 62.5, intervalDays: 3.5, active: false, startAt: daysAgo(30) }],
  });
  assert.equal(dueItems(state, NOW, 14).filter((i) => i.kind === 'injection').length, 0);
});

test('Blutkontrolle wird nach dem eingestellten Intervall faellig', () => {
  const fresh = baseState({ panels: [{ id: 'l', at: daysAgo(10), values: { hematocrit: 45 } }] });
  assert.equal(dueItems(fresh, NOW, 14).filter((i) => i.kind === 'lab').length, 0, 'frischer Befund - nichts faellig');

  const old = baseState({ panels: [{ id: 'l', at: daysAgo(200), values: { hematocrit: 45 } }] });
  const lab = dueItems(old, NOW, 14).find((i) => i.kind === 'lab');
  assert.ok(lab && lab.overdue, 'Kontrolle muesste ueberfaellig sein');

  const never = baseState();
  assert.ok(dueItems(never, NOW, 14).find((i) => i.kind === 'lab'), 'ohne Befund wird ein Ausgangslabor angemahnt');
});

test('Abgeschaltete Erinnerungen tauchen nicht auf', () => {
  const state = baseState({
    settings: { labIntervalDays: 180, reminders: { injection: false, lab: false, doctor: false, bloodpressure: false } },
    panels: [], protocols: [{ id: 'p', compoundId: 'test-enanthate', doseMg: 62.5, intervalDays: 3.5, active: true, startAt: daysAgo(30) }],
  });
  assert.equal(dueItems(state, NOW, 14).length, 0);
});

test('Arzttermine und Blutdruck-Erinnerung', () => {
  const state = baseState({
    doctorVisits: [{ id: 'd', at: daysAgo(60), type: 'TRT-Kontrolle', nextAt: new Date(NOW + 3 * D).toISOString() }],
    bodyLog: [{ id: 'b', at: daysAgo(9), systolic: 130, diastolic: 82 }],
    settings: { labIntervalDays: 180, bpIntervalDays: 7, reminders: { injection: true, lab: true, doctor: true, bloodpressure: true } },
    panels: [{ id: 'l', at: daysAgo(5), values: { hematocrit: 45 } }],
  });
  const items = dueItems(state, NOW, 14);
  assert.ok(items.find((i) => i.kind === 'doctor'));
  const bp = items.find((i) => i.kind === 'bloodpressure');
  assert.ok(bp && bp.overdue, 'letzte Messung vor 9 Tagen bei Intervall 7 -> ueberfaellig');
});

test('overdueItems liefert nur bereits faellige Punkte', () => {
  const state = baseState({
    doctorVisits: [{ id: 'd', at: daysAgo(60), type: 'Kontrolle', nextAt: new Date(NOW + 3 * D).toISOString() }],
    panels: [{ id: 'l', at: daysAgo(400), values: { hematocrit: 45 } }],
  });
  const over = overdueItems(state, NOW);
  assert.ok(over.every((i) => Date.parse(i.at) <= NOW));
  assert.ok(over.find((i) => i.kind === 'lab'));
  assert.ok(!over.find((i) => i.kind === 'doctor'), 'zukuenftiger Termin ist nicht ueberfaellig');
});

test('Termine sind chronologisch sortiert', () => {
  const state = baseState({
    protocols: [{ id: 'p', compoundId: 'test-enanthate', doseMg: 62.5, intervalDays: 3.5, active: true, startAt: daysAgo(30) }],
    injections: [{ id: 'i', at: daysAgo(1), compoundId: 'test-enanthate', doseMg: 62.5 }],
    panels: [{ id: 'l', at: daysAgo(179), values: { hematocrit: 45 } }],
  });
  const items = dueItems(state, NOW, 30);
  const times = items.map((i) => Date.parse(i.at));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});

test('Kalenderexport erzeugt gueltiges iCalendar mit Voralarm', () => {
  const state = baseState({
    protocols: [{ id: 'p', compoundId: 'test-enanthate', doseMg: 62.5, intervalDays: 3.5, active: true, startAt: daysAgo(30) }],
    injections: [{ id: 'i', at: daysAgo(1), compoundId: 'test-enanthate', doseMg: 62.5 }],
  });
  const ics = buildIcs(state, { now: NOW, horizonDays: 30, alarmMinutes: 45 });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'));
  assert.ok(ics.includes('\r\n'), 'iCalendar verlangt CRLF');
  assert.ok(ics.includes('TRIGGER:-PT45M'));
  assert.match(ics, /DTSTART:\d{8}T\d{6}Z/);
  const events = ics.split('BEGIN:VEVENT').length - 1;
  assert.ok(events >= 8, `erwartet mehrere Termine, bekommen ${events}`);
  assert.equal(events, ics.split('END:VEVENT').length - 1);
  // Keine Zeile laenger als erlaubt
  for (const line of ics.split('\r\n')) assert.ok(line.length <= 75, `zu lange Zeile: ${line.slice(0, 30)}…`);
});

test('Kalenderexport enthaelt keine vergangenen Termine', () => {
  const state = baseState({ panels: [{ id: 'l', at: daysAgo(400), values: { hematocrit: 45 } }] });
  const ics = buildIcs(state, { now: NOW, horizonDays: 30 });
  assert.equal(ics.split('BEGIN:VEVENT').length - 1, 0);
});
