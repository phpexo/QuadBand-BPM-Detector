import {
  el, card, stat, fmt, field, select, tabs, stepper, table, responsiveTable,
  toLocalInput, fromLocalInput, confirmDelete, clear,
} from '../ui/dom.js';
import { lineChart, PALETTE } from '../ui/chart.js';
import { addItem, removeItem, update, uid, setSetting, toCsv, downloadFile } from '../store.js';
import { allExercises, findExercise, groupByMuscle, MUSCLES, EQUIPMENT } from '../data/exercises.js';
import {
  e1rm, effectiveWeight, setVolume, workoutVolume, workoutSetCount, setsPerMuscle,
  weeklyMuscleHistory, personalRecords, detectPr, exerciseHistory, lastPerformance,
  muscleFrequency, platePlan, MS_PER_DAY,
} from '../gym/stats.js';
import { requestNotificationPermission, notificationPermission } from '../reminders.js';

const TABS = [
  { id: 'session', label: 'Training' },
  { id: 'history', label: 'Verlauf' },
  { id: 'exercises', label: 'Uebungen' },
  { id: 'routines', label: 'Plaene' },
  { id: 'analysis', label: 'Auswertung' },
];

export function render(ctx) {
  const { state, rerender } = ctx;
  const active = state.settings.gymTab || 'session';
  const root = el('div', { class: 'view' });

  root.appendChild(tabs(
    TABS.map((t) => (t.id === 'session' && state.activeSession ? { ...t, badge: state.activeSession.sets.length } : t)),
    active,
    (id) => { setSetting('gymTab', id); rerender(); },
  ));

  const views = { session: sessionTab, history: historyTab, exercises: exercisesTab, routines: routinesTab, analysis: analysisTab };
  root.appendChild((views[active] || sessionTab)(ctx));
  return root;
}

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

const resolverFor = (state) => (id) => findExercise(id, state.customExercises || []);
const bodyweight = (state) => {
  const last = [...(state.bodyLog || [])].filter((b) => b.weightKg).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  return Number(last?.weightKg) || Number(state.settings.weightKg) || 0;
};

function exercisePicker(state, value, onchange, props = {}) {
  const sel = el('select', { ...props, onchange: (e) => onchange(e.target.value) });
  sel.appendChild(el('option', { value: '' }, '- Uebung waehlen -'));
  for (const [muscle, list] of groupByMuscle(allExercises(state.customExercises))) {
    const g = el('optgroup', { label: MUSCLES[muscle] || 'Ohne Zuordnung' });
    for (const ex of list) {
      const o = el('option', { value: ex.id }, `${ex.name} · ${EQUIPMENT[ex.equipment] || ''}`);
      if (ex.id === value) o.selected = true;
      g.appendChild(o);
    }
    sel.appendChild(g);
  }
  return sel;
}

function setSummary(set, ex, bw) {
  if (ex?.type === 'time') return `${set.seconds || 0} s`;
  if (ex?.type === 'cardio') return `${set.minutes || 0} min${set.distanceKm ? ` · ${set.distanceKm} km` : ''}`;
  if (ex?.type === 'bodyweight_reps') return `${set.reps || 0} Wdh. (KG ${fmt.num(bw, 1)} kg)`;
  const w = effectiveWeight(set, ex, bw);
  return `${fmt.num(w, 1)} kg × ${set.reps || 0}`;
}

// ---------------------------------------------------------------------------
// Aktives Training
// ---------------------------------------------------------------------------

function sessionTab(ctx) {
  const { state, rerender } = ctx;
  const host = el('div', { class: 'view' });
  const resolve = resolverFor(state);
  const bw = bodyweight(state);

  if (!state.activeSession) {
    const routines = state.routines || [];
    let routineId = '';
    host.appendChild(card('Training starten',
      el('p', { class: 'muted small' }, 'Waehrend der Einheit wird jeder Satz sofort gespeichert - auch wenn das Handy zwischendurch zugeht.'),
      el('div', { class: 'controls' },
        routines.length
          ? field('Nach Plan', select(
              [{ value: '', label: '- freies Training -' }, ...routines.map((r) => ({ value: r.id, label: r.name }))],
              '', (v) => { routineId = v; }))
          : null,
        el('div', { class: 'form-actions' },
          el('button', { class: 'btn primary', onclick: () => {
            const routine = routines.find((r) => r.id === routineId);
            update((s) => {
              s.activeSession = {
                at: new Date().toISOString(),
                name: routine?.name || '',
                routineId: routine?.id || null,
                planned: (routine?.exercises || []).map((e) => ({ ...e })),
                sets: [],
              };
            });
            rerender();
          } }, 'Training beginnen')))));

    const recent = [...(state.workouts || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 3);
    if (recent.length) {
      host.appendChild(card('Zuletzt trainiert', responsiveTable(
        ['Datum', 'Training', 'Saetze', 'Volumen'],
        recent.map((w) => [fmt.date(w.at), w.name || 'Training', String(workoutSetCount(w)),
          `${fmt.int(workoutVolume(w, resolve, bw))} kg`]))));
    }
    return host;
  }

  // ------------------------------------------------------------- laufende Einheit
  const session = state.activeSession;
  const records = personalRecords(state.workouts || [], resolve, bw);
  const started = Date.parse(session.at);
  const minutes = Math.max(0, Math.round((Date.now() - started) / 60000));

  host.appendChild(el('div', { class: 'stat-grid compact' },
    stat('Laeuft seit', `${minutes} min`, fmt.dateTime(session.at)),
    stat('Saetze', String(session.sets.filter((s) => !s.warmup).length)),
    stat('Volumen', `${fmt.int(workoutVolume(session, resolve, bw))} kg`)));

  host.appendChild(restTimerCard(ctx));

  // Geplante Uebungen aus dem Plan
  if (session.planned?.length) {
    const done = new Set(session.sets.map((s) => s.exerciseId));
    host.appendChild(card('Plan',
      el('div', { class: 'chips' }, session.planned.map((p) => {
        const ex = resolve(p.exerciseId);
        return el('span', { class: `chip static${done.has(p.exerciseId) ? ' done' : ''}` },
          `${ex?.name || p.exerciseId}${p.targetSets ? ` · ${p.targetSets}×${p.targetReps || '?'}` : ''}`);
      }))));
  }

  host.appendChild(addSetCard(ctx, records, bw));

  // Bereits erfasste Saetze, nach Uebung gruppiert
  const byExercise = new Map();
  session.sets.forEach((s, index) => {
    if (!byExercise.has(s.exerciseId)) byExercise.set(s.exerciseId, []);
    byExercise.get(s.exerciseId).push({ ...s, index });
  });
  if (byExercise.size) {
    const list = el('div', { class: 'session-list' });
    for (const [exId, sets] of byExercise) {
      const ex = resolve(exId);
      list.appendChild(el('div', { class: 'session-exercise' },
        el('h3', {}, ex?.name || exId),
        ...sets.map((s, i) => el('div', { class: `set-row${s.warmup ? ' warmup' : ''}` },
          el('span', { class: 'set-index' }, s.warmup ? 'A' : String(i + 1 - sets.slice(0, i + 1).filter((x) => x.warmup).length)),
          el('span', { class: 'set-main' }, setSummary(s, ex, bw)),
          s.rpe ? el('span', { class: 'muted' }, `RPE ${s.rpe}`) : null,
          s.pr ? el('span', { class: 'pr-badge' }, s.pr) : null,
          el('button', { class: 'btn small danger set-remove', type: 'button', 'aria-label': 'Satz entfernen', onclick: () => {
            update((st) => { st.activeSession.sets.splice(s.index, 1); });
            rerender();
          } }, '×')))));
    }
    host.appendChild(card('Erfasste Saetze', list));
  }

  host.appendChild(card('Einheit abschliessen',
    el('div', { class: 'form-grid' },
      field('Bezeichnung', el('input', { type: 'text', value: session.name || '', placeholder: 'z. B. Push A',
        oninput: (e) => update((s) => { s.activeSession.name = e.target.value; }) })),
      field('Notiz', el('input', { type: 'text', value: session.note || '', placeholder: 'optional',
        oninput: (e) => update((s) => { s.activeSession.note = e.target.value; }) }))),
    el('div', { class: 'row-actions' },
      el('button', { class: 'btn primary', onclick: () => {
        if (!session.sets.length) { alert('Es wurde noch kein Satz erfasst.'); return; }
        const finished = { ...session, endedAt: new Date().toISOString() };
        delete finished.planned;
        addItem('workouts', finished);
        update((s) => { s.activeSession = null; });
        rerender();
      } }, 'Training speichern'),
      el('button', { class: 'btn danger', onclick: () => {
        if (confirmDelete('Laufendes Training verwerfen?')) {
          update((s) => { s.activeSession = null; });
          rerender();
        }
      } }, 'Verwerfen'))));

  return host;
}

function addSetCard(ctx, records, bw) {
  const { state, rerender } = ctx;
  const resolve = resolverFor(state);
  const session = state.activeSession;
  const last = session.sets[session.sets.length - 1];
  const draft = {
    exerciseId: last?.exerciseId || session.planned?.[0]?.exerciseId || '',
    weight: last?.weight ?? null, reps: last?.reps ?? null, rpe: '', warmup: false,
    seconds: null, minutes: null, distanceKm: null,
  };

  const body = el('div', {});
  const hint = el('p', { class: 'muted small' });

  const renderInputs = () => {
    clear(body); clear(hint);
    const ex = resolve(draft.exerciseId);
    if (!ex) { hint.textContent = 'Waehle eine Uebung, um Saetze zu erfassen.'; return; }

    const prev = lastPerformance(state.workouts || [], ex.id);
    if (prev) {
      hint.appendChild(el('span', {}, `Zuletzt am ${fmt.date(prev.at)}: `));
      hint.appendChild(el('b', {}, prev.sets.map((s) => setSummary(s, ex, bw)).join('  ·  ')));
    } else {
      hint.textContent = 'Erste Einheit mit dieser Uebung.';
    }

    // Vorbelegung: was zuletzt geschafft wurde, steht schon im Feld - so muss
    // im Studio meist nur noch bestaetigt werden. Die angezeigten Werte sind
    // von Anfang an Teil des Entwurfs, nicht erst nach dem Antippen.
    const template = prev?.sets?.[prev.sets.length - 1];
    if (draft.weight == null) draft.weight = Number(template?.weight) || 0;
    if (draft.reps == null) draft.reps = Number(template?.reps) || 8;
    if (draft.seconds == null) draft.seconds = Number(template?.seconds) || 30;
    if (draft.minutes == null) draft.minutes = Number(template?.minutes) || 20;
    if (draft.distanceKm == null) draft.distanceKm = Number(template?.distanceKm) || 0;

    const grid = el('div', { class: 'form-grid dense' });
    if (ex.type === 'time') {
      grid.appendChild(field('Dauer (s)', stepper(draft.seconds, { step: 5, onchange: (v) => { draft.seconds = v; } })));
    } else if (ex.type === 'cardio') {
      grid.appendChild(field('Dauer (min)', stepper(draft.minutes, { step: 5, onchange: (v) => { draft.minutes = v; } })));
      grid.appendChild(field('Distanz (km)', stepper(draft.distanceKm, { step: 0.5, onchange: (v) => { draft.distanceKm = v; } })));
    } else {
      if (ex.type !== 'bodyweight_reps') {
        grid.appendChild(field(ex.type === 'weighted_bodyweight' ? 'Zusatzgewicht (kg)' : 'Gewicht (kg)',
          stepper(draft.weight, { step: 2.5, onchange: (v) => { draft.weight = v; renderPreview(); } })));
      }
      grid.appendChild(field('Wiederholungen', stepper(draft.reps, { step: 1, min: 1, onchange: (v) => { draft.reps = v; renderPreview(); } })));
      grid.appendChild(field('RPE (optional)', stepper(draft.rpe, { step: 0.5, min: 1, max: 10, onchange: (v) => { draft.rpe = v; } })));
    }
    grid.appendChild(el('label', { class: 'chip' },
      el('input', { type: 'checkbox', onchange: (e) => { draft.warmup = e.target.checked; } }),
      el('span', {}, 'Aufwaermsatz')));
    body.appendChild(grid);

    const preview = el('p', { class: 'muted small' });
    body.appendChild(preview);
    function renderPreview() {
      if (ex.type === 'time' || ex.type === 'cardio' || !draft.reps) { preview.textContent = ''; return; }
      const w = effectiveWeight({ weight: draft.weight }, ex, bw);
      const est = e1rm(w, draft.reps, state.settings.e1rmFormula);
      const pr = detectPr({ weight: draft.weight, reps: draft.reps }, ex, records, bw);
      preview.textContent = `Geschaetztes 1RM: ${fmt.num(est, 1)} kg${pr ? ` · waere ein neuer Bestwert (${pr})` : ''}`;
    }
    renderPreview();

    if (ex.equipment === 'barbell' && ex.type === 'weight_reps' && Number(draft.weight) > 0) {
      const plan = platePlan(Number(draft.weight), state.settings.barKg, state.settings.plates);
      if (plan.perSide.length) {
        body.appendChild(el('p', { class: 'muted small' },
          `Je Seite auflegen: ${plan.perSide.join(' + ')} kg${Math.abs(plan.rest) > 0.01 ? ` (erreichbar: ${plan.achievable} kg)` : ''}`));
      }
    }
  };

  const commit = () => {
    const ex = resolve(draft.exerciseId);
    if (!ex) return;
    const set = { exerciseId: ex.id, warmup: draft.warmup };
    if (ex.type === 'time') set.seconds = Number(draft.seconds) || 0;
    else if (ex.type === 'cardio') { set.minutes = Number(draft.minutes) || 0; set.distanceKm = Number(draft.distanceKm) || 0; }
    else {
      set.weight = Number(draft.weight) || 0;
      set.reps = Number(draft.reps) || 0;
      if (draft.rpe) set.rpe = Number(draft.rpe);
      if (!set.reps) { alert('Bitte Wiederholungen eintragen.'); return; }
      if (!set.warmup) {
        const pr = detectPr(set, ex, records, bw);
        if (pr) set.pr = pr;
      }
    }
    update((s) => { s.activeSession.sets.push(set); });
    startRest(ctx);
    rerender();
  };

  renderInputs();
  return card('Satz erfassen',
    field('Uebung', exercisePicker(state, draft.exerciseId, (v) => {
      draft.exerciseId = v;
      draft.weight = null; draft.reps = null; draft.seconds = null; draft.minutes = null; draft.distanceKm = null;
      renderInputs();
    })),
    hint, body,
    el('div', { class: 'row-actions' },
      el('button', { class: 'btn primary wide', type: 'button', onclick: commit }, 'Satz speichern')));
}

// ---------------------------------------------------------------------------
// Pausen-Timer
// ---------------------------------------------------------------------------

let restTimer = null;

function startRest(ctx) {
  const seconds = Number(ctx.state.settings.restSeconds) || 0;
  if (!seconds) return;
  clearInterval(restTimer?.handle);
  restTimer = { endsAt: Date.now() + seconds * 1000, handle: null };
  restTimer.handle = setInterval(() => {
    const el2 = document.getElementById('rest-remaining');
    const left = Math.max(0, Math.round((restTimer.endsAt - Date.now()) / 1000));
    if (el2) el2.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (left <= 0) {
      clearInterval(restTimer.handle);
      restTimer = null;
      beep();
      if (notificationPermission() === 'granted') {
        navigator.serviceWorker?.getRegistration()
          .then((reg) => reg?.showNotification('Pause vorbei', { body: 'Naechster Satz.', tag: 'rest', silent: false }))
          .catch(() => {});
      }
      if (el2) el2.textContent = 'fertig';
    }
  }, 250);
}

function beep() {
  try {
    const ctxA = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctxA.createOscillator();
    const gain = ctxA.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, ctxA.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctxA.currentTime + 0.4);
    osc.connect(gain).connect(ctxA.destination);
    osc.start(); osc.stop(ctxA.currentTime + 0.4);
  } catch { /* Ton ist optional */ }
}

function restTimerCard(ctx) {
  const { state, rerender } = ctx;
  const left = restTimer ? Math.max(0, Math.round((restTimer.endsAt - Date.now()) / 1000)) : 0;
  return card('Satzpause',
    el('div', { class: 'rest-row' },
      el('span', { class: 'rest-time', id: 'rest-remaining' },
        restTimer ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '–:––'),
      field('Pausenlaenge (s)', stepper(state.settings.restSeconds, {
        step: 15, min: 0, max: 600, onchange: (v) => setSetting('restSeconds', Number(v) || 0),
      })),
      el('button', { class: 'btn', type: 'button', onclick: () => { startRest(ctx); rerender(); } }, 'Starten'),
      el('button', { class: 'btn', type: 'button', onclick: () => {
        clearInterval(restTimer?.handle); restTimer = null; rerender();
      } }, 'Stopp')),
    notificationPermission() === 'default'
      ? el('button', { class: 'btn small', onclick: () => requestNotificationPermission().then(rerender) },
          'Benachrichtigung fuer das Pausenende erlauben')
      : null);
}

// ---------------------------------------------------------------------------
// Verlauf
// ---------------------------------------------------------------------------

function historyTab(ctx) {
  const { state, rerender } = ctx;
  const resolve = resolverFor(state);
  const bw = bodyweight(state);
  const host = el('div', { class: 'view' });
  const workouts = [...(state.workouts || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  if (!workouts.length) {
    host.appendChild(card('Noch keine Einheit erfasst',
      el('p', {}, 'Starte im Reiter "Training" deine erste Einheit.')));
    return host;
  }

  for (const w of workouts.slice(0, 40)) {
    const byExercise = new Map();
    for (const s of w.sets || []) {
      if (!byExercise.has(s.exerciseId)) byExercise.set(s.exerciseId, []);
      byExercise.get(s.exerciseId).push(s);
    }
    host.appendChild(card(null,
      el('div', { class: 'panel-head' },
        el('h2', {}, w.name || 'Training'),
        el('span', { class: 'muted' }, fmt.dateTime(w.at)),
        el('span', { class: 'badge' }, `${workoutSetCount(w)} Saetze · ${fmt.int(workoutVolume(w, resolve, bw))} kg`),
        el('button', { class: 'btn small danger', onclick: () => {
          if (confirmDelete('Training loeschen?')) { removeItem('workouts', w.id); rerender(); }
        } }, 'loeschen')),
      ...[...byExercise.entries()].map(([exId, sets]) => {
        const ex = resolve(exId);
        return el('div', { class: 'history-exercise' },
          el('strong', {}, ex?.name || exId),
          el('span', { class: 'muted' }, sets.map((s) => setSummary(s, ex, bw) + (s.pr ? ' ★' : '')).join('  ·  ')));
      }),
      w.note ? el('p', { class: 'muted' }, w.note) : null));
  }

  host.appendChild(el('div', { class: 'row-actions' },
    el('button', { class: 'btn', onclick: () => exportCsv(state, resolve, bw) }, 'Trainingsdaten als CSV exportieren')));
  return host;
}

// ---------------------------------------------------------------------------
// Uebungen
// ---------------------------------------------------------------------------

function exercisesTab(ctx) {
  const { state, rerender } = ctx;
  const resolve = resolverFor(state);
  const bw = bodyweight(state);
  const host = el('div', { class: 'view' });
  const list = allExercises(state.customExercises);

  // Detailansicht einer Uebung
  let selected = state.settings.gymExercise || '';
  const detail = el('div', {});
  const renderDetail = () => {
    clear(detail);
    const ex = resolve(selected);
    if (!ex) return;
    const hist = exerciseHistory(state.workouts || [], ex.id, resolve, bw);
    const records = personalRecords(state.workouts || [], resolve, bw).get(ex.id);
    detail.appendChild(el('div', { class: 'cmp-rows' },
      line('Geraet', EQUIPMENT[ex.equipment] || ex.equipment),
      line('Primaer', (ex.primary || []).map((m) => MUSCLES[m]).join(', ') || 'nicht zugeordnet'),
      line('Sekundaer', (ex.secondary || []).map((m) => MUSCLES[m]).join(', ') || '-'),
      records?.bestE1rm ? line('Bestes geschaetztes 1RM', `${fmt.num(records.bestE1rm.value, 1)} kg (${fmt.num(records.bestE1rm.weight, 1)} × ${records.bestE1rm.reps}, ${fmt.date(records.bestE1rm.at)})`) : null,
      records?.bestWeight ? line('Hoechstes Gewicht', `${fmt.num(records.bestWeight.value, 1)} kg × ${records.bestWeight.reps} (${fmt.date(records.bestWeight.at)})`) : null,
      records?.bestVolume ? line('Bestes Satzvolumen', `${fmt.int(records.bestVolume.value)} kg (${fmt.date(records.bestVolume.at)})`) : null,
      line('Einheiten erfasst', String(hist.length))));

    if (hist.length >= 2) {
      const asc = [...hist].reverse();
      const t0 = Date.parse(asc[0].at);
      const pts = asc.filter((h) => h.topE1rm > 0).map((h) => [(Date.parse(h.at) - t0) / MS_PER_DAY, h.topE1rm]);
      if (pts.length >= 2) {
        detail.appendChild(lineChart({
          series: [{ label: 'bestes e1RM je Einheit', color: PALETTE[3], points: pts, dots: pts }],
          height: 220,
          yMin: Math.min(...pts.map((p) => p[1])) * 0.92,
          yMax: Math.max(...pts.map((p) => p[1])) * 1.08,
          formatX: (v) => fmt.date(new Date(t0 + v * MS_PER_DAY).toISOString()),
          formatY: (v) => `${fmt.int(v)} kg`,
        }));
      }
    }
    if (hist.length) {
      detail.appendChild(responsiveTable(['Datum', 'Saetze', 'Bestes e1RM', 'Volumen'],
        hist.slice(0, 15).map((h) => [
          fmt.date(h.at),
          h.sets.map((s) => setSummary(s, ex, bw)).join(' · '),
          h.topE1rm ? `${fmt.num(h.topE1rm, 1)} kg` : '-',
          `${fmt.int(h.volume)} kg`,
        ])));
    }
  };

  host.appendChild(card('Uebung ansehen',
    field('Uebung', exercisePicker(state, selected, (v) => { selected = v; setSetting('gymExercise', v); renderDetail(); })),
    detail));
  renderDetail();

  host.appendChild(customExerciseCard(ctx));

  host.appendChild(card(`Uebungsverzeichnis (${list.length})`,
    responsiveTable(['Uebung', 'Geraet', 'Primaer', 'Sekundaer', 'Erfassung'],
      list.map((ex) => [
        ex.name, EQUIPMENT[ex.equipment] || ex.equipment,
        (ex.primary || []).map((m) => MUSCLES[m]).join(', ') || '-',
        (ex.secondary || []).map((m) => MUSCLES[m]).join(', ') || '-',
        { weight_reps: 'Gewicht × Wdh.', bodyweight_reps: 'Koerpergewicht', weighted_bodyweight: 'Zusatzgewicht', time: 'Dauer', cardio: 'Ausdauer' }[ex.type] || ex.type,
      ]))));
  return host;
}

function line(label, value) {
  return value == null ? null : el('div', { class: 'cmp-row' }, el('span', {}, label), el('b', {}, value));
}

function customExerciseCard(ctx) {
  const { state, rerender } = ctx;
  const draft = { name: '', equipment: 'other', type: 'weight_reps', primary: [], secondary: [] };
  const muscleChips = (key) => el('div', { class: 'chips' }, Object.entries(MUSCLES).map(([id, label]) =>
    el('label', { class: 'chip' },
      el('input', { type: 'checkbox', onchange: (e) => {
        if (e.target.checked) draft[key].push(id);
        else draft[key] = draft[key].filter((m) => m !== id);
      } }), el('span', {}, label))));

  return card('Eigene Uebung anlegen',
    el('p', { class: 'muted small' }, 'Alles, was im Verzeichnis fehlt - Maschinen aus deinem Studio, Varianten, Reha-Uebungen. Eigene Uebungen zaehlen in Auswertung und Rekorden gleichwertig mit.'),
    el('form', { onsubmit: (e) => {
      e.preventDefault();
      if (!draft.name) return;
      update((s) => s.customExercises.push({
        id: `custom-ex-${uid()}`, name: draft.name, equipment: draft.equipment, type: draft.type,
        primary: [...draft.primary], secondary: [...draft.secondary], custom: true,
      }));
      rerender();
    } },
      el('div', { class: 'form-grid' },
        field('Name', el('input', { type: 'text', required: true, oninput: (e) => { draft.name = e.target.value; } })),
        field('Geraet', select(Object.entries(EQUIPMENT).map(([value, label]) => ({ value, label })), draft.equipment, (v) => { draft.equipment = v; })),
        field('Erfassung', select([
          { value: 'weight_reps', label: 'Gewicht × Wiederholungen' },
          { value: 'bodyweight_reps', label: 'nur Wiederholungen' },
          { value: 'weighted_bodyweight', label: 'Zusatzgewicht × Wiederholungen' },
          { value: 'time', label: 'Dauer in Sekunden' },
          { value: 'cardio', label: 'Ausdauer' },
        ], draft.type, (v) => { draft.type = v; }))),
      el('details', { class: 'lab-group' }, el('summary', {}, 'Primaer belastete Muskeln'), muscleChips('primary')),
      el('details', { class: 'lab-group' }, el('summary', {}, 'Sekundaer beteiligt'), muscleChips('secondary')),
      el('div', { class: 'form-actions' }, el('button', { class: 'btn', type: 'submit' }, 'Uebung anlegen'))),
    (state.customExercises || []).length
      ? responsiveTable(['Name', 'Geraet', 'Primaer', ''], state.customExercises.map((ex) => [
          ex.name, EQUIPMENT[ex.equipment] || ex.equipment,
          (ex.primary || []).map((m) => MUSCLES[m]).join(', ') || '-',
          el('button', { class: 'btn small danger', onclick: () => {
            if (confirmDelete('Uebung entfernen? Bereits erfasste Saetze bleiben erhalten.')) {
              update((s) => { s.customExercises = s.customExercises.filter((x) => x.id !== ex.id); });
              rerender();
            }
          } }, 'loeschen'),
        ]))
      : null);
}

// ---------------------------------------------------------------------------
// Plaene
// ---------------------------------------------------------------------------

function routinesTab(ctx) {
  const { state, rerender } = ctx;
  const resolve = resolverFor(state);
  const host = el('div', { class: 'view' });
  const draft = { name: '', exercises: [] };
  const listHost = el('div', { class: 'session-list' });

  const renderDraft = () => {
    clear(listHost);
    if (!draft.exercises.length) { listHost.appendChild(el('p', { class: 'muted small' }, 'Noch keine Uebung im Plan.')); return; }
    draft.exercises.forEach((e, i) => {
      const ex = resolve(e.exerciseId);
      listHost.appendChild(el('div', { class: 'set-row' },
        el('span', {}, `${i + 1}. ${ex?.name || e.exerciseId}`),
        el('span', { class: 'muted' }, `${e.targetSets || '?'} × ${e.targetReps || '?'}`),
        el('button', { class: 'btn small danger', type: 'button', onclick: () => { draft.exercises.splice(i, 1); renderDraft(); } }, '×')));
    });
  };
  renderDraft();

  const add = { exerciseId: '', targetSets: 3, targetReps: 8 };
  host.appendChild(card('Trainingsplan anlegen',
    el('p', { class: 'muted small' }, 'Ein Plan ist nur eine Vorlage: Er legt fest, welche Uebungen in welcher Reihenfolge anstehen. Was du tatsaechlich schaffst, traegst du im Training ein.'),
    el('div', { class: 'form-grid' },
      field('Name des Plans', el('input', { type: 'text', placeholder: 'z. B. Push A', oninput: (e) => { draft.name = e.target.value; } }))),
    el('div', { class: 'form-grid dense' },
      field('Uebung', exercisePicker(state, '', (v) => { add.exerciseId = v; })),
      field('Saetze', stepper(3, { step: 1, min: 1, onchange: (v) => { add.targetSets = v; } })),
      field('Wiederholungen', stepper(8, { step: 1, min: 1, onchange: (v) => { add.targetReps = v; } })),
      el('div', { class: 'form-actions' },
        el('button', { class: 'btn', type: 'button', onclick: () => {
          if (!add.exerciseId) return;
          draft.exercises.push({ ...add });
          renderDraft();
        } }, 'Zum Plan hinzufuegen'))),
    listHost,
    el('div', { class: 'row-actions' },
      el('button', { class: 'btn primary', onclick: () => {
        if (!draft.name || !draft.exercises.length) { alert('Name und mindestens eine Uebung noetig.'); return; }
        update((s) => s.routines.push({ id: uid(), name: draft.name, exercises: [...draft.exercises] }));
        rerender();
      } }, 'Plan speichern'))));

  for (const r of state.routines || []) {
    host.appendChild(card(null,
      el('div', { class: 'panel-head' },
        el('h2', {}, r.name),
        el('span', { class: 'badge' }, `${r.exercises.length} Uebungen`),
        el('button', { class: 'btn small', onclick: () => {
          update((s) => {
            s.activeSession = { at: new Date().toISOString(), name: r.name, routineId: r.id, planned: r.exercises.map((e) => ({ ...e })), sets: [] };
            s.settings.gymTab = 'session';
          });
          rerender();
        } }, 'Training danach starten'),
        el('button', { class: 'btn small danger', onclick: () => {
          if (confirmDelete('Plan loeschen?')) {
            update((s) => { s.routines = s.routines.filter((x) => x.id !== r.id); });
            rerender();
          }
        } }, 'loeschen')),
      responsiveTable(['#', 'Uebung', 'Vorgabe'], r.exercises.map((e, i) => {
        const ex = resolve(e.exerciseId);
        return [String(i + 1), ex?.name || e.exerciseId, `${e.targetSets || '?'} × ${e.targetReps || '?'}`];
      }))));
  }
  return host;
}

// ---------------------------------------------------------------------------
// Auswertung
// ---------------------------------------------------------------------------

function analysisTab(ctx) {
  const { state, now } = ctx;
  const resolve = resolverFor(state);
  const bw = bodyweight(state);
  const workouts = state.workouts || [];
  const host = el('div', { class: 'view' });

  if (!workouts.length) {
    host.appendChild(card('Noch keine Daten', el('p', {}, 'Nach der ersten Einheit erscheinen hier Wochenvolumen, Saetze je Muskelgruppe und deine Rekorde.')));
    return host;
  }

  // ------------------------------------------------------------- Saetze je Muskel
  const week = setsPerMuscle(workouts, resolve, { from: now - 7 * MS_PER_DAY, to: now });
  const freq = muscleFrequency(workouts, resolve, 28, now);
  const rows = Object.entries(week)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([m, v]) => [
      MUSCLES[m],
      el('div', { class: 'bar-cell' },
        el('div', { class: 'bar', style: { width: `${Math.min(100, (v / 22) * 100)}%` } }),
        el('span', {}, fmt.num(v, 1))),
      `${fmt.num(freq[m] || 0, 1)} ×/Woche`,
    ]);
  // Kurze Werte - hier bleibt die Tabellenform auch auf dem Handy lesbarer als Karten
  host.appendChild(card('Saetze je Muskelgruppe (letzte 7 Tage)',
    table(['Muskel', 'Saetze', 'Frequenz'], rows),
    el('p', { class: 'muted small' },
      'Sekundaer beteiligte Muskeln zaehlen zur Haelfte. In der Trainingsplanung gelten grob 10-20 harte Saetze pro Muskelgruppe und Woche als sinnvoller Bereich - die Balken sind darauf skaliert. Entscheidend bleibt, wie du dich erholst.')));

  // ------------------------------------------------------------- Wochenverlauf
  const history = weeklyMuscleHistory(workouts, resolve, 8, now);
  const totals = history.map((h, i) => [i - (history.length - 1), Object.values(h.counts).reduce((a, b) => a + b, 0)]);
  const volumes = [];
  for (let i = 7; i >= 0; i--) {
    const to = now - i * 7 * MS_PER_DAY, from = to - 7 * MS_PER_DAY;
    const v = workouts.filter((w) => Date.parse(w.at) > from && Date.parse(w.at) <= to)
      .reduce((s, w) => s + workoutVolume(w, resolve, bw), 0);
    volumes.push([-i, v]);
  }
  host.appendChild(card('Wochenverlauf',
    el('h3', {}, 'Saetze gesamt'),
    lineChart({ series: [{ label: 'Saetze', color: PALETTE[0], points: totals, dots: totals, area: true }],
      height: 200, formatX: (v) => (Math.round(v) === 0 ? 'diese Woche' : `${Math.round(v)}`), formatY: (v) => fmt.int(v) }),
    el('h3', {}, 'Volumen'),
    lineChart({ series: [{ label: 'Volumen (kg)', color: PALETTE[2], points: volumes, dots: volumes, area: true }],
      height: 200, formatX: (v) => (Math.round(v) === 0 ? 'diese Woche' : `${Math.round(v)}`), formatY: (v) => fmt.int(v) }),
    el('p', { class: 'muted small' },
      'Sprunghafte Steigerungen des Volumens sind ein haeufiger Grund fuer Ueberlastung und Verletzungen.')));

  // ------------------------------------------------------------- Rekorde
  const records = [...personalRecords(workouts, resolve, bw).values()]
    .filter((r) => r.bestE1rm)
    .sort((a, b) => b.bestE1rm.value - a.bestE1rm.value);
  host.appendChild(card('Bestleistungen',
    responsiveTable(['Uebung', 'Bestes e1RM', 'Hoechstes Gewicht', 'Meiste Wdh.', 'Bestes Volumen'],
      records.map((r) => {
        const ex = resolve(r.exerciseId);
        return [
          ex?.name || r.exerciseId,
          `${fmt.num(r.bestE1rm.value, 1)} kg`,
          r.bestWeight ? `${fmt.num(r.bestWeight.value, 1)} kg × ${r.bestWeight.reps}` : '-',
          r.bestReps ? `${r.bestReps.value} @ ${fmt.num(r.bestReps.weight, 1)} kg` : '-',
          r.bestVolume ? `${fmt.int(r.bestVolume.value)} kg` : '-',
        ];
      }))));
  return host;
}

function exportCsv(state, resolve, bw) {
  const rows = (state.workouts || []).flatMap((w) => (w.sets || []).map((s) => ({ ...s, at: w.at, workout: w.name })));
  const columns = [
    { label: 'Datum', get: (r) => new Date(r.at).toISOString() },
    { label: 'Training', get: (r) => r.workout || '' },
    { label: 'Uebung', get: (r) => resolve(r.exerciseId)?.name || r.exerciseId },
    { label: 'Aufwaermsatz', get: (r) => (r.warmup ? 'ja' : 'nein') },
    { label: 'Gewicht kg', get: (r) => r.weight ?? '' },
    { label: 'Wiederholungen', get: (r) => r.reps ?? '' },
    { label: 'RPE', get: (r) => r.rpe ?? '' },
    { label: 'Dauer s', get: (r) => r.seconds ?? '' },
    { label: 'Cardio min', get: (r) => r.minutes ?? '' },
    { label: 'e1RM kg', get: (r) => {
      const ex = resolve(r.exerciseId);
      const v = e1rm(effectiveWeight(r, ex, bw), r.reps);
      return v ? v.toFixed(1) : '';
    } },
  ];
  downloadFile(`training-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, columns), 'text/csv');
}
