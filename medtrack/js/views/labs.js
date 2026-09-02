import { el, card, fmt, field, select, toLocalInput, fromLocalInput, confirmDelete, clear } from '../ui/dom.js';
import { lineChart, PALETTE } from '../ui/chart.js';
import { addItem, removeItem, toCsv, downloadFile } from '../store.js';
import { MARKERS, MARKER_GROUPS, MARKER_BY_ID, evaluatePanel, markerTrend, evaluateMarker } from '../safety/labs.js';
import { MS_PER_DAY } from '../pk/engine.js';

const LEVEL_CLASS = { ok: 'ok', watch: 'watch', warn: 'warn', urgent: 'urgent' };

export function render(ctx) {
  const { state, rerender, now } = ctx;
  const root = el('div', { class: 'view' });
  const panels = [...(state.panels || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  root.appendChild(newPanelCard(rerender));

  // ---------------------------------------------------------------- Trend
  if (panels.length >= 2) {
    root.appendChild(trendCard(state));
  }

  // ---------------------------------------------------------------- Befunde
  for (const p of panels) {
    const results = evaluatePanel(p);
    const grid = el('div', { class: 'lab-grid' });
    for (const r of results) {
      grid.appendChild(el('div', { class: `lab-item ${LEVEL_CLASS[r.level]}` },
        el('div', { class: 'lab-name' }, r.marker.name),
        el('div', { class: 'lab-value' }, `${fmt.num(r.value, 2)} `, el('span', { class: 'unit' }, r.marker.unit)),
        el('div', { class: 'lab-ref' }, r.marker.ref ? `Referenz ${r.marker.ref[0]}-${r.marker.ref[1]}` : ''),
        r.level !== 'ok' ? el('div', { class: 'lab-flag' }, r.text) : null));
    }
    const worst = results[0];
    root.appendChild(card(null,
      el('div', { class: 'panel-head' },
        el('h2', {}, `Befund vom ${fmt.date(p.at)}`),
        el('span', { class: 'muted' }, p.lab || ''),
        worst && worst.level !== 'ok'
          ? el('span', { class: `badge ${LEVEL_CLASS[worst.level]}` }, `${results.filter((r) => r.level !== 'ok').length} auffaellig`)
          : el('span', { class: 'badge ok' }, 'unauffaellig'),
        el('button', { class: 'btn small danger', onclick: () => {
          if (confirmDelete('Befund loeschen?')) { removeItem('panels', p.id); rerender(); }
        } }, 'loeschen')),
      p.note ? el('p', { class: 'muted' }, p.note) : null,
      grid,
      results.some((r) => r.level !== 'ok' && r.marker.hint)
        ? el('div', { class: 'hints' }, results.filter((r) => r.level !== 'ok' && r.marker.hint)
            .map((r) => el('p', {}, el('b', {}, `${r.marker.name}: `), r.marker.hint)))
        : null));
  }

  if (!panels.length) {
    root.appendChild(card('Noch keine Befunde',
      el('p', {}, 'Trage deinen ersten Laborbefund ein. Fuer die Verlaufsbeurteilung sind besonders wichtig: Blutbild mit Haematokrit, Leberwerte, Lipide inklusive ApoB, Nierenwerte, Gesamt-Testosteron, sensitives Estradiol, Prolaktin und PSA.')));
  }

  if (panels.length) {
    root.appendChild(el('div', { class: 'row-actions' },
      el('button', { class: 'btn', onclick: () => exportCsv(panels) }, 'Alle Befunde als CSV exportieren')));
  }

  return root;
}

function newPanelCard(rerender) {
  const draft = { at: toLocalInput(), lab: '', note: '', values: {} };
  const groupsWrap = el('div', { class: 'lab-input-groups' });

  for (const group of MARKER_GROUPS) {
    const inputs = el('div', { class: 'form-grid dense' });
    for (const m of MARKERS.filter((x) => x.group === group)) {
      const feedback = el('span', { class: 'field-hint' },
        m.ref ? `Referenz ${m.ref[0]}-${m.ref[1]} ${m.unit}` : m.unit);
      inputs.appendChild(field(`${m.name} (${m.unit})`,
        el('input', {
          type: 'number', step: 'any', placeholder: '-',
          oninput: (e) => {
            const v = e.target.value;
            if (v === '') delete draft.values[m.id]; else draft.values[m.id] = Number(v);
            const r = v === '' ? null : evaluateMarker(m.id, Number(v));
            clear(feedback);
            feedback.className = `field-hint ${r && r.level !== 'ok' ? LEVEL_CLASS[r.level] : ''}`;
            feedback.textContent = r && r.level !== 'ok'
              ? `${r.text}${m.alt ? ` · ${fmt.num(Number(v) * m.alt.factor, 2)} ${m.alt.unit}` : ''}`
              : (m.ref ? `Referenz ${m.ref[0]}-${m.ref[1]} ${m.unit}` : m.unit);
          },
        }), null));
      inputs.lastChild.appendChild(feedback);
    }
    groupsWrap.appendChild(el('details', { class: 'lab-group' },
      el('summary', {}, group), inputs));
  }

  return card('Neuen Befund eintragen',
    el('form', { onsubmit: (e) => {
      e.preventDefault();
      if (!Object.keys(draft.values).length) { alert('Bitte mindestens einen Wert eintragen.'); return; }
      addItem('panels', { at: fromLocalInput(draft.at), lab: draft.lab, note: draft.note, values: { ...draft.values } });
      rerender();
    } },
      el('div', { class: 'form-grid' },
        field('Abnahmezeitpunkt', el('input', { type: 'datetime-local', value: draft.at, required: true,
          onchange: (e) => { draft.at = e.target.value; } }), 'Uhrzeit ist wichtig - fuer die Kurve und fuer Talwerte'),
        field('Labor / Arzt', el('input', { type: 'text', placeholder: 'optional',
          oninput: (e) => { draft.lab = e.target.value; } })),
        field('Notiz', el('input', { type: 'text', placeholder: 'z. B. Talwert, nuechtern',
          oninput: (e) => { draft.note = e.target.value; } }))),
      groupsWrap,
      el('div', { class: 'form-actions' }, el('button', { class: 'btn primary', type: 'submit' }, 'Befund speichern'))));
}

function trendCard(state) {
  const available = MARKERS.filter((m) => (state.panels || []).some((p) => p.values?.[m.id] != null));
  if (!available.length) return null;
  let current = available.find((m) => m.id === 'hematocrit') || available[0];
  const chartHost = el('div', {});

  const draw = () => {
    clear(chartHost);
    const points = markerTrend(state.panels, current.id);
    if (points.length < 2) {
      chartHost.appendChild(el('p', { class: 'muted' }, 'Mindestens zwei Befunde noetig.'));
      return;
    }
    const t0 = Date.parse(points[0].at);
    const bands = current.ref ? [{ from: current.ref[0], to: current.ref[1], color: 'var(--band)' }] : [];
    const values = points.map((p) => p.value);
    const yMax = Math.max(...values, current.ref?.[1] ?? 0) * 1.15;
    const yMin = Math.min(...values, current.ref?.[0] ?? Infinity) * 0.85;
    chartHost.appendChild(lineChart({
      series: [{ label: current.name, color: PALETTE[0],
        points: points.map((p) => [(Date.parse(p.at) - t0) / MS_PER_DAY, p.value]),
        dots: points.map((p) => [(Date.parse(p.at) - t0) / MS_PER_DAY, p.value]) }],
      bands, height: 240, yMin: Math.max(0, yMin), yMax,
      formatX: (v) => fmt.date(new Date(t0 + v * MS_PER_DAY).toISOString()),
      formatY: (v) => fmt.num(v, 1),
    }));
    chartHost.appendChild(el('p', { class: 'muted small' },
      `${current.name} in ${current.unit}. ${current.hint || ''}`));
  };

  const picker = select(available.map((m) => ({ value: m.id, label: m.name })), current.id, (v) => {
    current = MARKER_BY_ID[v]; draw();
  });
  draw();
  return card('Verlauf einzelner Werte', field('Marker', picker), chartHost);
}

function exportCsv(panels) {
  const ids = [...new Set(panels.flatMap((p) => Object.keys(p.values || {})))];
  const columns = [
    { label: 'Datum', get: (p) => new Date(p.at).toISOString() },
    { label: 'Labor', get: (p) => p.lab || '' },
    ...ids.map((id) => ({ label: `${MARKER_BY_ID[id]?.name || id} [${MARKER_BY_ID[id]?.unit || ''}]`, get: (p) => p.values?.[id] ?? '' })),
    { label: 'Notiz', get: (p) => p.note || '' },
  ];
  downloadFile(`laborwerte-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(panels, columns), 'text/csv');
}
