/** Kleine SVG-Diagrammkomponente - Linien, Achsen, Marker, Fadenkreuz. */

import { svg, el } from './dom.js';

const PAD = { top: 16, right: 16, bottom: 30, left: 52 };

function niceTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min || 0];
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const out = [];
  for (let v = start; v <= max + step * 0.001; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/**
 * options: { series:[{label,color,points:[[x,y]],dashed,area}], markers:[{x,label,color}],
 *            nowX, height, formatX, formatY, yMin, yMax, yLabel, bands:[{from,to,color,label}] }
 */
export function lineChart(options) {
  const {
    series = [], markers = [], nowX = null, height = 260,
    formatX = (v) => String(Math.round(v)), formatY = (v) => String(Math.round(v)),
    yLabel = '', bands = [], onHover = null,
  } = options;

  const width = 720; // ViewBox-Breite; per CSS wird responsiv skaliert
  const root = svg('svg', {
    class: 'chart', viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none', role: 'img', 'aria-label': yLabel || 'Diagramm',
  });

  const pts = series.flatMap((s) => s.points);
  if (!pts.length) {
    root.appendChild(svg('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle', class: 'chart-empty' }));
    root.lastChild.textContent = 'Keine Daten';
    return el('div', { class: 'chart-wrap' }, root);
  }

  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = options.yMin ?? 0;
  const yMax = options.yMax ?? (Math.max(...ys) * 1.12 || 1);

  const iw = width - PAD.left - PAD.right;
  const ih = height - PAD.top - PAD.bottom;
  const sx = (x) => PAD.left + ((x - xMin) / (xMax - xMin || 1)) * iw;
  const sy = (y) => PAD.top + ih - ((y - yMin) / (yMax - yMin || 1)) * ih;

  // Referenzbaender (z. B. Zielbereich)
  for (const b of bands) {
    const y1 = sy(Math.min(b.to, yMax)), y2 = sy(Math.max(b.from, yMin));
    root.appendChild(svg('rect', {
      x: PAD.left, y: y1, width: iw, height: Math.max(0, y2 - y1),
      fill: b.color || 'var(--band)', opacity: b.opacity ?? 1, class: 'chart-band',
    }));
  }

  // Gitter + Achsen
  for (const t of niceTicks(yMin, yMax, 5)) {
    const y = sy(t);
    root.appendChild(svg('line', { x1: PAD.left, x2: width - PAD.right, y1: y, y2: y, class: 'grid' }));
    const label = svg('text', { x: PAD.left - 8, y: y + 4, 'text-anchor': 'end', class: 'axis' });
    label.textContent = formatY(t);
    root.appendChild(label);
  }
  for (const t of niceTicks(xMin, xMax, 6)) {
    const x = sx(t);
    root.appendChild(svg('line', { x1: x, x2: x, y1: PAD.top, y2: height - PAD.bottom, class: 'grid grid-v' }));
    const label = svg('text', { x, y: height - PAD.bottom + 16, 'text-anchor': 'middle', class: 'axis' });
    label.textContent = formatX(t);
    root.appendChild(label);
  }

  // Injektionsmarker
  for (const m of markers) {
    if (m.x < xMin || m.x > xMax) continue;
    root.appendChild(svg('line', {
      x1: sx(m.x), x2: sx(m.x), y1: height - PAD.bottom, y2: height - PAD.bottom - 10,
      class: 'marker', stroke: m.color || 'currentColor',
    }));
  }

  // "Jetzt"-Linie
  if (nowX != null && nowX >= xMin && nowX <= xMax) {
    root.appendChild(svg('line', {
      x1: sx(nowX), x2: sx(nowX), y1: PAD.top, y2: height - PAD.bottom, class: 'now-line',
    }));
    const t = svg('text', { x: sx(nowX) + 4, y: PAD.top + 10, class: 'now-label' });
    t.textContent = 'jetzt';
    root.appendChild(t);
  }

  // Datenreihen
  for (const s of series) {
    const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(2)} ${sy(p[1]).toFixed(2)}`).join(' ');
    if (s.area) {
      root.appendChild(svg('path', {
        d: `${d} L${sx(s.points.at(-1)[0]).toFixed(2)} ${sy(yMin)} L${sx(s.points[0][0]).toFixed(2)} ${sy(yMin)} Z`,
        fill: s.color, opacity: 0.12, stroke: 'none',
      }));
    }
    root.appendChild(svg('path', {
      d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2,
      'stroke-dasharray': s.dashed ? '5 4' : null, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    }));
    for (const p of s.dots || []) {
      root.appendChild(svg('circle', { cx: sx(p[0]), cy: sy(p[1]), r: 3.5, fill: s.color }));
    }
  }

  // Fadenkreuz
  const cross = svg('line', { y1: PAD.top, y2: height - PAD.bottom, class: 'crosshair', opacity: 0 });
  root.appendChild(cross);
  const wrap = el('div', { class: 'chart-wrap' }, root);
  const tip = el('div', { class: 'chart-tip', style: { opacity: 0 } });
  wrap.appendChild(tip);

  root.addEventListener('pointermove', (ev) => {
    const rect = root.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * width;
    if (px < PAD.left || px > width - PAD.right) return;
    const xVal = xMin + ((px - PAD.left) / iw) * (xMax - xMin);
    cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('opacity', 1);
    const rows = series.map((s) => {
      let best = s.points[0], bestD = Infinity;
      for (const p of s.points) {
        const dd = Math.abs(p[0] - xVal);
        if (dd < bestD) { bestD = dd; best = p; }
      }
      return `<span class="dot" style="background:${s.color}"></span>${s.label}: <b>${formatY(best[1])}</b>`;
    });
    tip.innerHTML = `<div class="tip-x">${formatX(xVal)}</div>${rows.map((r) => `<div>${r}</div>`).join('')}`;
    tip.style.opacity = 1;
    tip.style.left = `${Math.min(Math.max((px / width) * 100, 8), 78)}%`;
    if (onHover) onHover(xVal);
  });
  root.addEventListener('pointerleave', () => {
    cross.setAttribute('opacity', 0); tip.style.opacity = 0;
  });

  return wrap;
}

export function legend(series) {
  return el('div', { class: 'legend' }, series.map((s) => el('span', { class: 'legend-item' },
    el('span', { class: 'dot', style: { background: s.color } }), s.label)));
}

export const PALETTE = ['#2f81f7', '#e3574a', '#3fb950', '#d29922', '#a371f7', '#00b3a4', '#f778ba'];
