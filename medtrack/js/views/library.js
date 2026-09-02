import { el, card, fmt, field, select, table, clear } from '../ui/dom.js';
import { lineChart, PALETTE } from '../ui/chart.js';
import { COMPOUNDS, CLASSES, ROUTES } from '../pk/compounds.js';
import { bateman, ratesFor, tMax, terminalHalfLife, formatDuration, steadyState, concentration } from '../pk/engine.js';
import { allCompounds } from '../model.js';

const CONFIDENCE = {
  high: ['gut belegt', 'Daten aus Zulassungsstudien oder Fachinformationen'],
  medium: ['eingeschraenkt belegt', 'einzelne publizierte Untersuchungen'],
  low: ['nicht belegt', 'nur Erfahrungswerte, keine humane PK-Studie'],
};

export function render(ctx) {
  const { state } = ctx;
  const root = el('div', { class: 'view' });
  const list = allCompounds(state);

  // ---------------------------------------------------------------- Vergleichsrechner
  let selected = list.find((c) => c.id === 'test-enanthate') || list[0];
  let dose = 100;
  const host = el('div', {});

  const draw = () => {
    clear(host);
    const c = selected;
    const { ka, ke } = ratesFor(c);
    const baseMg = dose * (c.esterFactor ?? 1) * (c.bioavailability ?? 1);
    const horizon = Math.max(terminalHalfLife(c) * 6, 2);
    const points = [];
    const depot = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * horizon;
      points.push([t, bateman(baseMg, ka, ke, t)]);
      depot.push([t, baseMg * Math.exp(-ka * t)]);
    }
    const peak = Math.max(...points.map((p) => p[1]));
    host.appendChild(lineChart({
      series: [
        { label: 'zirkulierende Menge (mg)', color: PALETTE[0], points, area: true },
        { label: 'noch im Depot (mg)', color: PALETTE[3], points: depot, dashed: true },
      ],
      height: 260,
      formatX: (v) => formatDuration(v),
      formatY: (v) => fmt.num(v, v < 10 ? 2 : 0),
    }));
    host.appendChild(el('div', { class: 'cmp-rows' },
      rowLine('Basis-Hormon je Gabe', `${fmt.num(baseMg, 1)} mg ${c.base} (Ester-Faktor ${fmt.num((c.esterFactor ?? 1) * 100, 1)} %)`),
      rowLine('Ester-Halbwertszeit', formatDuration(c.tHalfAbs)),
      rowLine('Terminale Halbwertszeit', formatDuration(terminalHalfLife(c))),
      rowLine('Maximum nach', formatDuration(tMax(ka, ke))),
      rowLine('Nach 1 Halbwertszeit noch im Depot', `${fmt.num(baseMg / 2, 1)} mg (50 %)`),
      rowLine('Praktisch eliminiert nach', formatDuration(terminalHalfLife(c) * 5)),
      c.vdLPerKg ? rowLine('Peak-Serumspiegel (80 kg, Einzeldosis)', `${fmt.int(concentration(peak, c, 80))} ng/dl`) : null,
      rowLine('Datenqualitaet', CONFIDENCE[c.confidence]?.[0] + ' - ' + CONFIDENCE[c.confidence]?.[1])));
    if (c.route === 'im' || c.route === 'sc') {
      const weekly = steadyState(c, dose, 7, { weightKg: 80 });
      const twice = steadyState(c, dose / 2, 3.5, { weightKg: 80 });
      host.appendChild(el('p', { class: 'muted small' },
        `Bei gleichbleibender Wochenmenge sinkt die Schwankungsbreite von ${fmt.num(weekly.fluctuationPercent, 0)} % (eine Gabe pro Woche) auf ${fmt.num(twice.fluctuationPercent, 0)} % (zwei Gaben pro Woche). Der Mittelwert aendert sich dadurch nicht.`));
    }
    if (c.note) host.appendChild(el('p', { class: 'cmp-note' }, c.note));
    if (c.confidence === 'low') {
      host.appendChild(el('p', { class: 'warn-inline' },
        'Fuer diese Substanz liegen keine belastbaren humanen Studiendaten vor. Die Kurve zeigt eine plausible Groessenordnung, keinen gemessenen Verlauf.'));
    }
  };

  const picker = select(list.map((c) => ({ value: c.id, label: `${c.name}${c.short ? ` (${c.short})` : ''}` })),
    selected.id, (v) => { selected = list.find((c) => c.id === v); draw(); });
  const doseInput = el('input', { type: 'number', value: dose, min: 1, step: 'any',
    oninput: (e) => { dose = Number(e.target.value) || 1; draw(); } });
  draw();

  root.appendChild(card('Einzeldosis-Rechner',
    el('div', { class: 'controls' }, field('Substanz', picker), field('Dosis (mg)', doseInput)),
    host));

  // ---------------------------------------------------------------- Tabelle
  const rows = COMPOUNDS.map((c) => [
    c.name,
    CLASSES[c.cls] || c.cls,
    ROUTES[c.route] || c.route,
    c.base,
    `${fmt.num((c.esterFactor ?? 1) * 100, 1)} %`,
    formatDuration(c.tHalfAbs),
    formatDuration(terminalHalfLife(c)),
    el('span', { class: `conf conf-${c.confidence}` }, CONFIDENCE[c.confidence]?.[0] || '-'),
    c.medical ? 'ja' : 'nein',
  ]);
  root.appendChild(card('Substanzuebersicht',
    table(['Substanz', 'Klasse', 'Applikation', 'Basis', 'Ester-Faktor', 'Ester-HWZ', 'terminale HWZ', 'Datenlage', 'Als Arzneimittel zugelassen'], rows),
    el('p', { class: 'muted small' },
      'Der Ester-Faktor gibt an, wie viel Prozent der eingesetzten Masse tatsaechlich Hormon sind. 100 mg Testosteron Enantat enthalten 72 mg Testosteron - deshalb sind Praeparate mit unterschiedlichen Estern nicht 1:1 vergleichbar.')));

  root.appendChild(card('Quellenlage',
    el('p', {}, 'Halbwertszeiten und Molmassen stammen aus Fachinformationen zugelassener Praeparate und aus der publizierten Literatur zur Testosterontherapie. Fuer nicht zugelassene Substanzen (u. a. Trenbolon, Boldenon, Trestolon) gibt es keine humanen pharmakokinetischen Studien; die dort hinterlegten Werte sind als "nicht belegt" gekennzeichnet und beruhen auf Veterinaerdaten und Erfahrungsberichten.'),
    el('p', { class: 'muted small' }, 'Referenzbereiche und Kontrollintervalle orientieren sich an gaengigen Laborreferenzen und den Leitlinien zur Testosterontherapie. Sie ersetzen nicht den Befund deines Labors.')));

  return root;
}

function rowLine(label, value) {
  return value == null ? null : el('div', { class: 'cmp-row' }, el('span', {}, label), el('b', {}, value));
}
