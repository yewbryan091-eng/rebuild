/* The workout calendar has its own record so regenerating coach notes cannot move it. */
function adaptiveWeekFor(mon) {
  const plan = S.adaptiveWeeks[mon];
  return plan?.version === 1 && typeof plan.start === 'string' && Array.isArray(plan.sessions) ? plan : null;
}

function adaptivePlanFor(date) {
  const plan = adaptiveWeekFor(mondayOf(date));
  if (!plan || date < plan.start) return null;
  const entry = plan.sessions.find(session => session?.date === date);
  return entry && adaptiveTemplateExists(entry.plan) ? entry.plan : 'rest';
}

function adaptiveTemplateExists(id) {
  return typeof id === 'string' && (ROT.includes(id) || (id.startsWith('c_') && !!S.customs[id.slice(2)]));
}

const adaptiveDates = mon => Array.from({length:7}, (_, i) => addDays(mon, i));
const adaptiveDayLabel = date => `${DOW[dowOf(date)].slice(0, 3)} ${nice(date)}`;

function adaptiveFixed(date) {
  const day = getDay(date);
  return !!(day.plan || day.started || day.finished || day.cardio?.done ||
    Object.values(day.warm || {}).some(Boolean) || Object.values(day.sets || {}).some(sets => sets.some(set => set?.d)));
}

function adaptiveFixedPlan(date) {
  const day = getDay(date);
  return day.plan || (day.lineup?.length ? 'custom' : setsDone(day) ? SCHED[dowOf(date)] : adaptivePlanFor(date) || 'rest');
}

function adaptiveTarget(mon) {
  const saved = adaptiveWeekFor(mon);
  if (!saved) return null;
  return adaptiveDates(mon).filter(date => {
    const day = getDay(date);
    if (date < saved.start) return setsDone(day) > 0 || (day.finished && adaptiveFixedPlan(date) !== 'rest');
    if (adaptiveFixed(date)) return adaptiveFixedPlan(date) !== 'rest';
    return adaptivePlanFor(date) !== 'rest';
  }).length;
}

function adaptiveCandidates(mon, today = todayKey()) {
  return adaptiveDates(mon).filter(date => date >= today && !adaptiveFixed(date));
}

function adaptiveLoggedGroups(day) {
  const counts = {};
  for (const id of Object.keys(day.sets || {})) {
    const group = EX[id]?.g;
    const work = group ? doneSets(day, id).length : 0;
    if (work) counts[group] = (counts[group] || 0) + work;
  }
  return counts;
}

function adaptiveTemplateGroups(lineup) {
  const counts = {};
  for (const slot of lineup) {
    const group = EX[slot.ex]?.g;
    const sets = num(slot.sets);
    if (group && sets > 0 && !slot.skip) counts[group] = (counts[group] || 0) + sets;
  }
  return counts;
}

// Select among the days the user picked. Adjacent lifting days are allowed
// when availability requires them, but spread training out when possible.
function adaptiveChooseDates(available, count, fixed, start) {
  let best = [], bestScore = -Infinity;
  const search = (from, selected) => {
    if (selected.length === count) {
      const days = fixed.concat(selected).sort();
      let score = 0;
      for (let i = 1; i < days.length; i++) {
        const gap = daysBetween(days[i - 1], days[i]);
        score += gap === 1 ? -7 : Math.min(gap, 3);
      }
      // Tie-break toward using earlier dates, leaving later dates free for changes.
      score -= selected.reduce((sum, date) => sum + daysBetween(start, date), 0) * 0.05;
      if (score > bestScore) { best = selected; bestScore = score; }
      return;
    }
    for (let i = from; i <= available.length - (count - selected.length); i++) {
      search(i + 1, selected.concat(available[i]));
    }
  };
  search(0, []);
  return best;
}

function adaptiveDraftPlan(mon, available, count, today = todayKey()) {
  const start = mon > today ? mon : today;
  const days = adaptiveDates(mon);
  const end = days[6];
  const eligible = new Set(adaptiveCandidates(mon, today));
  const selected = [...new Set(available)].filter(date => eligible.has(date)).sort();
  const wanted = Math.max(0, Math.min(selected.length, Math.floor(Number(count) || 0)));
  const fixed = days.filter(date => date >= start && adaptiveFixed(date) && adaptiveFixedPlan(date) !== 'rest');
  const load = new Map();
  const familiar = new Map();
  const historyStart = addDays(start, -28);
  for (const [date, day] of Object.entries(S.days)) {
    if (date < historyStart || date > today || date > end) continue;
    const groups = adaptiveLoggedGroups(day);
    if (!Object.keys(groups).length) continue;
    load.set(date, groups);
    if (day.plan) familiar.set(day.plan, (familiar.get(day.plan) || 0) + 1);
  }
  for (const date of fixed) {
    if (load.has(date) || getDay(date).finished) continue;
    load.set(date, adaptiveTemplateGroups(getDay(date).lineup || tplOf(adaptiveFixedPlan(date))));
  }
  const custom = Object.keys(S.customs).map(id => 'c_' + id)
    .filter(id => familiar.has(id)).sort((a,b) => familiar.get(b) - familiar.get(a) || a.localeCompare(b)).slice(0, 3);
  const templates = ROT.concat(custom).map(id => ({id, groups:adaptiveTemplateGroups(tplOf(id))}))
    .filter(template => Object.keys(template.groups).length);
  const protectedDates = [...new Set(fixed.concat([...load.keys()].filter(date => date >= addDays(start, -2) && date < start)))];
  const dates = adaptiveChooseDates(selected, wanted, protectedDates, start);
  const priority = new Set(prioOf());
  const used = new Set(fixed.map(adaptiveFixedPlan));
  const sessions = [];
  for (const date of dates) {
    const previousWeek = {}, adjacent = {};
    const since = addDays(date, -6);
    const previousDay = addDays(date, -1), nextDay = addDays(date, 1);
    for (const [other, groups] of load) {
      for (const [group, sets] of Object.entries(groups)) {
        if (other >= since && other < date) previousWeek[group] = (previousWeek[group] || 0) + sets;
        if (other === previousDay || other === nextDay) adjacent[group] = (adjacent[group] || 0) + sets;
      }
    }
    let best;
    for (const template of templates) {
      const reasons = [];
      let score = Math.min(4, familiar.get(template.id) || 0) * 0.25 - (used.has(template.id) ? 2 : 0);
      for (const [group, sets] of Object.entries(template.groups)) {
        // These are planning weights for coverage, not prescriptions for weekly set volume.
        const recent = previousWeek[group] || 0;
        const goal = priority.has(group) ? 6 : 4;
        const benefit = Math.min(sets, 4, Math.max(0, goal - recent)) * (priority.has(group) ? 1.6 : 1);
        const overlap = adjacent[group] ? Math.min(sets, 4) * 2.4 : 0;
        score += benefit - overlap;
        if (benefit > 0 && !overlap) reasons.push({group, benefit, priority:priority.has(group)});
      }
      if (!best || score > best.score) best = {template, reasons, score};
    }
    if (!best) break;
    const {template, reasons} = best;
    const top = reasons.sort((a,b) => b.benefit - a.benefit).slice(0, 2);
    const focus = top.filter(item => item.priority);
    const note = focus.length
      ? `Prioritises ${focus.map(item => GROUPS[item.group].toLowerCase()).join(' and ')}`
      : top.length ? `Adds work for ${top.map(item => GROUPS[item.group].toLowerCase()).join(' and ')}`
      : 'Fits your available days';
    sessions.push({date, plan:template.id, note});
    load.set(date, template.groups);
    used.add(template.id);
  }
  return {version:1, start, available:selected, count:wanted, sessions, fixed};
}

function adaptiveDefaultCount(mon, available, today) {
  const logged = Object.keys(S.days).filter(date => date >= addDays(today, -14) && date < today &&
    setsDone(S.days[date]) > 0).length;
  const fixed = adaptiveDates(mon).filter(date => adaptiveFixed(date) && adaptiveFixedPlan(date) !== 'rest' &&
    (date >= today || setsDone(getDay(date)) > 0)).length;
  return Math.min(available.length, Math.max(0, (Math.round(logged / 2) || 3) - fixed));
}

function adaptiveScheduleRows(sessions, buttons = false) {
  return sessions.map(({date, plan, note}) => {
    const contents = `<span class="aw-date">${esc(adaptiveDayLabel(date))}</span><span><b>${esc(planLabel(plan, date))}</b><small>${esc(note)}</small></span>`;
    return buttons ? `<button class="aw-row" data-act="goto" data-k="${esc(date)}">${contents}<span aria-hidden="true">›</span></button>`
      : `<div class="aw-row">${contents}</div>`;
  }).join('');
}

function adaptiveWeekCard(mon) {
  const today = todayKey();
  const next = addDays(mondayOf(today), 7);
  if (mon < mondayOf(today) || mon > next) return '';
  const plan = adaptiveWeekFor(mon);
  const sessions = (plan?.sessions || []).filter(item => item?.date >= today &&
    !adaptiveFixed(item.date) && adaptiveTemplateExists(item.plan));
  return `<section class="card aw-card"><div class="row between">
    <h2>Adaptive week</h2><button class="btn sm" data-act="awopen" data-mon="${mon}">${plan ? 'Edit schedule' : 'Set availability'}</button></div>
    ${sessions.length ? adaptiveScheduleRows(sessions, true)
      : plan ? '<div class="small muted">No additional sessions planned. See your week below.</div>'
      : '<div class="small muted">Pick the days you can train. Rebuild uses your recent sessions and muscle priorities to suggest what fits.</div>'}
    ${plan ? '<div class="small muted">Workouts you’ve started or set manually stay in place.</div>' : ''}
  </section>`;
}

function adaptiveOpen(mon) {
  const today = todayKey();
  if (mon !== mondayOf(today) && mon !== addDays(mondayOf(today), 7)) return;
  const saved = adaptiveWeekFor(mon);
  const dates = adaptiveCandidates(mon, today);
  const available = saved ? dates.filter(date => saved.available?.includes(date)) : dates;
  // Slots completed or manually pinned since applying the plan now count as fixed.
  const plannedRemaining = saved?.sessions.filter(session => available.includes(session?.date)).length;
  const count = saved ? Math.min(available.length, plannedRemaining) : adaptiveDefaultCount(mon, available, today);
  S.awDraft = {mon, available, count, wanted:count, preview:null};
  adaptiveSheet();
  document.querySelector('#layer .aw-sheet h2')?.focus({preventScroll:true});
}

function adaptiveSheet(focus = '', notice = '') {
  const draft = S.awDraft;
  if (!draft) return;
  const {mon, available, count, preview} = draft;
  const today = todayKey();
  const eligible = new Set(adaptiveCandidates(mon, today));
  const upcoming = adaptiveDates(mon).filter(date => date >= today);
  const locked = upcoming.filter(date => !eligible.has(date));
  const protectedRows = locked.map(date => ({date, plan:adaptiveFixedPlan(date),
    note:setsDone(getDay(date)) ? 'Already logged' : 'Already set'}));
  const choiceRows = upcoming.map(date => {
    const on = available.includes(date);
    const fixed = !eligible.has(date);
    return `<button type="button" class="aw-day${on ? ' on' : ''}" data-act="awday" data-k="${date}"
      aria-label="${esc(DOW[dowOf(date)] + ' ' + nice(date) + (fixed ? ', already set' : ''))}"
      aria-pressed="${on}"${fixed ? ' disabled' : ''}><b>${DOW[dowOf(date)].slice(0, 3)}</b>
      <span>${esc(nice(date))}</span></button>`;
  }).join('');
  const priorities = prioOf().filter(group => GROUPS[group]).map(group => GROUPS[group].toLowerCase());
  const priorityText = priorities.length ? ` Your priorities are ${priorities.join(', ')}.` : '';
  document.getElementById('layer').innerHTML = `<div class="scrim" data-act="close"><div class="sheet aw-sheet" role="dialog" aria-modal="true" aria-label="Adapt your week">
    <div class="grab"></div>
    <div class="row between"><h2 class="sheet-h" tabindex="-1">Adapt your week</h2><button class="iconbtn" data-act="closebtn" aria-label="Close">✕</button></div>
    <p class="small muted aw-intro">${eligible.size
      ? `Choose the days that work for you and how many sessions to schedule.${esc(priorityText)}`
      : 'The remaining days already have a workout or activity logged.'}</p>
    <div class="aw-days" aria-label="Available training days">${choiceRows}</div>
    <div class="aw-count"><div><b>Sessions to schedule</b><small>${available.length} available day${available.length === 1 ? '' : 's'}</small></div>
      <button class="iconbtn" data-act="awcount" data-n="-1" aria-label="Fewer sessions"${count <= 0 ? ' disabled' : ''}>−</button>
      <b class="num" aria-live="polite">${count}</b>
      <button class="iconbtn" data-act="awcount" data-n="1" aria-label="More sessions"${count >= available.length ? ' disabled' : ''}>+</button>
    </div>
    ${protectedRows.length ? `<div class="aw-review"><h3>Stays in place</h3>${adaptiveScheduleRows(protectedRows)}</div>` : ''}
    ${notice ? `<div class="small muted" role="status">${esc(notice)}</div>` : ''}
    ${preview ? `<div class="aw-review" aria-live="polite"><h3>Proposed schedule</h3>
      ${preview.sessions.length ? adaptiveScheduleRows(preview.sessions) : `<div class="small muted">${eligible.size ? 'Keep unbooked days open for rest.' : 'All existing days stay in place.'}</div>`}
      </div><button class="btn pri" data-act="awapply">Use this schedule</button>`
      : eligible.size ? '<button class="btn pri" data-act="awpreview">Preview schedule</button>' : ''}
    ${adaptiveWeekFor(mon) ? '<button class="btn ghost" data-act="awreset">Use usual schedule</button>' : ''}
  </div></div>`;
  if (focus) {
    const target = document.querySelector('#layer ' + focus);
    if (target && !target.disabled) target.focus({preventScroll:true});
    else document.querySelector('#layer [data-act="awpreview"]')?.focus({preventScroll:true});
  }
}

function adaptiveUpdateDate(date) {
  const draft = S.awDraft;
  if (!draft || !adaptiveCandidates(draft.mon).includes(date)) return;
  const available = draft.available.includes(date) ? draft.available.filter(day => day !== date) : draft.available.concat(date).sort();
  draft.count = Math.min(draft.wanted, available.length);
  draft.available = available;
  draft.preview = null;
  adaptiveSheet(`[data-act="awday"][data-k="${date}"]`);
}

function adaptiveUpdateCount(step) {
  const draft = S.awDraft;
  if (!draft || ![-1,1].includes(step)) return;
  draft.count = Math.max(0, Math.min(draft.available.length, draft.count + step));
  draft.wanted = draft.count;
  draft.preview = null;
  adaptiveSheet(`[data-act="awcount"][data-n="${step}"]`);
}

function adaptivePreview() {
  const draft = S.awDraft;
  if (!draft) return;
  draft.preview = adaptiveDraftPlan(draft.mon, draft.available, draft.count);
  draft.available = draft.preview.available;
  draft.count = draft.preview.count;
  adaptiveSheet('[data-act="awapply"]');
}

function adaptiveApply() {
  const draft = S.awDraft;
  if (!draft?.preview) return;
  if (draft.mon < mondayOf(todayKey())) {
    closeLayer();
    toast('This week has ended. Open the current week to plan again.');
    return;
  }
  const fresh = adaptiveDraftPlan(draft.mon, draft.available, draft.count);
  if (JSON.stringify(draft.preview) !== JSON.stringify(fresh)) {
    draft.preview = fresh;
    draft.available = fresh.available;
    draft.count = fresh.count;
    adaptiveSheet('[data-act="awapply"]', 'Your log or calendar changed. Review the updated schedule.');
    return;
  }
  const {fixed, ...calendar} = fresh;
  S.adaptiveWeeks[draft.mon] = {...calendar, at:new Date().toISOString()};
  queueSave('adaptiveWeeks/' + draft.mon);
  closeLayer();
  render();
  toast('Schedule saved');
}

function adaptiveReset() {
  const draft = S.awDraft;
  if (!draft || !adaptiveWeekFor(draft.mon)) return;
  if (draft.mon < mondayOf(todayKey())) { closeLayer(); return; }
  delete S.adaptiveWeeks[draft.mon];
  queueSave('adaptiveWeeks/' + draft.mon);
  closeLayer();
  render();
  toast('Usual schedule restored');
}
