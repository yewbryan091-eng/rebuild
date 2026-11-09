/* ============ workouts: split, customs, next up ============ */
// The split rotates instead of following weekdays: miss a day and the next workout simply waits for you.
const ROT = ['push','pull','legsA','cb','arms','legsB'];
const CUSTOM_CARDIO = {type:'Incline walk',min:15,how:'12% incline, 5–5.5 km/h, after lifting'};
const LEG_GROUPS = ['quads','hams','glutes','calves','hips'];
const hasWork = d=>!!d&&(!!d.finished||setsDone(d)>0);
const isCustom = pid=>pid==='custom'||String(pid).startsWith('c_');
// built-in plans, saved custom workouts (c_<id>) and one-off customs ('custom', named per day)
function PI(pid,k){
  if(PLANS[pid]) return PLANS[pid];
  const c=String(pid).startsWith('c_')?S.customs[pid.slice(2)]:null;
  const day=k?getDay(k):{};
  const lu=(k&&day.lineup)||(c&&c.lineup)||[];
  const gs=[...new Set(lu.map(s=>exOf(s.ex).g))];
  return {n:(c&&c.name)||day.cname||'Custom',col:'orange',custom:true,
    m:gs.length?gs.slice(0,4).map(g=>GROUPS[g]).join(' · '):'Build it your way',
    wu:gs.some(g=>LEG_GROUPS.includes(g))?PLANS.legsA.wu:PLANS.push.wu,ex:[],cardio:CUSTOM_CARDIO};
}
const planAt = k=>PI(planOf(k),k);
const planLabel = (pid,k)=>PLAN_LABEL[pid]||PI(pid,k).n;
function planOf(k){
  const d=getDay(k);
  if(d.plan) return d.plan;
  if(k<todayKey()) return hasWork(d)?SCHED[dowOf(k)]:'rest';
  return nextUp(k);
}
// sessions of k's week still to do, in the coach's order
function weekLeft(k){
  const mon=mondayOf(k), wk=S.weeks[mon];
  if(!wk||!Array.isArray(wk.sessions)||!wk.sessions.length) return [];
  const left=wk.sessions.map(s=>s.plan);
  Object.keys(S.days).filter(x=>x>=mon&&x<k&&hasWork(S.days[x])).sort().forEach(x=>{const i=left.indexOf(planOf(x));if(i>=0)left.splice(i,1)});
  return left;
}
function rotNext(k){
  const last=Object.keys(S.days).filter(x=>x<k&&hasWork(S.days[x])&&ROT.includes(planOf(x))).sort().pop();
  return last?ROT[(ROT.indexOf(planOf(last))+1)%ROT.length]:'push';
}
function nextUp(k){
  if(k>todayKey()){const wk=S.weeks[mondayOf(k)];const s=wk&&(wk.sessions||[]).find(s=>s.day===k);return s?s.plan:'rest'}
  return weekLeft(k)[0]||rotNext(k);
}
const weekTarget = mon=>{const wk=S.weeks[mon];return wk&&wk.sessions&&wk.sessions.length?wk.sessions.length:4};
const coachNote = k=>{const wk=S.weeks[mondayOf(k)];if(!wk)return '';const pid=planOf(k);const s=(wk.sessions||[]).find(s=>s.day===k&&s.plan===pid)||(wk.sessions||[]).find(s=>s.plan===pid);return s&&s.note||''};
const coachLift = (k,id)=>{const wk=S.weeks[mondayOf(k)];return wk&&wk.lifts&&wk.lifts[id]||''};
const planGroups = k=>PLAN_GROUPS[planOf(k)]||[...new Set(lineupOf(k).map(s=>exOf(s.ex).g))];
// days trained under the old weekday split keep the workout they were
function freezeOldPlans(){
  const t=todayKey();
  for(const k in S.days){const d=S.days[k]; if(k<t&&!d.plan&&hasWork(d)){d.plan=SCHED[dowOf(k)];queueSave('days/'+k)}}
}

function openWorkouts(){
  const k=S.date, cur=planOf(k), day=getDay(k), nu=k>=todayKey()?nextUp(k):null;
  const row=(pid,label,col,extra='')=>`<button class="wo${pid===cur?' on':''}" data-act="setplan" data-p="${esc(pid)}" style="${PV(col)}"><span class="dot"></span><span>${esc(label)}${extra}</span><span class="small muted">${pid===cur?'Today':''}</span></button>`;
  const cs=Object.entries(S.customs).sort((a,b)=>(a[1].name||'').localeCompare(b[1].name||''));
  const hasSets=setsDone(day)>0;
  document.getElementById('layer').innerHTML=`<div class="scrim" data-act="close"><div class="sheet" role="dialog" aria-modal="true" aria-label="Choose workout">
    <div class="grab"></div>
    <div class="row between"><h2 class="sheet-h">Choose workout</h2><button class="iconbtn" data-act="closebtn" aria-label="Close">✕</button></div>
    ${hasSets?'<div class="small muted">Sets you already ticked today stay logged.</div>':''}
    ${nu?`<div class="label">Next up</div>${row(nu,planLabel(nu,k),PI(nu,k).col,S.weeks[mondayOf(k)]?' <span class="small muted">· coach plan</span>':'')}`:''}
    <div class="label">Your split</div>
    ${PLAN_ORDER.map(p=>row(p,PLAN_LABEL[p],PLANS[p].col)).join('')}
    <div class="label">Your workouts</div>
    ${cs.length?cs.map(([id,c])=>`<div class="row" style="gap:6px">${row('c_'+id,c.name||'Custom','orange',` <span class="small muted">· ${c.lineup.length} exercises</span>`)}<button class="iconbtn" data-act="delcustom" data-id="${esc(id)}" aria-label="Delete ${esc(c.name||'workout')}">${S.confirmCustom===id?'?':'✕'}</button></div>`).join(''):'<div class="small muted">Build one below. Finish it once and you can save it here to repeat.</div>'}
    ${S.confirmCustom?'<div class="small muted">Tap ? again to delete that workout. Past sessions stay logged.</div>':''}
    <button class="btn pri" data-act="newcustom">+ Build a custom workout</button>
  </div></div>`;
}

/* ============ sign in + sync sheet ============ */
const authForm = ()=>`<div class="auth">
    <label>Email<input class="inp" id="au-e" type="email" autocomplete="email" inputmode="email" autocapitalize="off"></label>
    <label>Password<input class="inp" id="au-p" type="password" autocomplete="current-password"></label>
    <div class="row"><button class="btn pri" data-act="signin">Sign in</button><button class="btn" data-act="signup">Create account</button></div>
    <div id="au-msg" class="small muted" role="status"></div></div>`;
const viewAuth = ()=>`<section class="hero" style="${PV('red')}"><div class="ring"></div><div class="eyebrow">Rebuild</div><h1>Sign in</h1>
    <div class="sub">Once. After that it works in the gym with no signal and syncs when you’re back online.</div></section>
  <section class="card"><h2>Your account</h2><div class="small muted">First time on this app? Use Create account. It only allows one account: yours.</div>${authForm()}</section>`;
function authMsg(t,bad){const el=document.getElementById('au-msg');if(el){el.textContent=t;el.className=bad?'err':'small muted'}}
async function authGo(kind){
  const e=(document.getElementById('au-e')?.value||'').trim(), p=document.getElementById('au-p')?.value||'';
  if(!sb){authMsg('Sync couldn’t load. Check your connection and reopen the app.',true);return}
  if(!e||p.length<8){authMsg('Enter your email and a password of at least 8 characters.',true);return}
  if(!navigator.onLine){authMsg('You need signal to sign in the first time.',true);return}
  authMsg(kind==='signup'?'Creating your account…':'Signing in…');
  try{
    if(kind==='signup'){
      const {data,error}=await sb.auth.signUp({email:e,password:p}); if(error) throw error;
      if(!data.session){const r=await sb.auth.signInWithPassword({email:e,password:p}); if(r.error) throw r.error}
    } else {const {error}=await sb.auth.signInWithPassword({email:e,password:p}); if(error) throw error}
  }catch(err){
    const m=String(err&&err.message||'');
    authMsg(/already registered|already has an owner|database error/i.test(m)?'This app already has its account. Use Sign in.':/not confirmed/i.test(m)?'Check your email for the confirm link, tap it, then sign in here.':/invalid login/i.test(m)?'Wrong email or password.':m||'Couldn’t sign in. Try again.',true);
  }
}
function openAccount(){
  const n=Object.keys(outbox).length, t=S.lastSync?new Date(S.lastSync):null;
  document.getElementById('layer').innerHTML=`<div class="scrim" data-act="close"><div class="sheet" role="dialog" aria-modal="true" aria-label="Sync">
    <div class="grab"></div>
    <div class="row between"><h2 class="sheet-h">Sync</h2><button class="iconbtn" data-act="closebtn" aria-label="Close">✕</button></div>
    ${S.user?`<div>Signed in as <b>${esc(S.user.email||'you')}</b></div>
      <div class="small muted">${navigator.onLine?'Online':'Offline: everything saves on this phone and syncs when you’re back.'}${n?` · ${n} change${n>1?'s':''} waiting`:''}${t?` · last synced ${pad(t.getHours())}:${pad(t.getMinutes())}`:''}</div>
      ${S.syncErr&&navigator.onLine?`<div class="err">${esc(S.syncErr)}</div>`:''}
      <div class="row"><button class="btn pri" data-act="syncnow">Sync now</button><button class="btn ghost" data-act="signout">Sign out</button></div>
      <div class="small muted">Signing out keeps this phone’s copy. Changes made while signed out sync after you sign back in.</div>`
    :`<div class="small muted">Sign in to back up your log and use Claude for meals and your weekly plan.</div>${authForm()}`}
  </div></div>`;
}

/* ============ meals estimated later ============ */
function mealPrompt(mode,n,note){
  const age=num(S.profile.age);
  return `You are a sports nutritionist estimating one meal for a ${age?age+'-year-old ':''}man in Malaysia who is cutting fat while lifting most days of the week.
${mode==='photo'?`The ${n} photo${n>1?'s show the SAME meal from different angles':' shows the meal'}. Identify every food and drink, estimate portions using visual scale (a standard plate is about 26 cm, also use spoons, hands, cups, packaging), and estimate calories and macros.`:'Estimate calories and macros from this description.'}
Local dishes are common (nasi lemak, chicken rice, mamak, economy rice/nasi campur, kopitiam drinks, mixed rice). Count cooking oil, gravy, sambal, sauces and sugar in drinks; these are usually underestimated. If something is ambiguous, assume the typical Malaysian hawker portion.
Protein check: cooked lean meat and fish give about 25-30 g protein per 100 g. A hawker chicken breast is about 120-170 g cooked, and an ordinary plate of chicken rice is only 25-35 g protein in total. Sliced meat fanned over rice looks like more than it is, so judge its real volume. When unsure of a portion, use the middle of the plausible range for calories and the lower-middle for protein, because overstating protein hides a shortfall.
${note?`His note: "${String(note).slice(0,600)}"`:''}
Reply with only JSON in this shape:
{"name":"short meal name","items":[{"food":"...","portion":"e.g. 1.5 cups / 180 g","kcal":0,"protein":0,"carbs":0,"fat":0}],"total":{"kcal":0,"protein":0,"carbs":0,"fat":0},"kcalLow":0,"kcalHigh":0,"confidence":"low|medium|high","notes":"one short sentence on what is uncertain","tip":"one practical sentence to make this meal fit a high-protein fat-loss diet"}`;
}
const resOf = r=>{const tot=r&&r.total||{};return {name:r.name||'Meal',items:Array.isArray(r.items)?r.items:[],confidence:r.confidence||'',notes:r.notes||'',tip:r.tip||'',kcalLow:+r.kcalLow||0,kcalHigh:+r.kcalHigh||0,
  kcal:Math.round(+tot.kcal||0),p:Math.round(+tot.protein||0),c:Math.round(+tot.carbs||0),f:Math.round(+tot.fat||0)}};
const mealItems = items=>(items||[]).slice(0,12).map(it=>({food:String(it.food||'').slice(0,80),portion:String(it.portion||'').slice(0,60),kcal:Math.round(+it.kcal||0),protein:Math.round(+it.protein||0)}));
let estimating=false;
async function estimatePending(){
  if(estimating||!S.user||!navigator.onLine) return;
  estimating=true;
  try{
    for(const k of Object.keys(S.days).sort()) for(const m of (S.days[k].meals||[])){
      if(!m.pending) continue;
      const blobs=[]; for(const id of m.photos||[]){try{const rec=await photoGet(id);if(rec)blobs.push(rec.blob)}catch(e){}}
      if(!blobs.length) continue; // photos live on another phone; that phone will estimate it
      try{
        const r=resOf(await aiJSON(mealPrompt('photo',blobs.length,m.note),{images:blobs}));
        Object.assign(m,{name:r.name.slice(0,80),kcal:r.kcal,p:r.p,c:r.c,f:r.f,conf:r.confidence,tip:r.tip,items:mealItems(r.items)});
        delete m.pending; delete m.pendErr; editDay(k); requestRender();
        toast(`Estimated your ${m.t} meal: ${m.name}, ${m.kcal} kcal, ${m.p} g protein`);
      }catch(e){
        if(['offline','signed_out','no_key','bad_key','no_credit','rate_limited'].includes(e&&e.code)) return;
        m.pendErr=errMsg(e); requestRender();
      }
    }
  }finally{estimating=false}
}

/* ============ weekly coach ============ */
// Sunday evening (or the first time the app opens in a week with no plan), Claude reviews the last 4 weeks and plans the next.
let coaching=null;
function coachPrompt(mon){
  const today=todayKey(), from=addDays(mondayOf(today),-28), end=addDays(mon,6);
  const firstDay=mon>today?mon:today;
  const pr=S.profile, tg=targets(), lw=latestWeight();
  const log=Object.keys(S.days).filter(k=>k>=from&&k<=today).sort().map(k=>{
    const d=S.days[k], parts=[], ids=exOrder(k), pid=planOf(k);
    if(ids.length) parts.push(`${planLabel(pid,k)}${d.finished?` (finished${d.finished.dur?`, ${d.finished.dur} min`:''})`:' (not marked finished)'}${d.full?' short session':''}: `+ids.map(id=>`${exOf(id).n} [${id}] ${fmtSets(id,doneSets(d,id),', ')}`).join('; '));
    else if(d.plan&&d.plan!=='rest') parts.push(`${planLabel(pid,k)} opened, nothing logged`);
    if(d.cardio&&d.cardio.done) parts.push(`cardio ${d.cardio.min||'?'} min`);
    if(num(d.steps)) parts.push(`${num(d.steps)} steps`);
    if(num(d.bw)) parts.push(`weighed ${num(d.bw)} kg`);
    if((d.meals||[]).length){const t=mealTotals(d);parts.push(`food: ${d.meals.length} meal${d.meals.length>1?'s':''} logged, ${Math.round(t.kcal)} kcal, ${Math.round(t.p)} g protein`)}
    return parts.length?`${k} ${DOW[dowOf(k)].slice(0,3)}: ${parts.join(' | ')}`:null;
  }).filter(Boolean);
  const plans=ROT.map(p=>`${p} = ${PLAN_LABEL[p]}: ${tplOf(p).map(s=>`${exOf(s.ex).n} [${s.ex}] ${s.sets}×${s.lo}-${s.hi}`).join(', ')}`)
    .concat(Object.entries(S.customs).map(([id,c])=>`c_${id} = ${c.name} (his custom): ${c.lineup.map(s=>`${exOf(s.ex).n} [${s.ex}] ${s.sets}×${s.lo}-${s.hi}`).join(', ')}`));
  const prev=S.weeks[addDays(mon,-7)];
  const scan=S.scans[0];
  const days=[]; for(let k=firstDay;k<=end;k=addDays(k,1)) days.push(`${k} ${DOW[dowOf(k)]}`);
  return `You are the strength coach inside Bryan's gym app. He is ${num(pr.age)||21}, ${num(pr.height)||'?'} cm, latest weight ${lw||'?'} kg${num(pr.bf)?`, ${num(pr.bf)}% body fat`:''}. Goal: get back to a lean, muscular physique: lose fat while keeping and building muscle.
${scan?`Latest body scan ${scan.date}: ${scan.weightKg??'?'} kg, ${scan.bodyFatPct??'?'}% fat, muscle ${scan.muscleKg??'?'} kg.`:''}
Current daily targets: ${tg?`${tg.kcal} kcal, ${tg.protein} g protein`:'not set'}. Step target 8,000-10,000.
Today is ${today} (${DOW[dowOf(today)]}). Plan the days ${firstDay} to ${end}.

His log, last 4 weeks (days not listed had nothing logged: treat them as unknown, not as zero food or a rest choice):
${log.join('\n')||'(nothing logged yet)'}

Workouts he can do (id = name: exercises):
${plans.join('\n')}
${prev?`Last week's plan was ${prev.sessions.length} sessions: ${prev.sessions.map(s=>s.plan).join(', ')}.`:''}

How to plan:
- Be realistic. Count the sessions he actually did in the last 2 weeks. Plan at most one more than that, never fewer than 3 or more than 6 for a full week, and fewer if only part of the week is left. A plan he completes beats a plan he skips.
- Use the split ids above (custom ids only if he has been using them). Spread muscle groups so the same muscles get at least 48 hours between sessions. Put each session on a day from the list.
- Lifts: give a target for the main lifts of the planned sessions, based on his latest sets and double progression: when every work set reached the top of the rep range, add the smallest jump (2.5 kg barbell, 2 kg dumbbells); otherwise keep the weight and add reps. If a lift went backwards twice in a row, drop about 10% and rebuild. Only use exercise ids from the log or the workout list.
- Calories: judge by his weight trend, not by logged food if fewer than 4 days of food were logged. Aim to lose 0.5-1% of bodyweight per week. With no weigh-ins, keep the current target and tell him to weigh in 3 mornings a week. Keep protein at least ${tg?tg.protein:140} g.
- Write to him directly, like a coach who knows him: short, plain words, no hype, no emojis.

Reply with only JSON in this shape:
{"summary":"2-3 sentences on how the last week went and what this week is about","wins":["up to 3 short wins, with numbers"],"fix":"the one thing to fix this week","sessions":[{"plan":"split id","day":"YYYY-MM-DD","note":"one short line: the focus of this session"}],"kcal":0,"protein":0,"steps":0,"lifts":{"exercise_id":"e.g. 92.5 kg × 6, 6, 6"}}`;
}
async function runCoach(mon,auto){
  if(coaching) return;
  coaching=mon; S.coachErr=''; requestRender();
  try{
    const r=await aiJSON(coachPrompt(mon),{effort:'high'});
    const t=todayKey(), end=addDays(mon,6);
    const ok=p=>PLANS[p]&&p!=='rest'||(String(p).startsWith('c_')&&S.customs[String(p).slice(2)]);
    const sessions=(Array.isArray(r.sessions)?r.sessions:[]).filter(s=>s&&ok(s.plan)).slice(0,7)
      .map(s=>({plan:s.plan,day:/^\d{4}-\d{2}-\d{2}$/.test(s.day||'')&&s.day>=mon&&s.day<=end&&s.day>=t?s.day:null,note:String(s.note||'').slice(0,140)}));
    const lifts={}; if(r.lifts&&typeof r.lifts==='object') for(const [id,v] of Object.entries(r.lifts)) if(EX[id]) lifts[id]=String(v).slice(0,80);
    // keep the coach's numbers inside sane bounds before they drive the targets
    const within=(v,lo,hi)=>{const n=num(v);return n!=null&&n>=lo&&n<=hi?Math.round(n):null};
    S.weeks[mon]={at:new Date().toISOString(),summary:String(r.summary||'').slice(0,700),wins:(Array.isArray(r.wins)?r.wins:[]).slice(0,3).map(x=>String(x).slice(0,160)),
      fix:String(r.fix||'').slice(0,260),sessions,kcal:within(r.kcal,1400,3500),protein:within(r.protein,80,300),steps:within(r.steps,3000,20000),lifts};
    queueSave('weeks/'+mon);
    toast(auto?'Your coach planned the week. It’s on the Log tab.':'Week planned.');
  }catch(e){S.coachErr=errMsg(e)}
  coaching=null; requestRender();
}
function coachCheck(){
  if(coaching||!S.user||!navigator.onLine) return;
  if(!Object.values(S.days).some(hasWork)) return; // nothing to coach from yet
  const t=todayKey(), mon=mondayOf(t), next=addDays(mon,7), sundayNight=dowOf(t)===0&&new Date().getHours()>=18;
  const target=sundayNight?(S.weeks[next]?null:next):(S.weeks[mon]?null:mon);
  if(!target||S.coachTried===target) return;
  S.coachTried=target; runCoach(target,true);
}
function coachCard(mon){
  const wk=S.weeks[mon], t=todayKey(), thisMon=mondayOf(t), next=addDays(thisMon,7);
  const busy=coaching===mon, err=S.coachErr?`<div class="err">${esc(S.coachErr)}</div>`:'';
  let h='';
  if(wk){
    const done=Object.keys(S.days).filter(x=>x>=mon&&x<=addDays(mon,6)&&hasWork(S.days[x])).sort().map(x=>planOf(x));
    const rows=wk.sessions.map(s=>{const i=done.indexOf(s.plan);if(i>=0)done.splice(i,1);const pl=PI(s.plan);
      return `<div class="csess" style="${PV(pl.col)}"><span class="small muted">${s.day?`${DOW[dowOf(s.day)].slice(0,3)} ${nice(s.day)}`:'Any day'}</span><div><span class="pill">${esc(planLabel(s.plan))}</span>${s.note?`<div class="small muted" style="margin-top:3px">${esc(s.note)}</div>`:''}</div><span class="${i>=0?'up':'muted'}">${i>=0?'✓':''}</span></div>`}).join('');
    h=`<section class="card"><div class="row between"><h2>Coach</h2><span class="small muted">Week of ${nice(mon)}</span></div>
      ${wk.summary?`<div>${esc(wk.summary)}</div>`:''}
      ${(wk.wins||[]).length?`<div class="small up">${wk.wins.map(esc).join('<br>')}</div>`:''}
      ${wk.fix?`<div class="hint"><b>Fix this week:</b> ${esc(wk.fix)}</div>`:''}
      <div>${rows}</div>
      <div class="small muted num">${[wk.kcal?`${wk.kcal.toLocaleString()} kcal`:'',wk.protein?`${wk.protein} g protein`:'',wk.steps?`${wk.steps.toLocaleString()} steps`:''].filter(Boolean).join(' · ')}${wk.kcal||wk.protein?' a day':''}</div>
      ${mon>=thisMon?`<button class="btn sm ghost" data-act="coach" data-mon="${mon}" style="align-self:flex-start"${busy?' disabled':''}>${busy?'Planning…':'Plan again'}</button>`:''}${err}</section>`;
  } else if(mon===thisMon||mon===next){
    h=`<section class="card"><h2>Coach</h2><div class="small muted">Claude reviews your last 4 weeks of lifts, food, weight and steps, then sets this week’s sessions, lift targets and calories.${mon===thisMon?' It runs by itself every Sunday evening.':''}</div>
      <button class="btn pri" data-act="coach" data-mon="${mon}" style="align-self:flex-start"${busy?' disabled':''}>${busy?'Planning… about a minute':mon===thisMon?'Plan this week':'Plan next week'}</button>${err}</section>`;
  }
  if(mon===thisMon&&dowOf(t)===0&&!S.weeks[next]) h+=coachCard(next);
  return h;
}
