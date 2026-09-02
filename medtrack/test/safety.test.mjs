import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDoseEvents, MS_PER_DAY } from '../js/pk/engine.js';
import { COMPOUND_BY_ID } from '../js/pk/compounds.js';
import { activeCompounds, weeklyLoad, buildAdvice } from '../js/safety/advice.js';
import { evaluateMarker, evaluatePanel, markerTrend } from '../js/safety/labs.js';

const NOW = Date.parse('2026-06-01T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * MS_PER_DAY).toISOString();
const resolve = (id) => COMPOUND_BY_ID[id];

function events(entries) {
  return buildDoseEvents(entries, resolve, NOW);
}

test('activeCompounds erkennt laufende Therapie', () => {
  const ev = events([0, 3.5, 7, 10.5, 14].map((d) => ({ at: daysAgo(d), compoundId: 'test-enanthate', doseMg: 62.5 })));
  const active = activeCompounds(ev, 0);
  assert.equal(active.length, 1);
  assert.equal(active[0].compound.id, 'test-enanthate');
  assert.ok(active[0].amount > 0);
  assert.ok(active[0].depot > 0, 'Depot enthaelt noch nicht freigesetzten Ester');
});

test('activeCompounds meldet nichts mehr, wenn die Substanz laengst abgebaut ist', () => {
  // Trenbolon Acetat, HWZ 1 Tag, letzte Gabe vor 60 Tagen
  const ev = events([{ at: daysAgo(60), compoundId: 'tren-acetate', doseMg: 100 }]);
  assert.equal(activeCompounds(ev, 0).length, 0);
});

test('weeklyLoad rechnet auf Basis-Hormon pro Woche um', () => {
  const ev = events([0, 7, 14, 21].map((d) => ({ at: daysAgo(d), compoundId: 'test-enanthate', doseMg: 100 })));
  const load = weeklyLoad(ev, 0, 28);
  // 4 x 72 mg Basis in 28 Tagen = 72 mg/Woche
  assert.ok(Math.abs(load.Testosteron - 72) < 0.01, `${load.Testosteron}`);
});

test('Ohne Laborbefund fordert die App dringend einen Ausgangswert', () => {
  const state = { injections: [], panels: [], bodyLog: [], protocols: [], settings: {} };
  const a = buildAdvice(state, [], NOW);
  const baseline = a.find((x) => x.id === 'lab-baseline');
  assert.ok(baseline && baseline.level === 'urgent');
});

test('Blutdruckkrise wird als Notfall eingestuft', () => {
  const state = {
    injections: [], panels: [], protocols: [], settings: {},
    bodyLog: [{ at: daysAgo(1), systolic: 190, diastolic: 125 }],
  };
  const a = buildAdvice(state, [], NOW);
  assert.equal(a[0].level, 'emergency', 'Notfall steht ganz oben');
  assert.match(a[0].title, /Blutdruckkrise/);
});

test('Kritischer Haematokrit erzeugt eine dringende Empfehlung', () => {
  const state = {
    injections: [], protocols: [], bodyLog: [], settings: {},
    panels: [{ at: daysAgo(10), values: { hematocrit: 56 } }],
  };
  const a = buildAdvice(state, [], NOW);
  const hct = a.find((x) => x.id === 'lab-hematocrit');
  assert.ok(hct && hct.level === 'urgent');
  assert.match(hct.action, /aerztlich/i);
});

test('Dosis oberhalb des Substitutionsbereichs wird erkannt und begruendet', () => {
  const entries = [0, 3.5, 7, 10.5, 14, 17.5].map((d) => ({ at: daysAgo(d), compoundId: 'test-enanthate', doseMg: 250 }));
  const ev = events(entries);
  const state = { injections: entries, panels: [], bodyLog: [], protocols: [], settings: {} };
  const a = buildAdvice(state, ev, NOW);
  assert.ok(a.find((x) => x.id === 'supra'), 'Hinweis auf supraphysiologische Dosis fehlt');
  // Kontrollintervall wird dabei automatisch auf 90 Tage verkuerzt
  const stateWithOldPanel = { ...state, panels: [{ at: daysAgo(120), values: { hematocrit: 45 } }] };
  const b = buildAdvice(stateWithOldPanel, ev, NOW);
  assert.ok(b.find((x) => x.id === 'lab-due'), 'Kontrolle muesste als ueberfaellig gelten');
});

test('Substitutionsdosis loest keinen Supraphysiologie-Hinweis aus', () => {
  const entries = [0, 3.5, 7, 10.5].map((d) => ({ at: daysAgo(d), compoundId: 'test-enanthate', doseMg: 62.5 }));
  const state = { injections: entries, panels: [], bodyLog: [], protocols: [], settings: {} };
  const a = buildAdvice(state, events(entries), NOW);
  assert.equal(a.find((x) => x.id === 'supra'), undefined);
});

test('Trenbolon-Hinweis nennt die fehlende Studienlage', () => {
  const entries = [{ at: daysAgo(1), compoundId: 'tren-acetate', doseMg: 50 }];
  const state = { injections: entries, panels: [], bodyLog: [], protocols: [], settings: {} };
  const a = buildAdvice(state, events(entries), NOW);
  const tren = a.find((x) => x.id === 'tren');
  assert.ok(tren, 'Trenbolon-Hinweis fehlt');
  assert.match(tren.text, /keine humanen|nie am Menschen|Veterinaerdaten/i);
  assert.ok(a.find((x) => x.id === 'nor19'), '19-Nor-Hinweis fehlt');
});

test('Aromatasehemmer ohne Estradiol-Messung wird beanstandet', () => {
  const entries = [0, 1, 2].map((d) => ({ at: daysAgo(d), compoundId: 'anastrozole', doseMg: 0.5 }));
  const state = {
    injections: entries, protocols: [], bodyLog: [], settings: {},
    panels: [{ at: daysAgo(5), values: { total_t: 700 } }],
  };
  const a = buildAdvice(state, events(entries), NOW);
  assert.ok(a.find((x) => x.id === 'ai-blind'));
});

test('Fehlende Rotation der Injektionsstellen faellt auf', () => {
  const entries = [0, 3, 6, 9].map((d) => ({ at: daysAgo(d), compoundId: 'test-enanthate', doseMg: 62.5, site: 'Glutus links' }));
  const state = { injections: entries, panels: [], bodyLog: [], protocols: [], settings: {} };
  const a = buildAdvice(state, events(entries), NOW);
  assert.ok(a.find((x) => x.id === 'site-rotation'));
});

test('Laborbewertung: Grenzen und Trend', () => {
  assert.equal(evaluateMarker('hematocrit', 48).level, 'ok');
  assert.equal(evaluateMarker('hematocrit', 51).level, 'watch');
  assert.equal(evaluateMarker('hematocrit', 53).level, 'warn');
  assert.equal(evaluateMarker('hematocrit', 55).level, 'urgent');
  assert.equal(evaluateMarker('hdl', 20).level, 'urgent');
  assert.equal(evaluateMarker('unbekannt', 5), null);

  const panels = [
    { at: daysAgo(90), values: { hematocrit: 46 } },
    { at: daysAgo(10), values: { hematocrit: 52 } },
  ];
  const trend = markerTrend(panels, 'hematocrit');
  assert.deepEqual(trend.map((x) => x.value), [46, 52]);
  assert.equal(evaluatePanel(panels[1])[0].marker.id, 'hematocrit');
});

test('Steigender Haematokrit erzeugt einen Trendhinweis', () => {
  const state = {
    injections: [], protocols: [], bodyLog: [], settings: {},
    panels: [
      { at: daysAgo(90), values: { hematocrit: 46 } },
      { at: daysAgo(5), values: { hematocrit: 50 } },
    ],
  };
  const a = buildAdvice(state, [], NOW);
  assert.ok(a.find((x) => x.id === 'hct-trend'));
});
