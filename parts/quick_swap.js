/* A short list of familiar alternatives for the equipment available today. */
const SWAP_KITS = {
  db:'Dumbbells', cable:'Cable', machine:'Machine', rack:'Barbell / rack', body:'Bodyweight',
  bench:'Dumbbells + bench', smith:'Smith machine', bar:'Pull-up bar', band:'Band',
  pad:'Dumbbell + preacher bench', cableBench:'Cable + bench', sliders:'Sliders', ball:'Stability ball',
  plate:'Weight plate'
};
const SWAP_FILTERS = {
  all:'Any', db:'Dumbbells', cable:'Cable', machine:'Machine', rack:'Barbell / rack',
  body:'Bodyweight', band:'Band', sliders:'Sliders', ball:'Stability ball', plate:'Plate'
};
const SWAP_FILTER_FOR = {bench:'db',pad:'db',cableBench:'cable',smith:'machine',bar:'body'};
// These groups deliberately keep different movement patterns apart, even within one muscle.
const SWAP_MOVEMENTS = [
  ['Flat press', {rack:'bench floor_press',bench:'db_bench neutral_db_bench',db:'db_floor_press',smith:'smith_bench',machine:'machine_press hammer_press converging_press',cable:'cable_press seated_cable_press',body:'pushup_ex incline_pushup'}],
  ['Incline press', {rack:'incline_bb low_incline_bb',bench:'incline_db low_incline_db',smith:'incline_smith',machine:'incline_machine incline_hammer',cableBench:'incline_cable_press',body:'decline_pushup'}],
  ['Decline press', {rack:'decline_bb',bench:'decline_db',smith:'decline_smith',machine:'decline_machine'}],
  ['Chest fly', {bench:'db_fly incline_db_fly',cable:'cable_fly cable_crossover',machine:'pec_deck incline_pec_deck'}],
  ['Chest dip', {bar:'chest_dip',machine:'assisted_dip machine_dip'}],
  ['Overhead press', {rack:'ohp seated_bb_press',db:'standing_db_press',bench:'shoulder_press arnold',smith:'smith_press',machine:'machine_shoulder hammer_shoulder',body:'pike_pushup'}],
  ['Lateral raise', {db:'lat_raise leaning_lat',bench:'seated_lat',cable:'cable_lat cable_lat_both',machine:'machine_lat'}],
  ['Rear delt work', {db:'bent_rev_fly rear_delt_row',bench:'cs_rev_fly',cable:'face_pull cable_rev_fly',machine:'rev_pec_deck machine_rear_row',band:'band_pullapart'}],
  ['Triceps extension', {db:'db_kickback',bench:'db_skull',cable:'pushdown bar_pushdown sa_pushdown cable_kickback',machine:'tri_press_machine'}],
  ['Overhead triceps', {db:'oh_ext sa_oh_ext',bench:'seated_oh_ext',rack:'ez_oh_ext',cable:'rope_oh_ext sa_cable_oh',machine:'machine_oh_ext'}],
  ['Close-grip press', {rack:'close_grip cg_floor',bench:'cg_db',smith:'cg_smith',body:'cg_pushup diamond',machine:'machine_tri_dip'}],
  ['Vertical pull', {bar:'pullup neutral_pullup chinup',cable:'pulldown cg_pulldown neutral_pulldown',machine:'assisted_pullup machine_pulldown'}],
  ['Straight-arm pull', {bench:'db_pullover',cable:'sa_pulldown rope_sapd',machine:'machine_pullover'}],
  ['Horizontal row', {rack:'bb_row tbar',bench:'cs_row sa_db_row cs_wide_row',db:'db_bent_row',cable:'cable_row sa_cable_row',machine:'machine_row iso_row',smith:'smith_row'}],
  ['Biceps curl', {rack:'bb_curl ez_curl',db:'db_curl db_curl_both',cable:'cable_curl sa_cable_curl bayesian',machine:'machine_curl machine_preacher',bench:'incline_curl concentration',pad:'preacher_db'}],
  ['Neutral-grip curl', {db:'hammer xbody_hammer',bench:'seated_hammer incline_hammer_curl',cable:'rope_hammer sa_cable_hammer'}],
  ['Squat / leg press', {rack:'squat front_squat',db:'goblet heel_goblet',machine:'hack pendulum belt_squat leg_press seated_press vsquat',smith:'smith_squat smith_front'}],
  ['Single-leg squat', {rack:'bb_bss bb_rev_lunge',db:'split_squat rev_lunge',bench:'bss stepup',smith:'smith_bss smith_split',body:'bw_lunge'}],
  ['Knee extension', {machine:'leg_ext sl_ext',body:'rev_nordic',band:'spanish'}],
  ['Hamstring curl', {machine:'leg_curl lying_curl standing_curl',sliders:'slider_curl',ball:'ball_curl'}],
  ['Hip hinge', {rack:'rdl deadlift trap_dl',db:'db_rdl kb_dl',cable:'cable_rdl pull_through',smith:'smith_rdl',machine:'backext'}],
  ['Hip thrust', {rack:'hip_thrust glute_bridge',bench:'db_thrust',smith:'smith_thrust',machine:'machine_thrust',body:'sl_bridge'}],
  ['Calf raise', {db:'calf sl_calf',smith:'smith_calf',machine:'standing_calf seated_calf lp_calf',body:'stair_calf'}],
  ['Ab crunch', {cable:'cable_crunch standing_cable_crunch',machine:'machine_crunch',body:'crunch_ex reverse_crunch',plate:'weighted_crunch'}],
  ['Leg raise', {bar:'hang_leg_raise hang_knee',machine:'captain',body:'lying_leg_raise'}],
  ['Trunk brace', {body:'dead_bug bird_dog shoulder_tap',cable:'pallof'}]
].map(([name, kits]) => ({
  name, items:Object.entries(kits).flatMap(([kit, ids])=>ids.split(' ').map(id=>({id,kit})))
}));
const SWAP_CUSTOM = {
  quads:[[/\b(?:leg press|squat)\b/i,'Squat / leg press']],
  back:[[/\brow\b/i,'Horizontal row'],[/\b(?:pull[- ]?down|pull[- ]?up)\b/i,'Vertical pull']],
  core:[[/\bcrunch\b/i,'Ab crunch']],
  hams:[[/\b(?:leg curl|hamstring curl)\b/i,'Hamstring curl'],[/\b(?:rdl|deadlift)\b/i,'Hip hinge']],
  calves:[[/\bcalf\b/i,'Calf raise']]
};

function swapMovement(id){
  const ex=EX[id];
  if(!ex) return null;
  const direct=SWAP_MOVEMENTS.find(m=>m.items.some(item=>item.id===id));
  if(direct) return direct;
  if(ex.mine){
    const match=(SWAP_CUSTOM[ex.g]||[]).find(([pattern])=>pattern.test(ex.n));
    return match?SWAP_MOVEMENTS.find(m=>m.name===match[1]):null;
  }
  // A library family can span several patterns. Only infer a family when it points to one group.
  const family=new Set(FAMS[ex.fam]||[]);
  const candidates=SWAP_MOVEMENTS.filter(m=>m.items.some(item=>family.has(item.id)&&EX[item.id]?.g===ex.g));
  return candidates.length===1?candidates[0]:null;
}

function swapRemaining(day, slot){
  return Math.max(0, Math.floor(num(slot.sets)||0)-doneSets(day,slot.ex).length);
}

function swapRecorded(day, id){
  return ((day.sets||{})[id]||[]).some(set=>set?.d||set?.pain||num(set?.w)!=null||num(set?.r)!=null);
}

function swapAvailable(day, lineup, id){
  return !lineup.some(slot=>slot.ex===id)&&!(day.full||[]).some(slot=>slot.ex===id)&&!swapRecorded(day,id);
}

function swapPrescription(source,id,sets){
  const slot=slotOf(id,exOf(id).sc);
  slot.sets=sets;
  if(source.ss) slot.ss=source.ss;
  return slot;
}

function swapSetLabel(id,w){
  if(exOf(id).bw&&w===0&&!assistOf(id)) return 'Bodyweight';
  return `${fmtW(w)} ${unitOf(id)}`;
}

function swapDecision(id,slot,date,context){
  const dec=decide(id,slot,date,context);
  if(!slot.quickSwap||!dec.up||dec.ref?.top==null) return dec;
  const w=dec.ref.top;
  return {...dec,w,kind:'hold',up:false,goal:null,
    head:`${swapSetLabel(id,w)} · ${slot.lo}–${slot.hi} reps · finish with ${dec.eff.txt}`,
    why:'Start with the last load you used on this exercise.'};
}

function swapChoices(date,index){
  const day=getDay(date), lineup=lineupOf(date), slot=lineup[index];
  if(day.finished||!slot||slot.skip) return [];
  const move=swapMovement(slot.ex), group=EX[slot.ex]?.g, sets=swapRemaining(day,slot);
  if(!move||!sets) return [];
  const sourceKit=move.items.find(item=>item.id===slot.ex)?.kit;
  const seen=lastSeenMap();
  return move.items
    .filter(({id})=>EX[id]?.g===group&&swapAvailable(day,lineup,id))
    .map(({id,kit})=>{
      const next=swapPrescription(slot,id,sets);
      const minutes=slotMinutes(next);
      return {id,kit,next,minutes,seen:seen[id]||'',sameKit:kit===sourceKit};
    })
    .sort((a,b)=>Number(a.sameKit)-Number(b.sameKit)||
      b.seen.localeCompare(a.seen)||a.minutes-b.minutes);
}

function swapFilter(choices,filter,fast){
  return choices.filter(item=>(filter==='all'||filter===(SWAP_FILTER_FOR[item.kit]||item.kit))&&(!fast||item.minutes<=6));
}

function swapShortlist(choices, filtered){
  if(filtered) return choices.slice(0,6);
  // Lead with one choice per equipment type so a busy station doesn't fill the sheet.
  const featured=[], rest=[], kits=new Set();
  for(const item of choices){
    const type=SWAP_FILTER_FOR[item.kit]||item.kit;
    if(kits.has(type)) rest.push(item);
    else {kits.add(type);featured.push(item)}
  }
  return featured.concat(rest).slice(0,4);
}

function swapPanel(date,index,filter='all',fast=false,focus=true){
  const day=getDay(date), slot=lineupOf(date)[index];
  if(day.finished||!slot||slot.skip) return;
  const ex=exOf(slot.ex), move=swapMovement(slot.ex), left=swapRemaining(day,slot);
  const logged=doneSets(day,slot.ex).length;
  const available=swapChoices(date,index), choices=swapFilter(available,filter,fast);
  const equipment=new Set(available.map(item=>SWAP_FILTER_FOR[item.kit]||item.kit));
  S.swapPicker={date,index,source:slot.ex,filter,fast};
  const options=swapShortlist(choices,filter!=='all'||fast).map(item=>{
    const context=typeof liveLiftContext==='function'?
      {...liveEquipmentContext(item.id),superset:(liveLiftContext(date,index).superset||[]).map(id=>id===slot.ex?item.id:id)}:undefined;
    const dec=swapDecision(item.id,{...item.next,quickSwap:true},date,context), e=exOf(item.id), gym=equipOf(item.id).gym;
    const load=dec.w!=null?swapSetLabel(item.id,dec.w):dec.last?.pain||dec.ref?.pain?'Choose a comfortable setup':
      exOf(item.id).bw&&!assistOf(item.id)?'Start with bodyweight':'Find a starting load with a light set';
    return `<button class="swap-choice" data-act="swapapply" data-id="${esc(item.id)}">
      <strong>${esc(e.n)}</strong><span class="swap-choice-kit">${esc(SWAP_KITS[item.kit])}${gym?` · ${esc(gym)}`:''}</span>
      <span>${esc(load)} · ${left} × ${item.next.lo}–${item.next.hi} · ~${item.minutes} min</span>
    </button>`;
  }).join('');
  const history=slot.quickSwap?.credit||[];
  const carry=[...new Set(history.concat(logged?[slot.ex]:[]))].reduce((n,id)=>n+doneSets(day,id).length,0);
  const description=left
    ? `${left} work set${left===1?'':'s'} left${move?` · ${move.name}`:''}${GROUPS[ex.g]?` · ${GROUPS[ex.g]}`:''}`
    : 'You’ve logged all the work sets for this exercise.';
  const undo=slot.quickSwap?.previous&&!swapRecorded(day,slot.ex);
  document.getElementById('layer').innerHTML=`<div class="scrim" data-act="close"><div class="sheet swap-sheet" role="dialog" aria-modal="true" aria-labelledby="swap-sheet-title">
    <div class="grab"></div>
    <div class="row between"><div><div class="swap-eyebrow">Equipment taken?</div><h2 class="sheet-h" id="swap-sheet-title" tabindex="-1">Swap ${esc(ex.n)}</h2></div><button class="iconbtn" data-act="closebtn" aria-label="Close">✕</button></div>
    <p class="small muted swap-meta">${esc(description)}${carry?` · ${carry} logged set${carry===1?'':'s'} kept`:''}</p>
    ${equipment.size?`<div class="swap-filter"><b>What’s free?</b><div class="chips">
      ${Object.entries(SWAP_FILTERS).filter(([key])=>key==='all'||equipment.has(key)).map(([key,name])=>`<button class="chipb" data-act="swapfilter" data-e="${key}" aria-pressed="${key===filter}">${name}</button>`).join('')}
      <button class="chipb" data-act="swapfast" aria-pressed="${fast}">6 min or less</button></div></div>`:''}
    ${options?`<div class="swap-choices">${options}</div>`:left?`<p class="small muted swap-meta">${equipment.size?'No matches with those filters. Try another setup.':'Browse all exercises to choose a replacement for this movement.'}</p>`:''}
    ${undo?'<button class="btn" data-act="swapundo">Undo last swap</button>':''}
    <button class="btn ghost" data-act="swapbrowse">Browse all &amp; edit</button>
  </div></div>`;
  if(focus) document.getElementById('swap-sheet-title')?.focus({preventScroll:true});
}

function swapPickerContext(){
  const p=S.swapPicker;
  const day=getDay(S.date), lineup=lineupOf(S.date);
  if(!p||p.date!==S.date||day.finished||lineup[p.index]?.ex!==p.source) return null;
  return {p,day,lineup};
}

function swapReplaceSlot(day,lineup,index,next){
  const current=lineup[index];
  const credit=[...(current.quickSwap?.credit||[])];
  if(doneSets(day,current.ex).length) credit.push(current.ex);
  const original=current.quickSwap?.original||current;
  const {quickSwap,...previous}=current;
  if(quickSwap) previous.quickSwap={original:clone(original),credit:[...quickSwap.credit]};
  const replacement={...next,quickSwap:{original:clone(original),credit:[...new Set(credit)],previous:clone(previous)}};
  swapPutSlot(day,lineup,index,replacement);
}

function swapPutSlot(day,lineup,index,replacement){
  const previous=lineup[index];
  lineup[index]=replacement;
  if(day.full){
    const fullIndex=day.full.findIndex(slot=>slot.ex===previous.ex);
    if(fullIndex!==-1) day.full[fullIndex]=clone(replacement);
  }
  const before=exOf(previous.ex).n;
  if(rest.end&&(rest.name===before||rest.name.startsWith(before+' ('))){
    rest.name=exOf(replacement.ex).n+rest.name.slice(before.length);
  }
}

function applyQuickSwap(id){
  const context=swapPickerContext();
  if(!context) return;
  const {p}=context;
  const candidate=swapFilter(swapChoices(p.date,p.index),p.filter,p.fast).find(item=>item.id===id);
  if(!candidate){swapPanel(p.date,p.index,p.filter,p.fast);return}
  const day=editDay(p.date), lineup=lineupFor(day,p.date);
  swapReplaceSlot(day,lineup,p.index,candidate.next);
  closeLayer(); render(); rankJump(id);
  toast(`${exOf(id).n} · ${candidate.next.sets} work set${candidate.next.sets===1?'':'s'} left`);
}

function undoQuickSwap(){
  const context=swapPickerContext();
  if(!context) return;
  const {p,day,lineup}=context, current=lineup[p.index], previous=current.quickSwap?.previous;
  if(!previous||swapRecorded(day,current.ex)) return;
  if(lineup.some((slot,i)=>i!==p.index&&slot.ex===previous.ex)||
     (day.full||[]).some(slot=>slot.ex===previous.ex)){
    toast('That exercise is already in this workout.'); return;
  }
  const saved=editDay(p.date);
  swapPutSlot(saved,lineupFor(saved,p.date),p.index,clone(previous));
  closeLayer(); render(); rankJump(previous.ex);
  toast(`Restored ${exOf(previous.ex).n}`);
}

// Temporary substitutions stay with the day. Strip them when saving a reusable workout.
function swapReusableLineup(lineup){
  const regular=new Set(lineup.filter(slot=>!slot.quickSwap).map(slot=>slot.ex));
  const result=[];
  for(const slot of lineup){
    if(!slot.quickSwap){result.push(clone(slot));continue}
    const original=slot.quickSwap.original;
    if(!original||regular.has(original.ex)) continue;
    const restored={...clone(original)};
    if(slot.ss) restored.ss=slot.ss; else delete restored.ss;
    regular.add(restored.ex);
    result.push(restored);
  }
  return result;
}

function swapCarriedSets(day,lineup){
  const current=new Set(lineup.map(slot=>slot.ex));
  const older=new Set([...lineup,...(day.full||[])].flatMap(slot=>slot.quickSwap?.credit||[]));
  return [...older].reduce((n,id)=>n+(current.has(id)?0:doneSets(day,id).length),0);
}

function swapCarrySummary(day,lineup){
  const current=new Set(lineup.map(slot=>slot.ex));
  const ids=new Set([...lineup,...(day.full||[])].flatMap(slot=>slot.quickSwap?.credit||[]));
  return [...ids].filter(id=>!current.has(id)&&doneSets(day,id).length)
    .map(id=>`<div class="muted"><b>${esc(exOf(id).n)}</b> · ${doneSets(day,id).length} work sets logged before swapping</div>`).join('');
}

function swapCarryLabel(day,slot){
  const ids=slot.quickSwap?.credit||[];
  const lines=ids.map(id=>({id,count:doneSets(day,id).length})).filter(item=>item.count);
  if(!lines.length) return '';
  return `<div class="small muted swap-carried">${lines.map(({id,count})=>`${count} set${count===1?'':'s'} logged on ${esc(exOf(id).n)}`).join(' · ')}</div>`;
}

function swapFullPickerChoice(id){
  const picker=S.pick, date=S.date, day=getDay(date), lineup=lineupOf(date);
  if(!picker||day.finished||lineup.some(slot=>slot.ex===id)||(day.full||[]).some(slot=>slot.ex===id)) return;
  if(picker.mode==='swap'){
    const current=lineup[picker.i], sets=current&&swapRemaining(day,current);
    if(!sets||!swapAvailable(day,lineup,id)){toast('Choose an exercise you haven’t logged today.');return}
    const saved=editDay(date), next=swapPrescription(current,id,sets);
    swapReplaceSlot(saved,lineupFor(saved,date),picker.i,next);
    closeLayer(); render(); rankJump(id); toast(`Swapped to ${exOf(id).n}`);
  }else{
    const saved=editDay(date);
    lineupFor(saved,date).push(slotOf(id,exOf(id).sc));
    toast(`Added ${exOf(id).n}`);
    const list=document.getElementById('picklist');
    if(list) list.innerHTML=pickList();
    render();
  }
}
