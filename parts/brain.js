/* ============ training brain ============ */
// One progression calculation feeds the exercise card, the session summary and the weekly coach, and it works offline.
// Sets carry optional context: k:'wu' warm-up, rir 0–4 (4 = 4+) or 'u' unsure, pain (pain or form broke down),
// wu0 (weight not recorded), at (tick time), rest (seconds since the previous set), ss (done inside a superset).
const isWU = s=>!!s&&s.k==='wu';
// performed work sets: ticked with reps. A loaded lift may have an unknown weight (w:null); it still counts as work done.
function doneSets(day,exId){const ex=EX[exId]||{};const bw=ex.bw||ex.as;return ((day.sets||{})[exId]||[]).filter(s=>s&&s.d&&!isWU(s)&&num(s.r)!=null).map(s=>num(s.w)==null&&bw&&!s.wu0?{...s,w:0}:s)}
// only sets with a known weight may drive records, volume and load changes
const loadSets = (day,exId)=>doneSets(day,exId).filter(s=>num(s.w)!=null);

const equipOf = id=>S.equip[id]||{};
const incOf = id=>{const q=num(equipOf(id).inc);return q>0?q:(exOf(id).inc||2.5)};
const assistOf = id=>!!exOf(id).as||equipOf(id).unit==='assist';
const UNIT_LABEL = {total:'kg',side:'kg/side',each:'kg each',assist:'kg assist'};
const unitOf = id=>UNIT_LABEL[equipOf(id).unit]||(exOf(id).as?'kg assist':'kg');
const RIR_TXT = {0:'0 reps left (failure)',1:'1 rep left',2:'2 reps left',3:'3 reps left',4:'4+ reps left',u:'unsure'};
// conservative starting effort while consistency rebuilds; overridable per exercise in its setup
function effortOf(id){
  const o=num(equipOf(id).rir); if(o!=null) return {t:o,lo:o,hi:o,txt:`about ${o} rep${o===1?'':'s'} left`};
  const sc=exOf(id).sc;
  if(sc==='C'||sc==='p') return {t:2,lo:2,hi:3,txt:'about 2–3 reps left'};
  if(sc==='c') return {t:2,lo:2,hi:2,txt:'about 2 reps left'};
  return {t:1,lo:1,hi:2,txt:'about 1–2 reps left'};
}
// one exercise in one past session, read the way a coach would
function readSession(k,id){
  const day=S.days[k], all=doneSets(day,id); if(!all.length) return null;
  const slot=(day.lineup||[]).find(s=>s.ex===id)||null, as=assistOf(id);
  const sets=all.filter(s=>num(s.w)!=null);
  let top=null; if(sets.length){const ws=sets.map(s=>num(s.w)); top=as?Math.min(...ws):Math.max(...ws)}
  const topSets=top==null?[]:sets.filter(s=>num(s.w)===top), back=top==null?[]:sets.filter(s=>num(s.w)!==top);
  const rirs=topSets.map(s=>s.rir).filter(x=>x!=null&&x!=='u').map(Number);
  const rests=all.map(s=>num(s.rest)).filter(x=>x!=null&&x>0);
  return {k,all,sets,top,topSets,back,planned:slot?slot.sets:null,slot,
    pain:all.some(s=>s.pain), rirs, avgRir:rirs.length?rirs.reduce((a,b)=>a+b,0)/rirs.length:null,
    // reps that drop after a superset or a rushed rest say little about strength
    tired:!!(slot&&slot.ss)||all.some(s=>s.ss)||!!(slot&&rests.length&&rests.some(r=>r<(slot.rest||90)*0.7))};
}
function sessionsOf(id,before,n=4){const out=[];for(const k of Object.keys(S.days).filter(k=>k<before).sort().reverse()){const r=readSession(k,id);if(r)out.push(r);if(out.length>=n)break}return out}
// what to attempt next: load, reps, effort, and one plain reason
function decide(id,sl,before){
  const ex=exOf(id), inc=incOf(id), as=assistOf(id), eff=effortOf(id), lo=sl.lo, hi=sl.hi;
  const hist=sessionsOf(id,before), last=hist[0], ref=hist.find(h=>h.top!=null);
  const out=(w,kind,why,goal=null)=>({w,lo,hi,eff,kind,up:kind==='up',down:kind==='down',why,last,ref,goal,
    head:`${w!=null?`${as?'Assist ':''}${ex.bw&&w===0&&!as?'Bodyweight':fmtW(w)+' kg'} · `:''}${lo}–${hi} reps · finish with ${eff.txt}`});
  if(!last) return out(null,'new',`First time: pick a weight you could lift ${hi} times with ${eff.txt}.`);
  if(!ref) return out(null,'unknown',`Last time the weight wasn't logged (${last.all.map(s=>s.r).join('/')} reps). Pick a weight for ${lo}–${hi} reps and log it this time.`);
  const w0=ref.top, reps=ref.topSets.map(s=>num(s.r)), need=Math.max(1,ref.planned||sl.sets);
  const note=ref!==last?' (latest session had no weights logged)':'';
  const bwZero=ex.bw&&w0===0&&!as, upW=as?Math.max(0,w0-inc):w0+inc;
  if(ref.pain) return out(w0,'hold',`Last time you flagged pain or form breaking down. Same weight or lighter, and stop the set if it hurts.`);
  // a top set plus lighter back-off sets counts as complete only when the back-offs held the rep range
  const backOk=ref.back.length>0&&ref.back.every(s=>num(s.r)>=lo)&&ref.topSets.length+ref.back.length>=need;
  if(ref.topSets.length<need&&!backOk){
    if(ref.back.length&&ref.topSets.length+ref.back.length>=need) return out(w0,'hold',`Only ${ref.topSets.length} set${ref.topSets.length>1?'s':''} at ${fmtW(w0)} kg; the rest dropped lighter (${ref.back.map(s=>fmtSet(id,s)).join(', ')}). Same ${fmtW(w0)} kg; aim for all ${need} sets there.`);
    return out(w0,'hold',`Last time ${ref.sets.length} of ${need} set${need>1?'s':''} ${ref.all.length>ref.sets.length?(ref.sets.length===1?'had a weight':'had weights')+' logged':ref.sets.length===1?'was logged':'were logged'}${note}. Same weight; get all ${need} in before adding load.`);
  }
  const allTop=reps.every(r=>r>=hi), below=reps.filter(r=>r<lo).length;
  const blockTxt=ref.back.length?'your top set':`all ${ref.topSets.length} sets`;
  if(allTop){
    if(ref.avgRir!=null&&ref.avgRir<eff.lo-1) return out(w0,'hold',`You hit ${hi} on ${blockTxt}, but with only ${Math.round(ref.avgRir)} rep${Math.round(ref.avgRir)===1?'':'s'} left. Same weight until it feels like ${eff.txt}.`,reps);
    if(bwZero) return out(0,'up',`Hit ${hi}+ on ${blockTxt}${note}. Add 2.5 kg, or slow the lowering to 3 seconds.`);
    return out(upW,'up',`Hit ${hi} on ${blockTxt} at ${fmtW(w0)} kg${note}. ${as?'Lower the assist':'Go up'} to ${fmtW(upW)} kg and start at ${lo} reps.`,[lo]);
  }
  if(below>=Math.ceil(reps.length/2)){
    if(ref.tired) return out(w0,'hold',`Reps dropped after ${ref.slot&&ref.slot.ss||ref.all.some(s=>s.ss)?'a superset':'short rest'}. Same weight; rest the full ${mmss(sl.rest||90)} and compare again.`);
    // one weak day is noise; only a repeat under comparable conditions earns a lighter weight
    const prev=hist.slice(hist.indexOf(ref)+1).find(h=>h.top===w0&&!h.tired&&!h.pain);
    const prevBelow=prev&&prev.topSets.filter(s=>num(s.r)<lo).length>=Math.ceil(prev.topSets.length/2);
    if(prevBelow){const nw=as?w0+inc:Math.max(0,Math.round(w0*0.92/inc)*inc);return out(nw,'down',`Under ${lo} reps two sessions running at ${fmtW(w0)} kg. ${as?'Add assist':'Drop'} to ${fmtW(nw)} kg and build back up.`)}
    return out(w0,'hold',`Fell under ${lo} reps once (${reps.join('/')}). Same weight next time; one off day isn't a trend.`);
  }
  const goal=reps.map(r=>Math.min(hi,r+1));
  if(ref.avgRir!=null&&ref.avgRir>=eff.hi+2) return out(w0,'hold',`Last ${reps.join('/')} felt easy (${Math.round(ref.avgRir)}+ left). Same weight, push closer: aim for ${goal.join('/')}.`,goal);
  return out(w0,'hold',`Last ${reps.join('/')} at ${fmtW(w0)} kg${note}. Same weight; build to ${goal.join('/')} before adding load.`,goal);
}
// kept for the warm-up ramp
function suggestion(exId,lo,hi,before){return decide(exId,{lo,hi,sets:3,rest:90},before)}
// one number per session to track progress: est. 1RM for loaded lifts, top-weight reps for bodyweight/assisted
function liftScore(id,sets){
  const ex=exOf(id); sets=sets.filter(s=>num(s.w)!=null&&num(s.r)!=null); if(!sets.length) return null;
  if(ex.bw||assistOf(id)){
    const as=assistOf(id), ws=sets.map(s=>num(s.w)), top=as?Math.min(...ws):Math.max(...ws);
    const r=Math.max(...sets.filter(s=>num(s.w)===top).map(s=>num(s.r)));
    return {v:(as?-top:top)*100+r,label:ex.bw&&top===0&&!as?`BW × ${r}`:`${fmtW(top)} kg × ${r}`,unit:'reps',plot:r+(as?-top:top)/10};
  }
  let b=null; sets.forEach(s=>{const v=e1rm(num(s.w),num(s.r));if(!b||v>b.v)b={v,w:num(s.w),r:num(s.r)}});
  return {v:b.v,label:`${fmtW(b.w)} × ${b.r}`,e1:Math.round(b.v*2)/2,plot:b.v};
}
function dayPRs(k){
  const day=getDay(k), out=[];
  for(const id in (day.sets||{})){
    const ex=exOf(id); if(ex.bw||assistOf(id)) continue;
    let prev=0; for(const kk in S.days){if(kk>=k)continue; loadSets(S.days[kk],id).forEach(s=>{const v=e1rm(num(s.w),num(s.r));if(v>prev)prev=v})}
    let best=null; loadSets(day,id).forEach(s=>{const v=e1rm(num(s.w),num(s.r));if(num(s.w)>0&&v>prev+0.01&&(!best||v>best.v))best={v,w:num(s.w),r:num(s.r)}});
    if(best&&prev>0) out.push({id,...best});
  }
  return out;
}
function dayVolume(day){let v=0;for(const id in (day.sets||{}))loadSets(day,id).forEach(s=>v+=num(s.w)*num(s.r));return Math.round(v)}

/* ---------- muscle coverage + short sessions ---------- */
const MAIN_GROUPS = ['back','chest','shoulders','rear','biceps','triceps','quads','hams','glutes','calves','core'];
const prioOf = ()=>Array.isArray(S.profile.prio)?S.profile.prio:['back','core'];
// direct work sets per muscle group over the days up to endKey; any workout counts, mixed or custom
function coverage(days,endKey){
  const from=addDays(endKey,-(days-1)), c={};
  for(const k in S.days){if(k<from||k>endKey)continue;const d=S.days[k];for(const id in (d.sets||{})){const n=doneSets(d,id).length;if(n){const g=exOf(id).g;c[g]=(c[g]||0)+n}}}
  return c;
}
const slotMinutes = sl=>Math.round(sl.sets*((sl.rest||90)+40)/60)+1;
// fill the time with the most useful work: big lifts first, then muscles that have had little this week, priorities a bit higher
function pickShort(lu,mins,k){
  const cov=coverage(7,addDays(k,-1)), prio=prioOf();
  const left=runs(lu).map((r,ri)=>{const sls=r.map(i=>lu[i]);return {r,ri,t:sls.reduce((a,s)=>a+slotMinutes(s),0),gs:sls.map(s=>exOf(s.ex).g),
    base:Math.max(...sls.map(s=>{const sc=exOf(s.ex).sc;return sc==='C'?6:sc==='c'?4:2}))-ri*0.3}});
  const chosen=[], have=new Set(); let used=0;
  while(left.length){
    let best=null;
    for(const g of left){let s=g.base;for(const m of g.gs){const n=cov[m]||0;s+=n<4?3:n<8?1:0;if(prio.includes(m))s+=1.5;if(have.has(m))s-=3}if(!best||s>best.s)best={g,s}}
    if(chosen.length&&used+best.g.t>mins){left.splice(left.indexOf(best.g),1);continue}
    chosen.push(best.g); used+=best.g.t; best.g.gs.forEach(m=>have.add(m)); left.splice(left.indexOf(best.g),1);
  }
  return {keep:chosen.sort((a,b)=>a.ri-b.ri).flatMap(g=>g.r),used};
}
function coverageCard(k){
  const c7=coverage(7,k), c14=coverage(14,k), prio=prioOf();
  const rows=MAIN_GROUPS.map(g=>{const a=c7[g]||0,b=c14[g]||0;return `<div class="cov${a?'':' gap'}"><span>${prio.includes(g)?'★ ':''}${esc(GROUPS[g])}</span><b class="num">${a}</b><span class="num muted">${b}</span></div>`}).join('');
  const gaps=MAIN_GROUPS.filter(g=>!(c7[g]||0)).map(g=>GROUPS[g]);
  return `<section class="card"><div class="row between"><h2>Muscles hit</h2><span class="small muted">work sets · 7 days · 14 days</span></div>
    <div class="covgrid">${rows}</div>
    ${gaps.length?`<div class="small muted">Nothing logged in 7 days: ${esc(gaps.join(', '))}.</div>`:''}</section>`;
}

/* ---------- logging from text ---------- */
// "preacher curl 2x10 20kg, bayesian curl 3 sets of 10" → rows to check before saving. Never invents a weight.
function parseLogText(text){
  return String(text||'').split(/\n|;|,(?=\s*[a-zA-Z])/).map(s=>s.trim()).filter(Boolean).map(line=>{
    let t=' '+line.toLowerCase()+' ', sets=1, reps=null, w=null, m;
    if((m=t.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?)\b/))){w=+m[1];t=t.replace(m[0],' ')}
    else if((m=t.match(/@\s*(\d+(?:\.\d+)?)/))){w=+m[1];t=t.replace(m[0],' ')}
    if((m=t.match(/(\d+)\s*[x×*]\s*(\d+)/))){sets=+m[1];reps=+m[2];t=t.replace(m[0],' ')}
    else if((m=t.match(/(\d+)\s*sets?\b(?:[^\d]{0,20})(\d+)\s*(?:reps?)?/))){sets=+m[1];reps=+m[2];t=t.replace(m[0],' ')}
    else if((m=t.match(/(\d+)\s*reps?\b/))){reps=+m[1];t=t.replace(m[0],' ')}
    const name=t.replace(/\b(sets?|reps?|of|for|both|all|each|did|i|and|the|forgot|weight|unknown|no|with|at|kg)\b/g,' ').replace(/[^a-z\s-]/g,' ').replace(/\s+/g,' ').trim();
    // only a match that covers every word is preselected; otherwise it starts as a new exercise of his own
    const mt=matchExercises(name);
    return {line,name,sets:Math.min(10,Math.max(1,sets)),reps,w,cands:mt.ids,pick:mt.exact?0:mt.ids.length};
  });
}
function matchExercises(name){
  if(!name) return {ids:[],exact:false};
  const toks=name.split(' ').filter(x=>x.length>1), seen=lastSeenMap();
  const hits=Object.keys(EX).map(id=>{const n=(EX[id].n+' '+GROUPS[EX[id].g]).toLowerCase();const hit=toks.filter(w=>n.includes(w)).length;
    return {id,all:hit===toks.length,s:hit/Math.max(1,toks.length)-n.split(' ').length*0.01+(seen[id]?0.15:0)+(EX[id].mine?0.2:0)}})
    .filter(x=>x.s>0.3).sort((a,b)=>b.s-a.s).slice(0,4);
  return {ids:hits.map(x=>x.id),exact:!!(hits[0]&&hits[0].all)};
}
function openTextLog(){
  const t=S.textLog||(S.textLog={text:'',rows:null});
  const rows=t.rows;
  document.getElementById('layer').innerHTML=`<div class="scrim" data-act="close"><div class="sheet" role="dialog" aria-modal="true" aria-label="Log from text">
    <div class="grab"></div>
    <div class="row between"><h2 class="sheet-h">Log from text</h2><button class="iconbtn" data-act="closebtn" aria-label="Close">✕</button></div>
    <div class="small muted">For work you didn't tick. One exercise per line; dictation works. Missing weights stay unknown.</div>
    <textarea class="inp" id="tl-text" rows="4" placeholder="preacher curl 2x10 20kg&#10;bayesian curl 3x10&#10;cable hammer curl 1x10">${esc(t.text)}</textarea>
    <button class="btn" data-act="tlparse">Check it</button>
    ${rows?(rows.length?`<div>${rows.map((r,i)=>{const id=r.cands[r.pick||0];return `<div class="tlrow">
      <button class="pk" data-act="tlcycle" data-i="${i}" style="border-top:0;padding:4px 0"><div class="pn">${id?esc(EX[id].n):`New: ${esc(r.name||'?')}`}</div><div class="pm">${r.cands.length>1||!id?'Tap to change the match':'Matched'} · “${esc(r.line)}”</div></button>
      <div class="num small">${r.sets} × ${r.reps??'?'} reps · ${r.w!=null?fmtW(r.w)+' kg':'weight unknown'}</div></div>`}).join('')}</div>
      ${rows.some(r=>r.reps==null)?'<div class="err">Some lines have no reps. Add them, like “3x10”.</div>':''}
      <button class="btn pri" data-act="tlsave"${rows.some(r=>r.reps==null)?' disabled':''}>Add to ${S.date===todayKey()?'today':nice(S.date)}</button>`:'<div class="muted">Nothing found. Try “curl 3x10”.</div>'):''}
  </div></div>`;
}

/* ---------- regular meals ---------- */
function logRegular(k,id){
  const f=S.foods[id]; if(!f) return;
  const now=new Date(), day=editDay(k);
  day.meals=(day.meals||[]).concat({id:uid(),t:`${pad(now.getHours())}:${pad(now.getMinutes())}`,name:f.name,kcal:f.kcal,p:f.p,c:f.c,f:f.f,conf:'saved',tip:'',items:f.items||[],photos:[],src:'regular'});
  render(); toast(`Logged ${f.name}: ${Math.round(f.kcal)} kcal, ${Math.round(f.p)} g protein`);
}

// the session summary shows the same decision the exercise card will show next time
function nextTargets(k){
  const day=getDay(k), lu=lineupOf(k), next=addDays(k,1);
  return lu.map(sl=>{const ex=exOf(sl.ex);
    if(sl.skip) return `<div class="muted"><b>${esc(ex.n)}</b> · skipped</div>`;
    if(!doneSets(day,sl.ex).length) return `<div class="muted"><b>${esc(ex.n)}</b> · not logged</div>`;
    const v=decide(sl.ex,sl,next); return `<div class="${v.up?'up':v.down?'down':''}"><b>${esc(ex.n)}</b> · ${esc(v.head)}. ${esc(v.why)}</div>`}).join('')
    +(day.full?day.full.filter(f=>!lu.some(s=>s.ex===f.ex)).map(f=>`<div class="muted"><b>${esc(exOf(f.ex).n)}</b> · left out (short session)</div>`).join(''):'');
}
function setMenuRow(id,i,cur,prev){
  const key=`${id}|${i}`, on=c=>c?' on':'';
  return `<div class="setmenu">
    <div class="small muted">Reps left in the tank? 2 = you could have done 2 more clean reps.</div>
    <div class="chips">${[0,1,2,3,4,'u'].map(v=>`<button class="chipb${on(cur.rir!=null&&String(cur.rir)===String(v))}" data-act="rir" data-k="${key}" data-v="${v}">${v==='u'?'Unsure':v===4?'4+':v}</button>`).join('')}</div>
    <div class="chips">${prev&&num(prev.r)!=null?`<button class="chipb" data-act="setflag" data-f="same" data-k="${key}">Same as set ${i}</button>`:''}<button class="chipb${on(cur.wu0)}" data-act="setflag" data-f="wunk" data-k="${key}">Weight unknown</button><button class="chipb${on(isWU(cur))}" data-act="setflag" data-f="wu" data-k="${key}">Warm-up</button><button class="chipb${on(cur.pain)}" data-act="setflag" data-f="pain" data-k="${key}">⚠ Pain / form</button><button class="chipb" data-act="setflag" data-f="clear" data-k="${key}">Clear</button></div>
  </div>`;
}
const rirRow = (id,i)=>`<div class="setmenu"><div class="small muted">Reps left in the tank? Optional. 2 = you could have done 2 more clean reps.</div>
  <div class="chips">${[0,1,2,3,4,'u'].map(v=>`<button class="chipb" data-act="rir" data-k="${id}|${i}" data-v="${v}">${v==='u'?'Unsure':v===4?'4+':v}</button>`).join('')}</div></div>`;
// a guessed muscle group for exercises typed in from text that the library doesn't know
function guessGroup(name){const n=String(name).toLowerCase();for(const [w,g] of [['curl','biceps'],['tricep','triceps'],['extension','triceps'],['pushdown','triceps'],['crunch','core'],['ab','core'],['plank','core'],['calf','calves'],['squat','quads'],['lunge','quads'],['leg press','quads'],['deadlift','hams'],['ham','hams'],['glute','glutes'],['hip','glutes'],['row','back'],['pull','back'],['lat','back'],['raise','shoulders'],['shoulder','shoulders'],['press','chest'],['fly','chest'],['bench','chest']])if(n.includes(w))return g;return 'core'}
function openShort(){
  document.getElementById('layer').innerHTML=`<div class="scrim" data-act="close"><div class="sheet" role="dialog" aria-modal="true" aria-label="Short session">
    <div class="grab"></div>
    <div class="row between"><h2 class="sheet-h">How long have you got?</h2><button class="iconbtn" data-act="closebtn" aria-label="Close">✕</button></div>
    <div class="small muted">Keeps the big lifts first, then the muscles you've hit least this week${prioOf().length?` (priorities: ${prioOf().map(g=>GROUPS[g]).join(', ')})`:''}. Sets you already ticked stay logged.</div>
    <div class="row">${[30,45,60].map(m=>`<button class="btn pri" data-act="shortgo" data-m="${m}" style="flex:1">${m} min</button>`).join('')}</div>
  </div></div>`;
}
const lastWaist = ()=>{const ks=Object.keys(S.days).filter(k=>num(S.days[k].waist)).sort();return ks.length?num(S.days[ks[ks.length-1]].waist):null};
