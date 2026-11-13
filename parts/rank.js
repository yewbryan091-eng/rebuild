/* Personal muscle ranks. Credits come from saved sessions and are derived on every device. */
const RANK_TIERS = [
  ['Unranked', 0], ['Bronze', 1], ['Silver', 12], ['Gold', 32], ['Platinum', 64], ['Diamond', 112]
];
const RANK_SESSION_CAP = 4;
const RANK_WEEK_CAP = 8;

function rankWork(day) {
  const work = {};
  for (const id of Object.keys(day.sets || {})) {
    const group = EX[id]?.g;
    if (!MAIN_GROUPS.includes(group)) continue;
    const count = doneSets(day, id).filter(set => num(set.r) > 0).length;
    if (count) work[group] = (work[group] || 0) + count;
  }
  return work;
}

function rankHistory(end) {
  const totals = {}, byDay = {}, weeks = {};
  for (const date of Object.keys(S.days).filter(date => date <= end).sort()) {
    const day = S.days[date];
    if (!day.finished) continue;
    const week = weeks[mondayOf(date)] ||= {};
    const earned = byDay[date] = {};
    for (const [group, count] of Object.entries(rankWork(day))) {
      const left = RANK_WEEK_CAP - (week[group] || 0);
      const credit = Math.min(count, RANK_SESSION_CAP, left);
      if (!credit) continue;
      earned[group] = credit;
      week[group] = (week[group] || 0) + credit;
      totals[group] = (totals[group] || 0) + credit;
    }
  }
  return {totals, byDay, weeks};
}

function rankTier(credits) {
  let index = RANK_TIERS.length - 1;
  while (credits < RANK_TIERS[index][1]) index--;
  const [name, floor] = RANK_TIERS[index];
  const next = RANK_TIERS[index + 1];
  return {name, next: next?.[0], remaining: next ? next[1] - credits : 0,
    percent: next ? (credits - floor) / (next[1] - floor) * 100 : 100};
}

function rankOptions(date, group) {
  return lineupOf(date).filter(slot => !slot.skip && EX[slot.ex]?.g === group && slot.sets > 0);
}

function rankMission(date, group) {
  const day = getDay(date);
  if (day.rankFocus?.group !== group) return null;
  const {target} = day.rankFocus;
  if (!Number.isInteger(target) || target < 1 || target > 3) return null;
  const work = rankWork(day)[group] || 0;
  const slots = rankOptions(date, group);
  const available = slots.reduce((sum, slot) => sum + Math.max(0, slot.sets - doneSets(day, slot.ex).length), 0);
  const next = slots.find(slot => doneSets(day, slot.ex).length < slot.sets);
  return {target, work: Math.min(target, work), complete: work >= target,
    fits: work + available >= target, next};
}

function rankFocusCard(date) {
  const group = getDay(date).rankFocus?.group;
  if (!MAIN_GROUPS.includes(group)) return '';
  const mission = rankMission(date, group);
  if (!mission) return '';
  const {work, target, complete, fits, next} = mission;
  const finished = !!getDay(date).finished;
  const status = complete ? 'Focus complete' : finished ? `${work} of ${target} work sets · session saved` :
    fits ? `${work} of ${target} work sets` : 'Workout changed. Choose a focus that fits.';
  return `<section class="card rank-focus">
    <div><h2>${esc(GROUPS[group])} focus</h2><div class="small muted">${status}</div></div>
    ${complete ? '<span class="rank-complete" aria-label="Complete">✓</span>' : finished ? '' : fits && next ?
      `<button class="btn sm" data-act="rankexercise" data-id="${esc(next.ex)}">Go to exercise</button>` :
      '<button class="btn sm" data-act="tab" data-v="rank">Choose focus</button>'}
  </section>`;
}

function rankRecap(date) {
  const {byDay, totals} = rankHistory(date);
  const entries = Object.entries(byDay[date] || {});
  if (!entries.length) return '';
  const lines = entries.map(([group, count]) => {
    const current = rankTier(totals[group]).name;
    const promoted = current !== rankTier(totals[group] - count).name;
    return `<div class="rank-recap-row"><span>${esc(GROUPS[group])}</span><b>${promoted ? `${current} unlocked · ` : ''}+${count} credit${count === 1 ? '' : 's'}</b></div>`;
  }).join('');
  return `<section class="card rank-recap"><div class="row between"><h2>Rank progress</h2>
    <button class="btn sm" data-act="tab" data-v="rank">View ranks</button></div>${lines}</section>`;
}

function rankView(date) {
  const end = date <= todayKey() ? date : todayKey();
  const {totals, weeks} = rankHistory(end);
  const currentWeek = weeks[mondayOf(end)] || {};
  const coverage7 = coverage(7, end), coverage14 = coverage(14, end);
  const day = getDay(date), priorities = prioOf();
  const available = MAIN_GROUPS.filter(group => rankOptions(date, group).length);
  const candidates = available.filter(group => priorities.includes(group));
  const suggested = (candidates.length ? candidates : available).sort((a, b) =>
    (coverage7[a] || 0) - (coverage7[b] || 0))[0];
  const group = [S.rankGroup, day.rankFocus?.group, suggested, ...priorities, 'back']
    .find(item => MAIN_GROUPS.includes(item));
  const slots = rankOptions(date, group);
  const credits = totals[group] || 0, tier = rankTier(credits);
  const mission = rankMission(date, group);
  const mayChoose = date === todayKey() && !day.finished;
  const name = GROUPS[group];
  const rows = MAIN_GROUPS.map(item => `<button class="rank-pick" data-act="rankgroup" data-g="${item}" aria-pressed="${item === group}">
    <span>${esc(GROUPS[item])}</span><small>${coverage7[item] || 0} sets · ${rankTier(totals[item] || 0).name}</small></button>`).join('');
  let focus = '';
  if (mission) {
    const {work, target, complete, fits} = mission;
    focus = `<div class="rank-mission"><b>${complete ? 'Focus complete' : `${work} / ${target} work sets`}</b>
      <span>${mayChoose && !complete && !fits ? 'Your workout changed. Pick a focus that fits your plan.' : esc(name)}</span></div>`;
    if (mayChoose) focus += '<button class="btn sm ghost" data-act="rankclear">Clear focus</button>';
  } else if (mayChoose && slots.length) {
    const lifts = [...new Set(slots.map(slot => exOf(slot.ex).n))].map(esc).join(' · ');
    focus = `<div class="rank-mission"><b>Fits today’s workout</b><span>${lifts}</span></div>
      <button class="btn rank-start" data-act="rankfocus" data-g="${group}">Set ${esc(name.toLowerCase())} focus</button>`;
  } else if (mayChoose) {
    focus = `<div class="rank-mission"><b>No direct ${esc(name.toLowerCase())} work planned today</b><span>Choose a muscle already in today’s workout.</span></div>`;
  }
  return `<section class="rank-stage">
    <div class="rank-stage-head"><h1>Muscle ranks</h1><span>Direct work · 7 days</span></div>
    <canvas id="rank-map" width="480" height="350" aria-hidden="true" data-act="rankmap" data-g="${group}" data-cover="${esc(JSON.stringify(coverage7))}"></canvas>
    <div class="rank-map-labels" aria-hidden="true"><span>Front</span><span>Back</span></div>
    <div class="rank-legend"><span><i></i>No sets</span><span><i></i>1–3 sets</span><span><i></i>4+ sets</span></div>
  </section>
  <section class="card rank-detail">
    <div class="rank-detail-head"><div><span class="rank-overline">Personal rank</span><h2>${esc(name)}</h2></div>
      <strong class="rank-tier">${tier.name}</strong></div>
    <div class="rank-meter" role="progressbar" aria-label="Progress within ${tier.name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(tier.percent)}"><span style="width:${tier.percent}%"></span></div>
    <div class="rank-counts"><span>${credits} total credits</span><span>${tier.next ? `${tier.remaining} to ${tier.next}` : 'Highest rank'}</span></div>
    <div class="rank-stats"><div><b>${coverage7[group] || 0}</b><span>sets · 7 days</span></div><div><b>${coverage14[group] || 0}</b><span>sets · 14 days</span></div><div><b>${currentWeek[group] || 0}/${RANK_WEEK_CAP}</b><span>credits this week</span></div></div>
    ${focus}
  </section>
  <section class="card"><h2>Choose a muscle</h2><div class="rank-groups">${rows}</div>
    <details class="rank-rules"><summary>How credits work</summary><p>Finish a session to earn one credit per work set for its main muscle. Each muscle earns up to ${RANK_SESSION_CAP} credits per day and ${RANK_WEEK_CAP} per week. Warm-ups earn zero. Credits measure logged training. Use your lift history to check strength progress.</p></details>
  </section>`;
}

// Left-half regions are mirrored to show both sides. The list provides the same controls by keyboard.
const RANK_REGIONS = {
  front: [
    ['shoulders', 'M75 65 Q55 69 49 89 L53 106 L68 98 L81 79 Z'],
    ['chest', 'M96 74 L81 72 L69 92 L72 115 Q84 122 96 112 Z'],
    ['biceps', 'M55 109 L68 100 L64 129 Q61 145 49 152 L46 136 Z'],
    ['core', 'M96 118 L76 120 L79 156 L94 185 L96 166 Z'],
    ['quads', 'M92 187 L76 161 Q65 181 68 209 L76 250 L90 248 Z'],
    ['calves', 'M77 255 L90 253 L86 295 L82 316 L76 291 Z']
  ],
  back: [
    ['rear', 'M75 65 Q55 69 49 89 L53 106 L68 98 L81 79 Z'],
    ['back', 'M96 70 L81 68 L70 95 L74 123 L85 148 L96 156 Z'],
    ['triceps', 'M55 109 L68 100 L64 129 Q61 145 49 152 L46 136 Z'],
    ['glutes', 'M96 157 L76 151 L70 176 Q72 192 92 190 L96 179 Z'],
    ['hams', 'M92 195 L72 190 L68 210 L76 250 L90 248 Z'],
    ['calves', 'M77 255 L90 253 L87 285 L81 315 L75 287 Z']
  ]
};
const RANK_BODY = 'M98 7 C78 7 77 27 83 44 L89 56 Q87 65 68 65 Q51 68 47 87 L43 112 L36 145 L30 164 L18 197 Q18 206 24 205 L34 184 L43 166 L52 150 L64 125 L68 107 Q67 130 76 153 Q64 179 66 200 L70 229 L74 254 Q70 277 76 302 L76 322 L66 328 Q62 334 72 335 L87 335 Q91 334 89 326 L92 293 L94 257 L98 211';

function rankDraw(canvas, point) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const cover = JSON.parse(canvas.dataset.cover);
  const selected = canvas.dataset.g;
  let group = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const [view, offset] of [['front', 22], ['back', 262]]) {
    for (const mirror of [false, true]) {
      ctx.save();
      ctx.translate(offset + (mirror ? 196 : 0), 5);
      if (mirror) ctx.scale(-1, 1);
      ctx.fillStyle = '#293d43';
      ctx.fill(new Path2D(RANK_BODY));
      for (const [id, path] of RANK_REGIONS[view]) {
        const region = new Path2D(path);
        const n = cover[id] || 0;
        ctx.fillStyle = n >= 4 ? '#76bc9c' : n > 0 ? '#477d6c' : '#3c545a';
        ctx.fill(region);
        if (selected === id) {
          ctx.strokeStyle = '#e9ce91';
          ctx.lineWidth = 2.5;
          ctx.stroke(region);
        }
        if (point && ctx.isPointInPath(region, point.x, point.y)) group = id;
      }
      ctx.restore();
    }
  }
  return group;
}

function rankJump(id) {
  const section = [...document.querySelectorAll('[data-rank-exercise]')].find(el => el.dataset.rankExercise === id);
  if (!section) return;
  section.scrollIntoView({block:'start', behavior:REDUCE.matches ? 'instant' : 'smooth'});
  section.querySelector('.head')?.focus({preventScroll:true});
}
