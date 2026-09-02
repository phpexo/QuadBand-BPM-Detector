import { el, clear } from './ui/dom.js';
import { getState, subscribe, setSetting, update } from './store.js';
import { notifyDue, scheduleWhileOpen } from './reminders.js';
import * as dashboard from './views/dashboard.js';
import * as meds from './views/meds.js';
import * as curve from './views/curve.js';
import * as labs from './views/labs.js';
import * as body from './views/body.js';
import * as gym from './views/gym.js';
import * as safety from './views/safety.js';
import * as library from './views/library.js';
import * as settings from './views/settings.js';

const ROUTES = [
  { path: '/', label: 'Uebersicht', icon: '◧', view: dashboard },
  { path: '/medikation', label: 'Medikation', icon: '💉', view: meds },
  { path: '/kurve', label: 'Wirkstoffkurve', icon: '📈', view: curve },
  { path: '/labor', label: 'Labor', icon: '🩸', view: labs },
  { path: '/koerper', label: 'Koerper', icon: '⚖', view: body },
  { path: '/training', label: 'Training', icon: '🏋', view: gym },
  { path: '/sicherheit', label: 'Sicherheit', icon: '⚠', view: safety },
  { path: '/wissen', label: 'Substanzen', icon: '📚', view: library },
  { path: '/einstellungen', label: 'Einstellungen', icon: '⚙', view: settings },
];

const main = document.getElementById('main');
const nav = document.getElementById('nav');

function currentPath() {
  const hash = location.hash.replace(/^#/, '');
  return ROUTES.some((r) => r.path === hash) ? hash : '/';
}

function renderNav() {
  clear(nav);
  const path = currentPath();
  for (const r of ROUTES) {
    nav.appendChild(el('a', {
      href: `#${r.path}`,
      class: `nav-item${r.path === path ? ' active' : ''}`,
    }, el('span', { class: 'nav-icon' }, r.icon), el('span', { class: 'nav-label' }, r.label)));
  }
}

function render() {
  const route = ROUTES.find((r) => r.path === currentPath()) || ROUTES[0];
  document.title = `${route.label} · MedTrack`;
  renderNav();
  clear(main);
  const ctx = { state: getState(), now: Date.now(), rerender: render };
  try {
    main.appendChild(route.view.render(ctx));
  } catch (err) {
    console.error(err);
    main.appendChild(el('div', { class: 'card' },
      el('h2', {}, 'Fehler beim Anzeigen'),
      el('pre', {}, String(err && err.stack ? err.stack : err))));
  }
  main.scrollTop = 0;
  window.scrollTo(0, 0);
}

/** Einmaliger Hinweis vor der ersten Nutzung. */
function disclaimerGate() {
  if (getState().settings.disclaimerAcceptedAt) return true;
  const overlay = el('div', { class: 'overlay' },
    el('div', { class: 'modal' },
      el('h1', {}, 'Bevor du startest'),
      el('p', {}, 'MedTrack ist ein Dokumentations- und Aufklaerungswerkzeug. Es ist ',
        el('b', {}, 'kein Medizinprodukt'), ' und ersetzt keine aerztliche Behandlung.'),
      el('ul', { class: 'checklist' },
        el('li', {}, 'Die App gibt keine Dosierungs- oder Kurempfehlungen.'),
        el('li', {}, 'Berechnete Wirkstoffkurven sind Modellwerte auf Basis von Populationsmittelwerten und weichen individuell ab.'),
        el('li', {}, 'Fuer einige gefuehrte Substanzen - unter anderem Trenbolon - gibt es keine humanen Studiendaten. Deren Kurven sind Schaetzungen.'),
        el('li', {}, 'Regelmaessige aerztliche Kontrolle und Blutuntersuchungen sind durch nichts zu ersetzen.'),
        el('li', {}, 'Alle Daten bleiben lokal auf diesem Geraet.')),
      el('p', { class: 'muted small' },
        'Bei Brustschmerz, Atemnot, einseitiger Beinschwellung, Sehstoerungen, Gelbfaerbung der Haut oder Suizidgedanken: sofort aerztliche Hilfe holen, Notruf 112.'),
      el('button', { class: 'btn primary', onclick: () => {
        setSetting('disclaimerAcceptedAt', new Date().toISOString());
        overlay.remove();
        render();
      } }, 'Verstanden')));
  document.body.appendChild(overlay);
  return false;
}

/**
 * Erinnerungen: beim Oeffnen wird nachgemeldet, was faellig geworden ist,
 * und fuer den Rest des Tages werden Timer gesetzt, solange die App laeuft.
 */
let cancelTimers = null;
function armReminders() {
  const state = getState();
  if (!state.settings.disclaimerAcceptedAt) return;
  notifyDue(state, (entries) => {
    update((s) => { s.settings.notified = { ...(s.settings.notified || {}), ...entries }; });
  }).catch(() => { /* Benachrichtigungen sind optional */ });

  cancelTimers?.();
  cancelTimers = scheduleWhileOpen(state, () => {
    notifyDue(getState(), (entries) => {
      update((s) => { s.settings.notified = { ...(s.settings.notified || {}), ...entries }; });
    }).catch(() => {});
  });
}

window.addEventListener('hashchange', render);
subscribe(() => renderNav());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') armReminders();
});

if (disclaimerGate()) { render(); armReminders(); }
else renderNav();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* offline-Modus optional */ });
}
