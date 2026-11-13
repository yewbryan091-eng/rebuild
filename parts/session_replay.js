/* Compare actual logged work at the same load and in the same workout context. */
function replayEquipment(id, set) {
  const settings = equipOf(id);
  const context = set.liftContext;
  if (!context && (settings.gym || settings.setup || (settings.unit && settings.unit !== 'total'))) return null;
  const {unit = 'total', gym = '', setup = ''} = context || {};
  return JSON.stringify([unit, String(gym).trim().toLowerCase(), String(setup).trim().toLowerCase()]);
}

function replayWork(day, id) {
  const slot = (day.lineup || []).find(item => item.ex === id);
  const sets = doneSets(day, id);
  if (!sets.length || sets.some(set => set.pain || set.ss || set.wu0 || set.liftContext?.superset?.length) || slot?.ss) return null;
  const load = num(sets[0].w);
  if (load == null || load < 0 || sets.some(set => num(set.w) !== load)) return null;
  const equipment = replayEquipment(id, sets[0]);
  if (equipment == null || sets.some(set => replayEquipment(id, set) !== equipment)) return null;
  const unit = sets[0].liftContext?.unit || 'total';
  if (unit === 'assist') return null;
  return {load, sets, slot, equipment, unit, reps: sets.reduce((sum, set) => sum + num(set.r), 0)};
}

function replayMatch(current, previous) {
  if (!previous || current.load !== previous.load || current.equipment !== previous.equipment ||
      current.sets.length !== previous.sets.length) return null;
  if (current.slot && previous.slot &&
      (current.slot.lo !== previous.slot.lo || current.slot.hi !== previous.slot.hi)) return null;
  let effortKnown = true, restKnown = true;
  for (let i = 0; i < current.sets.length; i++) {
    const now = current.sets[i], then = previous.sets[i];
    const rirNow = num(now.rir), rirThen = num(then.rir);
    if (rirNow == null || rirThen == null) effortKnown = false;
    else if (Math.abs(rirNow - rirThen) > 1) return null;
    const restNow = num(now.rest), restThen = num(then.rest);
    if (i > 0 && !(restNow > 0 && restThen > 0)) restKnown = false;
    if (restNow > 0 && restThen > 0 && Math.abs(restNow - restThen) > Math.max(30, restThen * .35)) return null;
  }
  return {effortKnown, restKnown};
}

function sessionReplay(date) {
  const day = getDay(date);
  if (!day.finished) return '';
  const dates = Object.keys(S.days).filter(key => key < date && S.days[key].finished).sort().reverse();
  const comparisons = [];
  for (const id of exOrder(date)) {
    // Added-weight and assistance records have their own interpretation in lift history.
    if (exOf(id).bw || assistOf(id)) continue;
    const current = replayWork(day, id);
    if (!current) continue;
    for (const key of dates) {
      const previous = replayWork(S.days[key], id);
      const match = replayMatch(current, previous);
      if (!match) continue;
      const delta = current.reps - previous.reps;
      comparisons.push({id, date:key, current, previous, delta, ...match});
      break;
    }
  }
  if (!comparisons.length) return '';
  comparisons.sort((a, b) => Number(b.effortKnown) - Number(a.effortKnown) || b.delta - a.delta);
  const items = comparisons.slice(0, 3).map(item => {
    const {id, current, previous, delta, effortKnown, restKnown} = item;
    const label = delta > 0 ? `+${delta} rep${delta === 1 ? '' : 's'}` : delta < 0 ?
      `${delta} rep${delta === -1 ? '' : 's'}` : 'Matched';
    const pills = sets => sets.map(set => `<b>${num(set.r)}</b>`).join('');
    return `<article class="replay-lift">
      <div class="replay-line"><strong>${esc(exOf(id).n)}</strong><span class="replay-result${delta > 0 ? ' replay-up' : ''}">${label}</span></div>
      <div class="replay-meta">${esc(fmtW(current.load))} ${esc(UNIT_LABEL[current.unit] || 'kg')} · ${current.sets.length} work sets${effortKnown ? ' · similar effort' : ' · effort partly unlogged'}${restKnown ? '' : ' · rest partly unlogged'}</div>
      <div class="replay-splits">
        <div><span>${esc(nice(item.date))}</span><div>${pills(previous.sets)}</div></div>
        <div><span>${date === todayKey() ? 'Today' : esc(nice(date))}</span><div>${pills(current.sets)}</div></div>
      </div>
      <button class="btn sm ghost" data-act="lift" data-id="${esc(id)}">Lift history</button>
    </article>`;
  }).join('');
  return `<section class="card session-replay"><h2>Session replay</h2>${items}</section>`;
}
