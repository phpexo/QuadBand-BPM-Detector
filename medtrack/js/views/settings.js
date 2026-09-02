import { el, card, fmt, field, select, stepper, table, responsiveTable, confirmDelete } from '../ui/dom.js';
import { getState, setSetting, update, uid, exportJson, importJson, resetAll, downloadFile } from '../store.js';
import { CLASSES, ROUTES } from '../pk/compounds.js';
import { resolver, baseAmount, bodyMetrics } from '../model.js';
import { pastEvents, projectedDoses } from '../model.js';
import { terminalHalfLife, formatDuration, MS_PER_DAY } from '../pk/engine.js';
import { buildAdvice } from '../safety/advice.js';
import { MARKER_BY_ID, evaluatePanel } from '../safety/labs.js';
import {
  dueItems, buildIcs, notificationPermission, requestNotificationPermission, notificationsSupported,
} from '../reminders.js';

export function render(ctx) {
  const { state, rerender, now } = ctx;
  const s = state.settings;
  const root = el('div', { class: 'view' });

  // ---------------------------------------------------------------- Profil
  root.appendChild(card('Profil',
    el('div', { class: 'form-grid' },
      field('Koerpergewicht (kg)', el('input', { type: 'number', value: s.weightKg, min: 30, max: 250,
        onchange: (e) => { setSetting('weightKg', Number(e.target.value)); rerender(); } }),
        'geht in die Serumschaetzung ein'),
      field('Koerpergroesse (cm)', el('input', { type: 'number', value: s.heightCm, min: 120, max: 230,
        onchange: (e) => { setSetting('heightCm', Number(e.target.value)); rerender(); } }),
        'fuer BMI, FFMI und Koerperfett-Schaetzung'),
      field('Geschlecht', select([{ value: 'm', label: 'maennlich' }, { value: 'f', label: 'weiblich' }],
        s.sex, (v) => { setSetting('sex', v); rerender(); }),
        'bestimmt die Formeln fuer Koerperfett und Referenzbereiche'),
      field('Alter', el('input', { type: 'number', value: s.age, min: 14, max: 100,
        onchange: (e) => { setSetting('age', Number(e.target.value)); rerender(); } }),
        'geht in die Caliper-Formel ein'),
      field('Kontrollintervall Labor (Tage)', select(
        [90, 120, 180, 270, 365].map((d) => ({ value: d, label: `${d} Tage` })), s.labIntervalDays,
        (v) => { setSetting('labIntervalDays', Number(v)); rerender(); }),
        'Bei Dosierungen oberhalb des Substitutionsbereichs verkuerzt die App das automatisch auf 90 Tage.'))));

  // ---------------------------------------------------------------- Erinnerungen
  root.appendChild(remindersCard(ctx));

  // ---------------------------------------------------------------- Training
  root.appendChild(card('Training',
    el('div', { class: 'form-grid' },
      field('Formel fuer das geschaetzte 1RM', select([
        { value: 'epley', label: 'Epley (Standard)' },
        { value: 'brzycki', label: 'Brzycki' },
        { value: 'lombardi', label: 'Lombardi' },
      ], s.e1rmFormula, (v) => { setSetting('e1rmFormula', v); rerender(); }),
        'Alle drei sind Schaetzungen; wichtig ist, bei einer zu bleiben.'),
      field('Standard-Satzpause (s)', stepper(s.restSeconds, {
        step: 15, min: 0, max: 600, onchange: (v) => setSetting('restSeconds', Number(v) || 0),
      })),
      field('Hantelstange (kg)', stepper(s.barKg, {
        step: 2.5, min: 0, max: 40, onchange: (v) => setSetting('barKg', Number(v) || 20),
      }), 'fuer den Scheibenrechner'),
      field('Verfuegbare Scheiben (kg)', el('input', {
        type: 'text', value: (s.plates || []).join(', '),
        onchange: (e) => setSetting('plates', e.target.value.split(/[,;\s]+/).map(Number).filter((n) => n > 0)),
      }), 'kommagetrennt, je Seite vorhanden'))));

  // ---------------------------------------------------------------- Arztbericht
  root.appendChild(card('Bericht fuer das Arztgespraech',
    el('p', {}, 'Erstellt eine kompakte Uebersicht deiner Medikation, Laborwerte und Koerperdaten als Textdatei - zum Ausdrucken oder Mitnehmen. Offenheit gegenueber der behandelnden Person ist der wirksamste einzelne Schritt zur Schadensminimierung.'),
    el('div', { class: 'row-actions' },
      el('button', { class: 'btn primary', onclick: () => {
        downloadFile(`arztbericht-${new Date().toISOString().slice(0, 10)}.txt`, buildReport(getState(), Date.now()), 'text/plain');
      } }, 'Bericht erzeugen'))));

  // ---------------------------------------------------------------- Daten
  root.appendChild(card('Daten',
    el('p', {}, 'Alle Daten liegen ausschliesslich in diesem Browser (localStorage). Es gibt keinen Server und keine Uebertragung nach aussen. Das bedeutet auch: Loeschst du die Browserdaten oder wechselst das Geraet, sind die Eintraege weg - lege regelmaessig eine Sicherung an.'),
    el('div', { class: 'row-actions' },
      el('button', { class: 'btn', onclick: () => {
        downloadFile(`medtrack-backup-${new Date().toISOString().slice(0, 10)}.json`, exportJson());
      } }, 'Sicherung herunterladen'),
      el('label', { class: 'btn' }, 'Sicherung einspielen',
        el('input', { type: 'file', accept: 'application/json', style: { display: 'none' },
          onchange: async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try { importJson(await file.text()); rerender(); alert('Daten wurden eingespielt.'); }
            catch (err) { alert(`Import fehlgeschlagen: ${err.message}`); }
          } })),
      el('button', { class: 'btn danger', onclick: () => {
        if (confirmDelete('Wirklich ALLE Daten unwiderruflich loeschen?')
          && confirmDelete('Letzte Sicherheitsabfrage: alles loeschen?')) { resetAll(); rerender(); }
      } }, 'Alle Daten loeschen'))));

  // ---------------------------------------------------------------- Eigene Substanzen
  root.appendChild(customCompoundCard(ctx));

  // ---------------------------------------------------------------- Info
  root.appendChild(card('Ueber die App',
    el('p', {}, 'Diese Anwendung ist ein Werkzeug zur Dokumentation und zur Schadensminimierung. Sie ist kein Medizinprodukt, stellt keine Diagnosen und gibt keine Dosierungsempfehlungen.'),
    el('ul', { class: 'checklist' },
      el('li', {}, 'Bei aerztlich verordneter Therapie: Alle Aenderungen gehoeren in die Hand der behandelnden Person.'),
      el('li', {}, 'Bei Gebrauch ausserhalb einer Behandlung: Regelmaessige Blutkontrollen und Blutdruckmessung sind das Minimum. Sprich offen mit einem Arzt - er behandelt dich, er zeigt dich nicht an (aerztliche Schweigepflicht).'),
      el('li', {}, 'Anlaufstellen in Deutschland: Hausarzt, Endokrinologie, Sportmedizin; bei Abhaengigkeit oder psychischer Belastung die Suchtberatung vor Ort.')),
    el('p', { class: 'muted small' }, 'Version 0.1 · Offline nutzbar · Keine Datenuebertragung')));

  return root;
}

function customCompoundCard(ctx) {
  const { state, rerender } = ctx;
  const draft = { name: '', short: '', cls: 'aas', base: '', route: 'im', esterFactor: 1, tHalfAbs: 3, tHalfElim: 0.05 };

  const rows = (state.customCompounds || []).map((c) => [
    c.name, CLASSES[c.cls] || c.cls, c.base, `${fmt.num(c.esterFactor * 100, 1)} %`,
    formatDuration(c.tHalfAbs), formatDuration(terminalHalfLife(c)),
    el('button', { class: 'btn small danger', onclick: () => {
      if (confirmDelete('Substanz entfernen?')) {
        update((s) => { s.customCompounds = s.customCompounds.filter((x) => x.id !== c.id); });
        rerender();
      }
    } }, 'loeschen'),
  ]);

  return card('Eigene Substanz hinzufuegen',
    el('p', { class: 'muted small' },
      'Fuer Praeparate, die nicht in der Liste stehen. Der Ester-Faktor ist das Verhaeltnis der Molmassen (Basis-Hormon / Ester); ohne genaue Angabe 1,0 setzen. Selbst angelegte Substanzen werden immer als "nicht belegt" gefuehrt.'),
    el('form', { class: 'form-grid', onsubmit: (e) => {
      e.preventDefault();
      if (!draft.name || !draft.base) return;
      update((s) => s.customCompounds.push({
        id: `custom-${uid()}`, name: draft.name, short: draft.short || draft.name,
        cls: draft.cls, base: draft.base, route: draft.route,
        esterFactor: Number(draft.esterFactor) || 1,
        tHalfAbs: Number(draft.tHalfAbs) || 1,
        tHalfElim: Number(draft.tHalfElim) || 0.05,
        confidence: 'low', medical: false, custom: true,
      }));
      rerender();
    } },
      field('Name', el('input', { type: 'text', required: true, oninput: (e) => { draft.name = e.target.value; } })),
      field('Kuerzel', el('input', { type: 'text', oninput: (e) => { draft.short = e.target.value; } })),
      field('Basis-Hormon', el('input', { type: 'text', required: true, placeholder: 'z. B. Testosteron',
        oninput: (e) => { draft.base = e.target.value; } })),
      field('Klasse', select(Object.entries(CLASSES).map(([value, label]) => ({ value, label })), draft.cls,
        (v) => { draft.cls = v; })),
      field('Applikation', select(Object.entries(ROUTES).map(([value, label]) => ({ value, label })), draft.route,
        (v) => { draft.route = v; })),
      field('Ester-Faktor', el('input', { type: 'number', step: 0.001, min: 0.1, max: 1, value: 1,
        oninput: (e) => { draft.esterFactor = e.target.value; } })),
      field('Ester-HWZ (Tage)', el('input', { type: 'number', step: 0.1, min: 0.01, value: 3,
        oninput: (e) => { draft.tHalfAbs = e.target.value; } })),
      field('Eliminations-HWZ (Tage)', el('input', { type: 'number', step: 0.01, min: 0.001, value: 0.05,
        oninput: (e) => { draft.tHalfElim = e.target.value; } }), 'freies Hormon, meist Stunden'),
      el('div', { class: 'form-actions' }, el('button', { class: 'btn', type: 'submit' }, 'Hinzufuegen'))),
    rows.length ? table(['Name', 'Klasse', 'Basis', 'Ester-Faktor', 'Ester-HWZ', 'terminale HWZ', ''], rows) : null);
}

/** Klartext-Zusammenfassung fuer das Arztgespraech. */
export function buildReport(state, now) {
  const resolve = resolver(state);
  const L = [];
  const line = (t = '') => L.push(t);
  const rule = () => line('-'.repeat(64));

  line('UEBERSICHT FUER DAS AERZTLICHE GESPRAECH');
  line(`Erstellt am ${new Date(now).toLocaleString('de-DE')}`);
  rule();

  const body = (state.bodyLog || [])[0];
  const bm = bodyMetrics(body, state.settings.heightCm);
  line('PERSON');
  line(`  Groesse: ${state.settings.heightCm} cm`);
  if (bm) {
    line(`  Gewicht: ${bm.weight.toFixed(1)} kg (Stand ${new Date(body.at).toLocaleDateString('de-DE')})`);
    if (bm.bodyFat != null) line(`  Koerperfett: ${bm.bodyFat.toFixed(1)} %`);
  }
  const bp = (state.bodyLog || []).find((b) => b.systolic);
  if (bp) line(`  Letzter Blutdruck: ${bp.systolic}/${bp.diastolic} mmHg (${new Date(bp.at).toLocaleDateString('de-DE')})`);
  line();

  line('AKTUELLE MEDIKATION (Protokolle)');
  const active = (state.protocols || []).filter((p) => p.active);
  if (!active.length) line('  keine aktiven Protokolle hinterlegt');
  for (const p of active) {
    const c = resolve(p.compoundId);
    if (!c) continue;
    const weekly = baseAmount(c, Number(p.doseMg)) * (7 / Number(p.intervalDays));
    line(`  ${c.name}: ${p.doseMg} ${c.unit || 'mg'} alle ${p.intervalDays} Tage`);
    line(`      entspricht ${weekly.toFixed(1)} mg ${c.base} pro Woche, ${ROUTES[c.route] || c.route}`);
    if (p.startAt) line(`      seit ${new Date(p.startAt).toLocaleDateString('de-DE')}`);
  }
  line();

  line('GABEN DER LETZTEN 90 TAGE');
  const recent = (state.injections || []).filter((i) => Date.parse(i.at) > now - 90 * MS_PER_DAY);
  if (!recent.length) line('  keine dokumentiert');
  for (const i of recent.slice(0, 60)) {
    const c = resolve(i.compoundId);
    line(`  ${new Date(i.at).toLocaleString('de-DE')}  ${c?.name || i.compoundId}  ${i.doseMg} ${c?.unit || 'mg'}${i.site ? `  (${i.site})` : ''}`);
  }
  line();

  const panels = [...(state.panels || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  line('LABORWERTE (letzte drei Befunde)');
  if (!panels.length) line('  keine hinterlegt');
  for (const p of panels.slice(0, 3)) {
    line(`  Befund vom ${new Date(p.at).toLocaleString('de-DE')}${p.lab ? ` (${p.lab})` : ''}`);
    for (const r of evaluatePanel(p)) {
      const flag = r.level === 'ok' ? '' : `   << ${r.text}`;
      line(`      ${r.marker.name}: ${r.value} ${r.marker.unit}${flag}`);
    }
    line();
  }

  line('BEOBACHTETE NEBENWIRKUNGEN (letzte 90 Tage)');
  const sides = new Map();
  for (const b of state.bodyLog || []) {
    if (Date.parse(b.at) < now - 90 * MS_PER_DAY) continue;
    for (const sName of b.sides || []) sides.set(sName, (sides.get(sName) || 0) + 1);
  }
  if (!sides.size) line('  keine dokumentiert');
  for (const [name, count] of [...sides.entries()].sort((a, b) => b[1] - a[1])) {
    line(`  ${name}: an ${count} Tag(en) berichtet`);
  }
  line();

  line('OFFENE HINWEISE DER APP');
  for (const a of buildAdvice(state, pastEvents(state, now), now)) {
    if (a.level === 'ok') continue;
    line(`  [${a.level.toUpperCase()}] ${a.title}`);
    if (a.action) line(`         ${a.action}`);
  }
  line();
  rule();
  line('Erstellt mit MedTrack. Die Angaben beruhen auf Selbstdokumentation.');
  line('Berechnete Wirkstoffkurven sind Modellwerte und ersetzen keine Messung.');
  return L.join('\n');
}

/** Erinnerungen: Browser-Benachrichtigungen und Kalender-Export. */
function remindersCard(ctx) {
  const { state, rerender, now } = ctx;
  const s = state.settings;
  const permission = notificationPermission();
  const upcoming = dueItems(state, now, 30);

  const toggle = (key, label, hint) => el('label', { class: 'switch-row' },
    el('input', {
      type: 'checkbox', checked: !!(s.reminders || {})[key],
      onchange: (e) => {
        update((st) => { st.settings.reminders = { ...(st.settings.reminders || {}), [key]: e.target.checked }; });
        rerender();
      },
    }),
    el('span', {}, el('b', {}, label), hint ? el('span', { class: 'muted small' }, hint) : null));

  const permissionRow = !notificationsSupported()
    ? el('p', { class: 'warn-inline' }, 'Dieser Browser unterstuetzt keine Benachrichtigungen. Nutze den Kalender-Export.')
    : permission === 'granted'
      ? el('p', { class: 'muted small' }, 'Benachrichtigungen sind erlaubt.')
      : permission === 'denied'
        ? el('p', { class: 'warn-inline' }, 'Benachrichtigungen wurden fuer diese Seite blockiert. Das laesst sich nur in den Browsereinstellungen wieder aendern.')
        : el('button', { class: 'btn', onclick: () => requestNotificationPermission().then(rerender) },
            'Benachrichtigungen erlauben');

  return card('Erinnerungen',
    el('p', {}, 'Eine App ohne Server kann nur benachrichtigen, solange sie geoeffnet ist - oder beim naechsten Oeffnen nachmelden. Verlaesslich erinnert dich der Kalender-Export: Er legt alle anstehenden Termine mit Voralarm in deinen normalen Kalender.'),
    permissionRow,
    el('div', { class: 'switch-list' },
      toggle('injection', 'Injektionen', 'aus deinen aktiven Protokollen'),
      toggle('lab', 'Blutkontrolle', 'nach dem eingestellten Intervall'),
      toggle('doctor', 'Arzttermine', 'aus den eingetragenen Folgeterminen'),
      toggle('bloodpressure', 'Blutdruck messen', `alle ${s.bpIntervalDays || 7} Tage`)),
    el('div', { class: 'row-actions' },
      el('button', { class: 'btn primary', onclick: () => {
        downloadFile(`medtrack-termine-${new Date().toISOString().slice(0, 10)}.ics`,
          buildIcs(getState(), { now: Date.now(), horizonDays: 120 }), 'text/calendar');
      } }, 'Termine als Kalenderdatei (.ics)'),
      el('button', { class: 'btn', onclick: () => {
        update((st) => { st.settings.notified = {}; });
        rerender();
      } }, 'Gemeldete Erinnerungen zuruecksetzen')),
    upcoming.length
      ? responsiveTable(['Wann', 'Was', 'Details'], upcoming.slice(0, 8).map((i) => [
          fmt.dateTime(i.at), i.title, i.body || '']))
      : el('p', { class: 'muted small' }, 'Aktuell steht nichts an. Lege unter "Medikation" ein Protokoll an, damit Injektionstermine berechnet werden.'));
}
