/** Minimale DOM-Helfer - kein Framework, kein Build-Schritt. */

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

export const svg = (tag, props = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(props)) if (v != null) node.setAttribute(k, v);
  return node;
};

export const fmt = {
  num: (v, digits = 1) => (v == null || Number.isNaN(v) ? '-' : Number(v).toLocaleString('de-DE',
    { minimumFractionDigits: digits, maximumFractionDigits: digits })),
  int: (v) => (v == null || Number.isNaN(v) ? '-' : Math.round(v).toLocaleString('de-DE')),
  date: (iso) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'),
  dateTime: (iso) => (iso ? new Date(iso).toLocaleString('de-DE',
    { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'),
  relDays: (d) => {
    if (!Number.isFinite(d)) return '-';
    const abs = Math.abs(d);
    if (abs < 1 / 24) return 'gerade eben';
    const value = abs < 1 ? `${Math.round(abs * 24)} Stunden` : `${Math.round(abs)} Tagen`;
    return d < 0 ? `vor ${value}` : `in ${value}`;
  },
};

/** ISO <-> Wert fuer <input type="datetime-local"> (lokale Zeitzone). */
export function toLocalInput(iso = new Date().toISOString()) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fromLocalInput = (value) => new Date(value).toISOString();

export function field(label, input, hint) {
  return el('label', { class: 'field' },
    el('span', { class: 'field-label' }, label),
    input,
    hint ? el('span', { class: 'field-hint' }, hint) : null);
}

export function select(options, value, onchange, props = {}) {
  const s = el('select', { ...props, onchange: (e) => onchange(e.target.value) });
  for (const o of options) {
    const opt = el('option', { value: o.value }, o.label);
    if (String(o.value) === String(value)) opt.selected = true;
    s.appendChild(opt);
  }
  return s;
}

export function card(title, ...children) {
  return el('section', { class: 'card' },
    title ? el('h2', { class: 'card-title' }, title) : null, ...children);
}

export function stat(label, value, sub, tone = '') {
  return el('div', { class: `stat ${tone}` },
    el('div', { class: 'stat-value' }, value),
    el('div', { class: 'stat-label' }, label),
    sub ? el('div', { class: 'stat-sub' }, sub) : null);
}

export function table(headers, rows) {
  return el('div', { class: 'table-wrap' },
    el('table', {},
      el('thead', {}, el('tr', {}, headers.map((h) => el('th', {}, h)))),
      el('tbody', {}, rows.length
        ? rows.map((cells) => el('tr', {}, cells.map((c) => el('td', {}, c))))
        : el('tr', {}, el('td', { colspan: headers.length, class: 'empty' }, 'Noch keine Eintraege')))));
}

export function confirmDelete(text = 'Eintrag wirklich loeschen?') {
  return window.confirm(text);
}

/** Einfache Reiter-Navigation innerhalb einer Ansicht. */
export function tabs(items, current, onchange) {
  return el('div', { class: 'tabs', role: 'tablist' }, items.map((t) =>
    el('button', {
      class: `tab${t.id === current ? ' active' : ''}`,
      role: 'tab', type: 'button',
      onclick: () => onchange(t.id),
    }, t.label, t.badge != null ? el('span', { class: 'tab-badge' }, String(t.badge)) : null)));
}

/** Zahleneingabe mit Plus/Minus - auf dem Handy deutlich schneller als Tippen. */
export function stepper(value, { step = 1, min = 0, max = Infinity, onchange, suffix = '' } = {}) {
  const input = el('input', {
    type: 'number', value, step, min, inputmode: 'decimal',
    oninput: (e) => onchange(e.target.value === '' ? '' : Number(e.target.value)),
  });
  const bump = (delta) => {
    const next = Math.min(max, Math.max(min, (Number(input.value) || 0) + delta));
    input.value = Number(next.toFixed(3));
    onchange(Number(input.value));
  };
  return el('div', { class: 'stepper' },
    el('button', { class: 'step-btn', type: 'button', 'aria-label': 'weniger', onclick: () => bump(-step) }, '−'),
    input,
    suffix ? el('span', { class: 'step-suffix' }, suffix) : null,
    el('button', { class: 'step-btn', type: 'button', 'aria-label': 'mehr', onclick: () => bump(step) }, '+'));
}

/** Tabelle, die auf schmalen Bildschirmen zu Karten wird. */
export function responsiveTable(headers, rows) {
  const wrap = table(headers, rows);
  // Die Klasse gehoert an die Tabelle selbst, nicht an den Scroll-Container:
  // erst dann greift auf schmalen Bildschirmen das Kartenlayout.
  wrap.querySelector('table')?.classList.add('responsive');
  for (const tr of wrap.querySelectorAll('tbody tr')) {
    [...tr.children].forEach((td, i) => { td.dataset.label = headers[i] || ''; });
  }
  return wrap;
}
