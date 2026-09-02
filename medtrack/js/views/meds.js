import { el, card, fmt, field, table, toLocalInput, fromLocalInput, confirmDelete } from '../ui/dom.js';
import { addItem, removeItem, update, uid } from '../store.js';
import { compoundOptions, resolver, baseAmount } from '../model.js';
import { CLASSES, ROUTES } from '../pk/compounds.js';
import { INJECTION_SAFETY } from '../safety/advice.js';

export const SITES = [
  'Glutus links', 'Glutus rechts', 'Ventroglutaeal links', 'Ventroglutaeal rechts',
  'Oberschenkel links', 'Oberschenkel rechts', 'Delta links', 'Delta rechts',
  'Bauch s.c. links', 'Bauch s.c. rechts', 'oral', 'transdermal',
];

function compoundSelect(state, value, onchange) {
  const sel = el('select', { onchange: (e) => onchange(e.target.value), required: true });
  sel.appendChild(el('option', { value: '' }, '- Substanz waehlen -'));
  for (const [cls, list] of compoundOptions(state)) {
    const g = el('optgroup', { label: CLASSES[cls] || cls });
    for (const c of list) {
      const o = el('option', { value: c.id }, `${c.name}${c.short ? ` (${c.short})` : ''}`);
      if (c.id === value) o.selected = true;
      g.appendChild(o);
    }
    sel.appendChild(g);
  }
  return sel;
}

export function render(ctx) {
  const { state, rerender } = ctx;
  const resolve = resolver(state);
  const root = el('div', { class: 'view' });

  // ---------------------------------------------------------------- Neue Gabe
  const draft = { at: toLocalInput(), compoundId: '', doseMg: '', site: '', note: '' };
  const preview = el('p', { class: 'muted small' }, 'Basis-Hormon: -');
  const updatePreview = () => {
    const c = resolve(draft.compoundId);
    preview.textContent = c && draft.doseMg
      ? `Entspricht ${fmt.num(baseAmount(c, Number(draft.doseMg)), 1)} mg ${c.base} · ${ROUTES[c.route] || c.route} · Ester-HWZ ${c.tHalfAbs} d`
      : 'Basis-Hormon: -';
  };

  const form = el('form', { class: 'form-grid', onsubmit: (e) => {
    e.preventDefault();
    if (!draft.compoundId || !draft.doseMg) return;
    addItem('injections', {
      at: fromLocalInput(draft.at), compoundId: draft.compoundId,
      doseMg: Number(draft.doseMg), site: draft.site, note: draft.note,
    });
    rerender();
  } },
    field('Zeitpunkt', el('input', { type: 'datetime-local', value: draft.at, required: true,
      onchange: (e) => { draft.at = e.target.value; } })),
    field('Substanz', compoundSelect(state, '', (v) => { draft.compoundId = v; updatePreview(); })),
    field('Dosis (mg bzw. IE)', el('input', { type: 'number', step: 'any', min: 0, required: true, placeholder: 'z. B. 125',
      oninput: (e) => { draft.doseMg = e.target.value; updatePreview(); } })),
    field('Ort / Applikation', (() => {
      const s = el('select', { onchange: (e) => { draft.site = e.target.value; } });
      s.appendChild(el('option', { value: '' }, '- optional -'));
      for (const site of SITES) s.appendChild(el('option', { value: site }, site));
      return s;
    })()),
    field('Notiz', el('input', { type: 'text', placeholder: 'optional',
      oninput: (e) => { draft.note = e.target.value; } })),
    el('div', { class: 'form-actions' }, el('button', { class: 'btn primary', type: 'submit' }, 'Gabe eintragen')));

  root.appendChild(card('Gabe dokumentieren', form, preview));

  // ---------------------------------------------------------------- Protokolle
  root.appendChild(protocolsCard(ctx, resolve));

  // ---------------------------------------------------------------- Verlauf
  const rows = (state.injections || []).slice(0, 200).map((i) => {
    const c = resolve(i.compoundId);
    return [
      fmt.dateTime(i.at),
      c ? (c.short || c.name) : i.compoundId,
      `${fmt.num(i.doseMg, 0)} ${c?.unit || 'mg'}`,
      c ? `${fmt.num(baseAmount(c, Number(i.doseMg)), 1)} mg ${c.base}` : '-',
      i.site || '-',
      i.note || '',
      el('button', { class: 'btn small danger', onclick: () => {
        if (confirmDelete()) { removeItem('injections', i.id); rerender(); }
      } }, 'loeschen'),
    ];
  });
  root.appendChild(card(`Verlauf (${(state.injections || []).length} Eintraege)`,
    table(['Zeitpunkt', 'Substanz', 'Dosis', 'Basis-Hormon', 'Ort', 'Notiz', ''], rows)));

  // ---------------------------------------------------------------- Hygiene
  root.appendChild(card('Injektionssicherheit',
    el('ul', { class: 'checklist' }, INJECTION_SAFETY.map((t) => el('li', {}, t)))));

  return root;
}

function protocolsCard(ctx, resolve) {
  const { state, rerender } = ctx;
  const draft = { compoundId: '', doseMg: '', intervalDays: 3.5, startAt: toLocalInput(), name: '' };

  const form = el('form', { class: 'form-grid', onsubmit: (e) => {
    e.preventDefault();
    if (!draft.compoundId || !draft.doseMg) return;
    update((s) => s.protocols.push({
      id: uid(), name: draft.name, compoundId: draft.compoundId,
      doseMg: Number(draft.doseMg), intervalDays: Number(draft.intervalDays),
      startAt: fromLocalInput(draft.startAt), active: true,
    }));
    rerender();
  } },
    field('Bezeichnung', el('input', { type: 'text', placeholder: 'z. B. TRT laut Arzt',
      oninput: (e) => { draft.name = e.target.value; } })),
    field('Substanz', compoundSelect(state, '', (v) => { draft.compoundId = v; })),
    field('Dosis pro Gabe', el('input', { type: 'number', step: 'any', min: 0, required: true,
      oninput: (e) => { draft.doseMg = e.target.value; } })),
    field('Intervall (Tage)', el('input', { type: 'number', step: '0.5', min: 0.5, value: 3.5, required: true,
      oninput: (e) => { draft.intervalDays = e.target.value; } }), 'z. B. 3,5 = zweimal pro Woche'),
    field('Beginn', el('input', { type: 'datetime-local', value: draft.startAt,
      onchange: (e) => { draft.startAt = e.target.value; } })),
    el('div', { class: 'form-actions' }, el('button', { class: 'btn', type: 'submit' }, 'Protokoll anlegen')));

  const rows = (state.protocols || []).map((p) => {
    const c = resolve(p.compoundId);
    return [
      p.name || '-',
      c ? (c.short || c.name) : p.compoundId,
      `${p.doseMg} mg / ${p.intervalDays} d`,
      c ? `${fmt.num(baseAmount(c, Number(p.doseMg)) * (7 / p.intervalDays), 1)} mg ${c.base}/Woche` : '-',
      fmt.date(p.startAt),
      el('label', { class: 'switch' },
        el('input', { type: 'checkbox', checked: p.active, onchange: (e) => {
          update((s) => { const x = s.protocols.find((y) => y.id === p.id); if (x) x.active = e.target.checked; });
          rerender();
        } }), el('span', {}, p.active ? 'aktiv' : 'pausiert')),
      el('button', { class: 'btn small danger', onclick: () => {
        if (confirmDelete('Protokoll loeschen?')) {
          update((s) => { s.protocols = s.protocols.filter((x) => x.id !== p.id); });
          rerender();
        }
      } }, 'loeschen'),
    ];
  });

  return card('Protokolle (Grundlage fuer Erinnerungen und Projektion)',
    el('p', { class: 'muted small' },
      'Ein Protokoll bildet ab, was du tatsaechlich nimmst bzw. was dir verordnet wurde. Die App leitet daraus den naechsten faelligen Termin und die gestrichelte Vorschaukurve ab - sie schlaegt selbst keine Dosierungen vor.'),
    form,
    table(['Bezeichnung', 'Substanz', 'Schema', 'Wochenlast', 'Beginn', 'Status', ''], rows));
}
