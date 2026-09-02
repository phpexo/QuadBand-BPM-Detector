import { el, card, fmt, field, table, toLocalInput, fromLocalInput, confirmDelete } from '../ui/dom.js';
import { addItem, removeItem } from '../store.js';
import { pastEvents } from '../model.js';
import { buildAdvice, RED_FLAGS, INJECTION_SAFETY } from '../safety/advice.js';
import { adviceCard } from './dashboard.js';

const MONITORING = [
  ['Blutdruck (selbst gemessen)', 'woechentlich', 'Haeufigste und am leichtesten uebersehene Folge. Zu Hause messbar.'],
  ['Grosses Blutbild (Haematokrit, Hb)', 'alle 3-6 Monate', 'Zentraler Sicherheitsmarker unter Testosteron.'],
  ['Lipidprofil inkl. ApoB', 'alle 6 Monate', 'Anabolika senken HDL teils drastisch.'],
  ['Leberwerte (ALT, AST, GGT, Bilirubin)', 'alle 6 Monate, unter oralen Substanzen alle 4-8 Wochen', 'Orale 17-alpha-alkylierte Substanzen belasten die Leber.'],
  ['Nierenwerte (Kreatinin, Cystatin C, eGFR)', 'alle 6-12 Monate', 'Cystatin C ist bei viel Muskelmasse aussagekraeftiger.'],
  ['Gesamt-Testosteron (Talwert)', '6-12 Wochen nach jeder Aenderung, dann alle 6-12 Monate', 'Immer standardisiert abnehmen: gleicher Abstand zur letzten Gabe.'],
  ['Estradiol (sensitiver Assay)', 'zusammen mit Testosteron', 'Nur mit LC-MS/MS sinnvoll beurteilbar.'],
  ['Prolaktin', 'bei 19-Nor-Substanzen und bei Beschwerden', 'Relevant bei Nandrolon und Trenbolon.'],
  ['PSA und Prostata-Untersuchung', 'vor Therapiebeginn, dann jaehrlich ab 40', 'Teil jeder leitliniengerechten Testosterontherapie.'],
  ['Herz-Ultraschall / EKG', 'bei Beschwerden, unter hohen Dosen periodisch', 'Linksherzhypertrophie ist bei langjaehrigem Gebrauch beschrieben.'],
  ['Schlafapnoe-Abklaerung', 'bei Schnarchen, Tagesmuedigkeit, steigendem Haematokrit', 'Testosteron kann eine Schlafapnoe verstaerken.'],
];

export function render(ctx) {
  const { state, now, rerender } = ctx;
  const root = el('div', { class: 'view' });
  const advice = buildAdvice(state, pastEvents(state, now), now);

  root.appendChild(card('Deine aktuellen Hinweise', ...advice.map(adviceCard)));

  // ---------------------------------------------------------------- Notfallzeichen
  root.appendChild(card('Sofort aerztliche Hilfe holen bei',
    el('div', { class: 'redflags' }, RED_FLAGS.map((f) =>
      el('div', { class: 'redflag' },
        el('strong', {}, f.sign),
        el('span', { class: 'muted' }, f.why),
        el('span', { class: 'redflag-act' }, f.act)))),
    el('p', { class: 'emergency-note' },
      'Notruf in Deutschland, Oesterreich und der Schweiz: 112. Aerztlicher Bereitschaftsdienst (D): 116 117. Telefonseelsorge (D): 0800 111 0 111 oder 0800 111 0 222, rund um die Uhr und kostenfrei.'),
    el('p', { class: 'muted small' },
      'Sag in der Notaufnahme offen, was du nimmst - inklusive Dosis und Zeitpunkt. Das ist keine Strafanzeige, sondern medizinisch entscheidend fuer die richtige Behandlung. Der Export unter "Einstellungen" liefert dir dafuer eine Uebersicht.')));

  // ---------------------------------------------------------------- Kontrollplan
  root.appendChild(card('Empfohlener Kontrollplan',
    table(['Untersuchung', 'Intervall', 'Warum'], MONITORING.map((m) => [m[0], m[1], m[2]])),
    el('p', { class: 'muted small' },
      'Orientierung an den Leitlinien zur Testosterontherapie (u. a. Endocrine Society). Bei Dosierungen oberhalb des Substitutionsbereichs sind engmaschigere Kontrollen sinnvoll. Was fuer dich gilt, entscheidet die behandelnde Aerztin oder der behandelnde Arzt.')));

  // ---------------------------------------------------------------- Arzttermine
  root.appendChild(doctorCard(ctx));

  // ---------------------------------------------------------------- Grundlagen
  root.appendChild(card('Injektionssicherheit',
    el('ul', { class: 'checklist' }, INJECTION_SAFETY.map((t) => el('li', {}, t)))));

  root.appendChild(card('Was diese App nicht leistet',
    el('ul', { class: 'checklist' },
      el('li', {}, 'Sie gibt keine Dosierungs- oder Kurempfehlungen und schlaegt keine Substanzen vor.'),
      el('li', {}, 'Sie ersetzt keine aerztliche Untersuchung, keine Blutabnahme und keine Diagnose.'),
      el('li', {}, 'Die berechneten Kurven sind Modellwerte auf Basis von Populationsmittelwerten. Individuell koennen die realen Spiegel deutlich abweichen.'),
      el('li', {}, 'Fuer mehrere hier gefuehrte Substanzen - unter anderem Trenbolon - existieren keine humanen pharmakokinetischen Studien. Deren Kurven sind Schaetzungen.'),
      el('li', {}, 'Der Gebrauch anaboler Steroide ausserhalb einer aerztlichen Behandlung ist mit erheblichen gesundheitlichen Risiken verbunden - Herz-Kreislauf-System, Leber, Psyche, Fruchtbarkeit. Ein Teil dieser Schaeden bildet sich nach dem Absetzen nicht vollstaendig zurueck.'))));

  return root;
}

function doctorCard(ctx) {
  const { state, rerender } = ctx;
  const draft = { at: toLocalInput(), type: 'Kontrolltermin', note: '', nextAt: '' };
  const visits = [...(state.doctorVisits || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const upcoming = visits.map((v) => v.nextAt).filter(Boolean).sort()[0];

  return card('Arzt & Termine',
    upcoming ? el('p', {}, el('b', {}, 'Naechster Termin: '), fmt.dateTime(upcoming)) : null,
    el('form', { class: 'form-grid', onsubmit: (e) => {
      e.preventDefault();
      addItem('doctorVisits', { at: fromLocalInput(draft.at), type: draft.type, note: draft.note,
        nextAt: draft.nextAt ? fromLocalInput(draft.nextAt) : null });
      rerender();
    } },
      field('Datum', el('input', { type: 'datetime-local', value: draft.at, required: true,
        onchange: (e) => { draft.at = e.target.value; } })),
      field('Anlass', el('input', { type: 'text', value: draft.type,
        oninput: (e) => { draft.type = e.target.value; } })),
      field('Notiz / Ergebnis', el('input', { type: 'text', placeholder: 'z. B. Dosis angepasst',
        oninput: (e) => { draft.note = e.target.value; } })),
      field('Naechster Termin', el('input', { type: 'datetime-local',
        onchange: (e) => { draft.nextAt = e.target.value; } })),
      el('div', { class: 'form-actions' }, el('button', { class: 'btn', type: 'submit' }, 'Eintragen'))),
    table(['Datum', 'Anlass', 'Notiz', 'Naechster Termin', ''], visits.map((v) => [
      fmt.date(v.at), v.type || '-', v.note || '-', v.nextAt ? fmt.date(v.nextAt) : '-',
      el('button', { class: 'btn small danger', onclick: () => {
        if (confirmDelete()) { removeItem('doctorVisits', v.id); rerender(); }
      } }, 'loeschen'),
    ])));
}
