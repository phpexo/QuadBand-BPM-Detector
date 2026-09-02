import test from 'node:test';
import assert from 'node:assert/strict';
import {
  navyBodyFat, calipperBodyFat, metrics, movingAverage, weightChangeRate,
  asymmetries, whtrRating, ffmiRating, MEASUREMENTS,
} from '../js/body/metrics.js';

const daysAgo = (d) => new Date(Date.parse('2026-06-01T12:00:00Z') - d * 86400000).toISOString();

test('Navy-Formel liefert plausible Werte und braucht vollstaendige Angaben', () => {
  const bf = navyBodyFat({ waistCm: 88, neckCm: 40, heightCm: 182, sex: 'm' });
  assert.ok(bf > 15 && bf < 18, `${bf}`);
  // schmalere Taille -> weniger Fett
  assert.ok(navyBodyFat({ waistCm: 80, neckCm: 40, heightCm: 182, sex: 'm' }) < bf);
  assert.equal(navyBodyFat({ waistCm: 88, heightCm: 182, sex: 'm' }), null);
  assert.equal(navyBodyFat({ waistCm: 88, neckCm: 40, heightCm: 182, sex: 'f' }), null, 'Huefte fehlt');
  assert.ok(navyBodyFat({ waistCm: 75, neckCm: 32, hipCm: 95, heightCm: 168, sex: 'f' }) > 0);
});

test('Jackson-Pollock: drei und sieben Messstellen', () => {
  const three = calipperBodyFat({ chest: 10, abdomen: 20, thigh: 15 }, { sex: 'm', age: 30 });
  assert.ok(Math.abs(three - 13.6) < 0.3, `${three}`);

  const seven = calipperBodyFat({
    chest: 10, midaxillary: 10, triceps: 10, subscapular: 10, abdomen: 20, suprailiac: 15, thigh: 15,
  }, { sex: 'm', age: 30 });
  assert.ok(seven > 11 && seven < 16, `${seven}`);

  // Aelter bei gleichen Falten -> hoeherer Schaetzwert
  assert.ok(calipperBodyFat({ chest: 10, abdomen: 20, thigh: 15 }, { sex: 'm', age: 50 }) > three);
});

test('Unvollstaendige Messstellen ergeben keinen Wert statt eines falschen', () => {
  assert.equal(calipperBodyFat({ chest: 10, abdomen: 20 }, { sex: 'm', age: 30 }), null);
  assert.equal(calipperBodyFat({}, { sex: 'm', age: 30 }), null);
});

test('metrics: FFMI, fettfreie Masse und Rangfolge der Quellen', () => {
  const m = metrics({ weightKg: 88, bodyFat: 15 }, { heightCm: 182 });
  assert.ok(Math.abs(m.lean - 74.8) < 0.01);
  assert.ok(Math.abs(m.ffmi - 22.58) < 0.05, `${m.ffmi}`);
  assert.ok(Math.abs(m.normFfmi - 22.46) < 0.05, `${m.normFfmi}`);
  assert.equal(m.bodyFatSource, 'eingetragen');

  // Ohne eingetragenen Wert wird geschaetzt - Caliper hat Vorrang vor Umfaengen
  const est = metrics({ weightKg: 88, waistCm: 88, neckCm: 40, folds: { chest: 10, abdomen: 20, thigh: 15 } }, { heightCm: 182, age: 30 });
  assert.equal(est.bodyFatSource, 'Caliper');
  assert.ok(est.navy > 0 && est.caliper > 0);

  const navyOnly = metrics({ weightKg: 88, waistCm: 88, neckCm: 40 }, { heightCm: 182 });
  assert.equal(navyOnly.bodyFatSource, 'Navy');
});

test('Taille-zu-Groesse-Verhaeltnis wird eingeordnet', () => {
  assert.equal(whtrRating(0.45).level, 'ok');
  assert.equal(whtrRating(0.55).level, 'warn');
  assert.equal(whtrRating(0.65).level, 'urgent');
  assert.equal(whtrRating(null), null);
});

test('FFMI-Einordnung kennzeichnet den natuerlich kaum erreichbaren Bereich', () => {
  assert.match(ffmiRating(19), /durchschnittlich/);
  assert.match(ffmiRating(23), /trainiert/);
  assert.match(ffmiRating(27), /ausserhalb/);
});

test('Gleitender Mittelwert glaettet Tagesschwankungen', () => {
  const points = [90, 91, 89, 92, 90].map((v, i) => ({ at: daysAgo(4 - i), value: v }));
  const avg = movingAverage(points, 3);
  assert.equal(avg.length, points.length);
  assert.equal(avg[0].value, 90);
  assert.ok(Math.abs(avg[2].value - 90) < 1e-9);
  // Der geglaettete Verlauf schwankt weniger als der rohe
  const spread = (xs) => Math.max(...xs) - Math.min(...xs);
  assert.ok(spread(avg.map((p) => p.value)) < spread(points.map((p) => p.value)));
});

test('Gewichtsveraenderung pro Woche', () => {
  const points = [
    { at: daysAgo(14), value: 88 },
    { at: daysAgo(7), value: 88.5 },
    { at: daysAgo(0), value: 89 },
  ];
  const rate = weightChangeRate(points);
  assert.ok(Math.abs(rate.perWeek - 0.5) < 1e-9, `${rate.perWeek}`);
  assert.ok(rate.percentPerWeek > 0.5 && rate.percentPerWeek < 0.6);
  assert.equal(weightChangeRate([points[0]]), null);
});

test('Seitenunterschiede werden ab drei Prozent markiert', () => {
  const a = asymmetries({ armLeftCm: 40, armRightCm: 41 });
  assert.equal(a.length, 1);
  assert.ok(Math.abs(a[0].percent - 2.44) < 0.05);
  assert.equal(a[0].notable, false);

  const b = asymmetries({ thighLeftCm: 60, thighRightCm: 63 });
  assert.equal(b[0].notable, true);
  assert.equal(asymmetries({ armLeftCm: 40 }).length, 0, 'einseitige Angabe ergibt keinen Vergleich');
});

test('Umfangsliste fuehrt beide Koerperseiten getrennt', () => {
  const ids = MEASUREMENTS.map((m) => m.id);
  for (const pair of ['armLeftCm', 'armRightCm', 'thighLeftCm', 'thighRightCm', 'calfLeftCm', 'calfRightCm']) {
    assert.ok(ids.includes(pair), `${pair} fehlt`);
  }
});
