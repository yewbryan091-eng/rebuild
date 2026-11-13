#!/usr/bin/env python3
"""Builds index.html (the offline home-screen app) from the last Claude-artifact version of Rebuild.
Every edit is an exact-text replacement that must match once, so a changed source fails loudly."""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent
src = (ROOT / 'src/artifact-v8.html').read_text()
DATA = (ROOT / 'parts/data.js').read_text()
PLANS_JS = (ROOT / 'parts/plans.js').read_text()

def rep(old, new, count=1):
    global src
    n = src.count(old)
    if n != count:
        sys.exit(f'expected {count} match(es), found {n}:\n{old[:160]}')
    src = src.replace(old, new)

def cut(start, end, new):
    """replace from `start` up to (not including) `end`"""
    global src
    a = src.find(start); b = src.find(end, a)
    if a < 0 or b < 0 or src.count(start) != 1:
        sys.exit(f'cut failed: {start[:80]}')
    src = src[:a] + new + src[b:]

# ---------- head: real document head, manifest, home-screen metas, local fonts ----------
fonts = re.sub(r'url\(fonts/', 'url(fonts/', (ROOT / 'fonts/fonts.css').read_text())
reset = re.search(r'<style>(:root\{color-scheme:light;.*?)</style></head><body>', src).group(1)
head_end = src.index('<style>\n/* Layout:')
src = f'''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Rebuild</title>
<meta name="theme-color" content="#ECEEF0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0F1113" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Rebuild">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" href="icons/icon-192.png">
<style>{fonts}</style>
<style>{reset}</style>
<script src="vendor/supabase.js"></script>
''' + src[head_end:]
rep('</style>\n\n<div class="top">', '</style>\n</head><body>\n\n<div class="top">')

# ---------- styles ----------
rep('--c-grey:#7D868F;', '--c-grey:#7D868F; --c-orange:#C9561A;')
rep('--c-grey:#8A939B;', '--c-grey:#8A939B; --c-orange:#F08A3C;', 2)
rep('@media (prefers-reduced-motion: reduce)', '''/* workout chooser, coach, sign-in */
button.sync{background:none;border:0;padding:6px 2px;font-size:12px;color:var(--muted)}
.wbtn{align-self:flex-start;margin-top:6px;border:0;border-radius:8px;padding:7px 11px;font-weight:700;font-size:14px;background:color-mix(in srgb,var(--on-plate) 16%,transparent);color:var(--on-plate)}
.wo{display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;text-align:left;background:none;border:0;border-top:1px solid var(--line);padding:12px 2px;font-size:16px;font-weight:600}
.wo .dot{width:12px;height:12px;border-radius:50%;background:var(--plate)}
.wo.on{color:var(--plate)}
.row>.wo{flex:1;min-width:0}
.csess{display:grid;grid-template-columns:62px minmax(0,1fr) 20px;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--line)}
.auth{display:flex;flex-direction:column;gap:10px}
.auth label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted)}
.pending{font-size:14px;color:var(--warn)}
@media (prefers-reduced-motion: reduce)''')
rep('<div class="sync busy" id="sync"><i></i><span>Loading</span></div>',
    '<button class="sync busy" id="sync" data-act="account" aria-label="Sync status"><i></i><span>Loading</span></button>')

# ---------- plans: walk day instead of rest ----------
rep("rest:{n:'Rest',col:'grey',m:'Recover · walk · mobility'", "rest:{n:'Walk day',col:'grey',m:'Steps · walk · mobility'")
rep("arms:'Arms',legsB:'Legs B (deadlift)',rest:'Rest'}", "arms:'Arms',legsB:'Legs B (deadlift)',rest:'Walk day'}")

# ---------- data layer ----------
cut('/* ============ state + storage ============ */', '/* ============ derived ============ */', DATA + '\n')
rep("const planOf = k=>getDay(k).plan||SCHED[dowOf(k)];\n", '')
rep("const tplOf = pid=>(S.tpl[pid]&&S.tpl[pid].lineup)||PLANS[pid].ex.map(([ex,sets,lo,hi,rest])=>({ex,sets,lo,hi,rest}));",
    "const tplOf = pid=>{const c=String(pid).startsWith('c_')&&S.customs[pid.slice(2)];return (S.tpl[pid]&&S.tpl[pid].lineup)||(c?c.lineup:PLANS[pid]?PLANS[pid].ex.map(([ex,sets,lo,hi,rest])=>({ex,sets,lo,hi,rest})):[])};")
rep("function lineupFor(d,k){if(!d.lineup)d.lineup=clone(tplOf(planOf(k)));return d.lineup}",
    "// the first edit pins the day's workout, so the rotation never relabels a session after it starts\nfunction lineupFor(d,k){if(!d.plan)d.plan=planOf(k);if(!d.lineup)d.lineup=clone(tplOf(d.plan));return d.lineup}")
rep('/* ============ rendering ============ */', PLANS_JS + '\n/* ============ rendering ============ */')
rep("  if(num(pr.kcalOv)) kcal=num(pr.kcalOv);",
    "  const wk=S.weeks[mondayOf(todayKey())];\n  if(wk&&wk.kcal){kcal=wk.kcal;how+=' (this week’s calories come from your coach)'}\n  if(wk&&wk.protein) protein=wk.protein;\n  if(num(pr.kcalOv)) kcal=num(pr.kcalOv);")

# ---------- render ----------
rep('''function render(){
  const k=S.date, plan=PLANS[planOf(k)];''', '''function render(){
  const k=S.date, authOnly=!S.user&&!Object.keys(S.days).length, plan=authOnly?PLANS.push:planAt(k);''')
rep('''  const v=document.getElementById('view');
  v.innerHTML = S.tab==='today'?viewToday(k):S.tab==='log'?viewLog(k):S.tab==='food'?viewFood(k):viewBody(k);
  mountFigs(v); setSync(); renderRest();''', '''  document.getElementById('dock').hidden=authOnly;
  document.querySelector('.datenav').style.visibility=authOnly?'hidden':'';
  const v=document.getElementById('view');
  if(authOnly){v.innerHTML=S.mode==='loading'?'':viewAuth();setSync();return}
  v.innerHTML = S.tab==='today'?viewToday(k):S.tab==='log'?viewLog(k):S.tab==='food'?viewFood(k):viewBody(k);
  mountFigs(v); hydratePhotos(v); setSync(); renderRest();''')

# ---------- train tab ----------
cut('function viewToday(k){', '  // warm-up\n', '''function viewToday(k){
  const day=getDay(k), pid=planOf(k), plan=PI(pid,k), lu=lineupOf(k);
  const start=S.profile.start||todayKey();
  const dayN=Math.max(1,daysBetween(start,k)+1);
  const mon=mondayOf(k); let wkDone=0; for(let i=0;i<7;i++){const kk=addDays(mon,i);if(planOf(kk)!=='rest'&&trained(kk))wkDone++}
  const isNext=!day.plan&&k>=todayKey()&&pid!=='rest';
  const pk=prevSession(k,pid), cn=coachNote(k);
  let motiv='';
  if(cn) motiv=`Coach: ${cn}`;
  else if(pid==='rest'&&!lu.length) motiv='No lifting today: hit your steps, eat your protein, sleep 7+ hours.';
  else if(plan.custom&&!lu.length) motiv='Add your exercises below, in the order you’ll do them.';
  else if(pk) motiv=`Last ${plan.n} day (${nice(pk)}): ${dayVolume(S.days[pk]).toLocaleString()} kg moved. Beat it.`;
  else motiv=`First ${plan.n} day of the rebuild. Log every set, the numbers will do the talking.`;
  const prog=dayProgress(k), vol=dayVolume(day);
  let h=`<section class="hero" style="${PV(plan.col)}"><div class="ring"></div>
    <div class="eyebrow">${DOW[dowOf(k)]} · ${nice(k)} · Rebuild day ${dayN}</div>
    <h1>${esc(plan.n)}</h1><div class="sub">${esc(plan.m)}</div>
    <div class="meta">${isNext?'<span class="chip">Next up</span>':''}<span class="chip num">This week ${wkDone}/${weekTarget(mon)}</span>${lu.length?`<span class="chip num">${prog.done}/${prog.total} sets</span>`:''}${vol?`<span class="chip num">${vol.toLocaleString()} kg</span>`:''}${day.finished?'<span class="chip">Done ✓</span>':''}</div>
    <div class="motiv">${esc(motiv)}</div>
    ${day.finished?'':'<button class="wbtn" data-act="workouts">Change workout ▾</button>'}
  </section>`;
  if(k===todayKey()&&!num(day.bw)&&!day.finished) h+=`<section class="card"><div class="row between"><h3>Morning weigh-in</h3><label class="field" style="width:120px;flex:none"><input id="bw-t" type="number" inputmode="decimal" step="0.1" placeholder="${esc(latestWeight()||'')}" data-day="bw" aria-label="Today’s weight in kg"><span>kg</span></label></div><div class="small muted">After the toilet, before food. 3 mornings a week is enough for your coach.</div></section>`;
  if(day.finished) return h+doneCard(k)+cardioCard(k);
''')
rep('''  if(lu.length>1) h+=`<div class="exbar"><span class="label">${lu.length} exercises</span><button class="btn sm" data-act="order">⇅ Reorder · superset</button></div>`;''',
    '''  const canShort=!!day.full||runs(lu).length>3;
  if(lu.length>1||canShort) h+=`<div class="exbar"><span class="label">${lu.length} exercise${lu.length===1?'':'s'}</span><div class="row" style="gap:6px">${canShort?`<button class="btn sm" data-act="short">${day.full?'Full session':'⏱ Short'}</button>`:''}${lu.length>1?'<button class="btn sm" data-act="order">⇅ Reorder</button>':''}</div></div>`;''')
rep("  const day=getDay(k), plan=PLANS[planOf(k)], c=day.cardio||{};", "  const day=getDay(k), plan=planAt(k), c=day.cardio||{};")
rep("<div class=\"hint${sug.up?' up':''}${sug.down?' down':''}\">${esc(sug.text)}",
    "<div class=\"hint${sug.up?' up':''}${sug.down?' down':''}\">${esc(sug.text)}${coachLift(k,id)?`<div class=\"num\"><b>Coach:</b> ${esc(coachLift(k,id))}</div>`:''}")
rep("  const day=getDay(k), pid=planOf(k), plan=PLANS[pid], sm=summary(k), lu=lineupOf(k);\n  const nk=nextPlanDate(k,pid);",
    "  const day=getDay(k), pid=planOf(k), plan=PI(pid,k), sm=summary(k), lu=lineupOf(k);\n  const nk=nextPlanDate(k,pid);")

# ---------- log tab ----------
rep("const LOGF = [['all','All'],['push','Push'],['pull','Pull'],['legs','Legs'],['cb','Chest + Back'],['arms','Arms']];",
    "const LOGF = [['all','All'],['push','Push'],['pull','Pull'],['legs','Legs'],['cb','Chest + Back'],['arms','Arms'],['custom','Custom']];")
rep("const fitsF = (pid,f)=>f==='all'||(f==='legs'?pid.startsWith('legs'):pid===f);",
    "const fitsF = (pid,f)=>f==='all'||(f==='legs'?pid.startsWith('legs'):f==='custom'?isCustom(pid):pid===f);")
rep("    const kk=addDays(mon,i), pid=planOf(kk), plan=PLANS[pid], p=dayProgress(kk), day=getDay(kk), mt=mealTotals(day);",
    "    const kk=addDays(mon,i), pid=planOf(kk), plan=PI(pid,kk), p=dayProgress(kk), day=getDay(kk), mt=mealTotals(day), open=kk>todayKey()&&pid==='rest'&&!day.plan;")
rep("    const st=day.finished?'Done ✓':pid==='rest'?(p.cardio?'Walk done':'—'):`${p.done}/${p.total} sets`;",
    "    const st=open?'':day.finished?'Done ✓':pid==='rest'?(p.cardio?'Walk done':'—'):`${p.done}/${p.total} sets`;")
rep('''      <div><span class="pill">${esc(PLAN_LABEL[pid])}</span>${mt.kcal?''',
    '''      <div>${open?'<span class="small muted">Not planned</span>':`<span class="pill">${esc(planLabel(pid,kk))}</span>`}${mt.kcal?''')
rep("  let h=`<section class=\"card\"><div class=\"row between\"><h2>Week of ${nice(mon)}</h2>",
    "  let h=coachCard(mon)+`<section class=\"card\"><div class=\"row between\"><h2>Week of ${nice(mon)}</h2>")
rep("      <div class=\"stat\"><b>${ses}/6</b><span>Sessions</span></div>",
    "      <div class=\"stat\"><b>${ses}/${weekTarget(mon)}</b><span>Sessions</span></div>")
rep('''style="${PV(PLANS[pid].col)}"><div class="d">${DOW[dowOf(x)].slice(0,3)}<small>${nice(x)}</small></div>
        <div><span class="pill">${esc(PLAN_LABEL[pid])}</span>''',
    '''style="${PV(PI(pid,x).col)}"><div class="d">${DOW[dowOf(x)].slice(0,3)}<small>${nice(x)}</small></div>
        <div><span class="pill">${esc(planLabel(pid,x))}</span>''')

# ---------- food ----------
rep("  const canAI=!!sample;\n  const maxN=sampleLimits&&sampleLimits.images?sampleLimits.images.maxCount:0;",
    "  const canAI=true, maxN=AI_MAX_PHOTOS;")
rep("    if(d.err) h+=`<div class=\"err\">${esc(d.err)}</div>`;",
    "    if(d.err) h+=`<div class=\"err\">${esc(d.err)}</div>`;\n    if(d.mode==='photo'&&d.photos.length&&!res&&!d.busy) h+=`<button class=\"btn\" data-act=\"savelater\"${d.saving?' disabled':''}>Save now, estimate later</button>`;")
rep("      ${d.mode==='photo'&&!assets?'<div class=\"small muted\">Photos can’t be stored from this view; the numbers will still save.</div>':''}\n", '')
rep('''<button class="ph" data-act="lightbox" data-src="/_blob/${esc(id)}" style="padding:0;border:0"><img src="/_blob/${esc(id)}" alt=''',
    '''<button class="ph" data-act="lightbox" data-src="" style="padding:0;border:0"><img data-ph="${esc(id)}" alt=''')
rep(''':`<div class="macros"><span><b>${Math.round(+m.kcal||0)}</b> kcal</span>''',
    ''':m.pending?`<div class="pending">${esc(m.pendErr||(navigator.onLine&&S.user?'Claude is estimating this meal…':'Waiting for signal. Claude estimates it when you’re back online, or tap Edit to type the numbers.'))}</div>`:`<div class="macros"><span><b>${Math.round(+m.kcal||0)}</b> kcal</span>''')
rep("  const canScan=!!(sample&&sampleLimits&&sampleLimits.images);", "  const canScan=true;")

# ---------- picker: customs keep it open while you add ----------
rep("  const k=S.date, lu=lineupOf(k), groups=PLAN_GROUPS[planOf(k)]||['chest'];\n  S.pick={mode,i,q:'',g:mode==='swap'?exOf(lu[i].ex).g:groups[0],seen:lastSeenMap()};",
    "  const k=S.date, lu=lineupOf(k), groups=planGroups(k);\n  S.pick={mode,i,q:'',g:mode==='swap'?exOf(lu[i].ex).g:(groups[0]||'chest'),seen:lastSeenMap()};")
rep("  const groups=PLAN_GROUPS[planOf(k)]||[]; const order=", "  const groups=planGroups(k); const order=")
rep('''      <div class="row between"><h2 class="sheet-h">${cur?`Swap ${esc(exOf(cur.ex).n)}`:'Add exercise'}</h2><button class="iconbtn" data-act="closebtn" aria-label="Close">✕</button></div>''',
    '''      <div class="row between"><h2 class="sheet-h">${cur?`Swap ${esc(exOf(cur.ex).n)}`:'Add exercises'}</h2>${cur?'<button class="iconbtn" data-act="closebtn" aria-label="Close">✕</button>':'<button class="btn sm pri" data-act="closebtn">Done</button>'}</div>''')
rep("    const toks=q.split(/\\s+/); const groups=PLAN_GROUPS[planOf(S.date)]||[];", "    const toks=q.split(/\\s+/); const groups=planGroups(S.date);")

# ---------- finish: save customs ----------
rep('''  const k=S.date, pid=planOf(k), plan=PLANS[pid], day=getDay(k), lu=lineupOf(k), sm=summary(k), nk=nextPlanDate(k,pid);
  const changed=JSON.stringify(lu)!==JSON.stringify(tplOf(pid));''',
    '''  const k=S.date, pid=planOf(k), plan=PI(pid,k), day=getDay(k), lu=lineupOf(k), sm=summary(k), nk=nextPlanDate(k,pid);
  // a short session never shrinks the saved workout: compare and save the full lineup
  const changed=JSON.stringify(day.full||lu)!==JSON.stringify(tplOf(pid));''')
rep('''    ${changed?`<label class="keep"><input type="checkbox" id="keeplu" checked> Start next ${esc(plan.n)} with today’s exercises</label>`:''}''',
    '''    ${pid==='custom'&&lu.length?`<label class="keep"><input type="checkbox" id="keeplu" checked> Save as a workout you can repeat</label>
      <label class="small muted" style="display:flex;flex-direction:column;gap:4px">Name it<input class="inp" id="cname" value="${esc(plan.n==='Custom'?'':plan.n)}" placeholder="e.g. Upper pump"></label>`
    :changed?`<label class="keep"><input type="checkbox" id="keeplu" checked> Start next ${esc(plan.n)} with today’s exercises</label>`:''}''')
rep("  const day=getDay(k), pid=planOf(k), plan=PLANS[pid], sm=summary(k), lu=lineupOf(k);\n  const rows=exOrder(k)",
    "  const day=getDay(k), pid=planOf(k), plan=PI(pid,k), sm=summary(k), lu=lineupOf(k);\n  const rows=exOrder(k)")

# ---------- Claude calls ----------
cut('const SAMPLE_ERR = {', 'async function estimate(){', '')  # replaced by AI_ERR in parts/data.js
cut('async function estimate(){', 'async function saveMeal(k){', '''async function estimate(){
  const d=S.draft; if(!d||d.busy) return;
  d.busy=true; d.err=''; d.res=null; d.status=d.mode==='photo'?'Looking at your meal… about 20 seconds':'Working out the numbers…'; render();
  try{
    const r=await aiJSON(mealPrompt(d.mode,d.photos.length,d.note),{images:d.mode==='photo'?d.photos.map(p=>p.blob):[]});
    if(S.draft!==d) return;
    d.res=resOf(r);
  }catch(e){ if(S.draft===d) d.err=errMsg(e) }
  d.busy=false; if(S.draft===d) render();
}
''')
cut('async function saveMeal(k){', 'function saveMealEdit(k){', '''async function saveMeal(k,later){
  const d=S.draft; if(!d||d.saving) return;
  const r=later?{}:(d.res||{});
  if(!later&&num(r.kcal)==null&&num(r.p)==null){toast('Add at least calories or protein.');return}
  d.saving=true; render();
  const ids=[];
  if(d.mode==='photo') for(const p of d.photos){try{ids.push(await savePhoto(p.blob))}catch(e){toast('A photo couldn’t be stored on this phone; the rest still saved.')}}
  const now=new Date();
  const meal={id:uid(),t:`${pad(now.getHours())}:${pad(now.getMinutes())}`,name:(r.name||'Meal').slice(0,80),kcal:num(r.kcal)||0,p:num(r.p)||0,c:num(r.c)||0,f:num(r.f)||0,
    conf:r.confidence||'',tip:r.tip||'',items:mealItems(r.items),photos:ids,src:d.mode};
  if(later){meal.pending=true;meal.name='Meal photo';meal.note=String(d.note||'').slice(0,600)}
  const day=editDay(k); day.meals=(day.meals||[]).concat(meal);
  d.photos.forEach(p=>{try{URL.revokeObjectURL(p.url)}catch(e){}});
  S.draft=null; render();
  if(later){toast(navigator.onLine&&S.user?'Saved. Claude is estimating it now.':'Saved. Claude estimates it when you’re back online.');estimatePending()}
  else toast(`Saved: ${meal.name}, ${Math.round(meal.kcal)} kcal, ${Math.round(meal.p)} g protein`);
}
''')
rep("  Object.assign(m,next); m.name=(String(e.name||'').trim()||m.name||'Meal').slice(0,80);",
    "  Object.assign(m,next); m.name=(String(e.name||'').trim()||m.name||'Meal').slice(0,80); delete m.pending; delete m.pendErr;")
rep("    const r=await sample.json(`This photo is a body composition scan", "    const r=await aiJSON(`This photo is a body composition scan")
rep("Use null for anything not on the sheet. Do not guess.`,{images:[blob]});", "Use null for anything not on the sheet. Do not guess.`,{images:[blob],effort:'low'});")

# ---------- events ----------
rep("    case 'cardio': {const d=editDay(k); d.cardio=d.cardio||{}; d.cardio.done=!d.cardio.done; if(d.cardio.done&&!d.cardio.min)d.cardio.min=PLANS[planOf(k)].cardio.min; render(); break;}",
    "    case 'cardio': {const d=editDay(k); d.cardio=d.cardio||{}; d.cardio.done=!d.cardio.done; if(d.cardio.done&&!d.cardio.min)d.cardio.min=planAt(k).cardio.min; render(); break;}")
rep('''      if(S.pick.mode==='swap'){const old=lu[S.pick.i].ex; lu[S.pick.i].ex=id; toast(`Swapped to ${exOf(id).n}${doneSets(d,old).length?` (your ${exOf(old).n} sets stay logged)`:''}`)}
      else {lu.push(slotOf(id,exOf(id).sc)); toast(`Added ${exOf(id).n}`)}
      closeLayer(); render(); break;}''',
    '''      if(S.pick.mode==='swap'){const old=lu[S.pick.i].ex; lu[S.pick.i].ex=id; toast(`Swapped to ${exOf(id).n}${doneSets(d,old).length?` (your ${exOf(old).n} sets stay logged)`:''}`); closeLayer()}
      // adding keeps the list open so a whole custom workout can be built in one go
      else {lu.push(slotOf(id,exOf(id).sc)); toast(`Added ${exOf(id).n}`); const pl=document.getElementById('picklist'); if(pl) pl.innerHTML=pickList()}
      render(); break;}''')
rep('''      const d=editDay(k), pid=planOf(k), plan=PLANS[pid], sm=summary(k); lineupFor(d,k);''',
    '''      const d=editDay(k), pid=planOf(k), plan=PI(pid,k), sm=summary(k); lineupFor(d,k);''')
rep('''      if(keep&&keep.checked){S.tpl[pid]={lineup:clone(d.lineup)};queueSave('templates/'+pid,()=>S.tpl[pid])}''',
    '''      if(keep&&keep.checked){
        const full=clone(d.full||d.lineup);
        if(pid==='custom'){const id=uid().slice(0,8), name=(document.getElementById('cname')?.value||'').trim().slice(0,40)||'Custom'; S.customs[id]={name,lineup:full}; queueSave('customs/'+id); d.plan='c_'+id; d.cname=name}
        else if(String(pid).startsWith('c_')&&S.customs[pid.slice(2)]){S.customs[pid.slice(2)].lineup=full; queueSave('customs/'+pid.slice(2))}
        else {S.tpl[pid]={lineup:full}; queueSave('templates/'+pid)}
      }''')
rep('''    case 'delmeal': {const d=editDay(k); const m=(d.meals||[]).find(x=>x.id===el.dataset.id); d.meals=(d.meals||[]).filter(x=>x.id!==el.dataset.id); S.confirmDel=null; render();
      if(m&&assets&&(m.photos||[]).length){ setTimeout(async()=>{for(const id of m.photos){try{await assets.delete(id)}catch(e){}}},1500) } toast('Meal deleted'); break;}
    case 'lightbox': lightbox(el.dataset.src); break;''',
    '''    case 'delmeal': {const d=editDay(k); const m=(d.meals||[]).find(x=>x.id===el.dataset.id); d.meals=(d.meals||[]).filter(x=>x.id!==el.dataset.id); S.confirmDel=null; render();
      if(m&&(m.photos||[]).length) deletePhotos(m.photos); toast('Meal deleted'); break;}
    case 'lightbox': if(el.dataset.src) lightbox(el.dataset.src); break;
    case 'savelater': saveMeal(k,true); break;
    case 'workouts': S.confirmCustom=null; openWorkouts(); break;
    case 'setplan': {const d=editDay(k), p=el.dataset.p;
      if(d.plan!==p){d.plan=p; delete d.lineup; delete d.full; delete d.cname; if(p.startsWith('c_')&&S.customs[p.slice(2)]) d.cname=S.customs[p.slice(2)].name}
      closeLayer(); render(); window.scrollTo(0,0); break;}
    case 'newcustom': {const d=editDay(k); d.plan='custom'; d.lineup=[]; d.cname='Custom'; delete d.full; closeLayer(); render(); window.scrollTo(0,0); openPicker('add'); break;}
    case 'delcustom': {const id=el.dataset.id; if(S.confirmCustom!==id){S.confirmCustom=id; openWorkouts(); break}
      const c=S.customs[id]; S.confirmCustom=null; delete S.customs[id]; queueSave('customs/'+id); openWorkouts(); render(); toast(`Deleted ${c?c.name:'that workout'}`); break;}
    case 'short': {const d=editDay(k), lu=lineupFor(d,k);
      if(d.full){d.lineup=d.full; delete d.full; toast('Back to the full session')}
      else {const keep=runs(lu).slice(0,3).flat(); d.full=clone(lu); d.lineup=keep.map(i=>lu[i]); toast('Short session: the 3 main lifts. Still counts.')}
      render(); break;}
    case 'coach': runCoach(el.dataset.mon); break;
    case 'account': openAccount(); break;
    case 'signin': case 'signup': authGo(act); break;
    case 'syncnow': S.syncErr=''; await syncAll(); if(document.querySelector('[aria-label="Sync"]')) openAccount(); break;
    case 'signout': if(sb) await sb.auth.signOut(); closeLayer(); render(); setSync(); break;''')
rep("    const maxN=sampleLimits&&sampleLimits.images?sampleLimits.images.maxCount:4;", "    const maxN=AI_MAX_PHOTOS;")
rep("document.addEventListener('visibilitychange',()=>{if(document.hidden)return; rollover(); if(rest.end)keepAwake()});",
    "document.addEventListener('visibilitychange',()=>{if(document.hidden){lsSave();return} rollover(); if(rest.end)keepAwake(); syncAll()});")
rep("init();\n</script>", "init();\nif('serviceWorker' in navigator) addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));\n</script>")

exec((ROOT / 'parts/superset_patch.py').read_text())

exec((ROOT / 'parts/customex_patch.py').read_text())

exec((ROOT / 'parts/v6_patch.py').read_text())

exec((ROOT / 'parts/rank_patch.py').read_text())

# nothing from the artifact runtime may survive
for gone in ('claude.use', 'sample.', 'sampleLimits', 'assets.', '/_blob/', 'useCap', 'PLANS[planOf', 'plan=PLANS[pid]', 'PLANS[pid].col', 'verdict(', 'coachLift'):
    if gone in src:
        line = next(l for l in src.splitlines() if gone in l)
        sys.exit(f'leftover {gone!r}: {line[:160]}')
(ROOT / 'index.html').write_text(src)
print('index.html', len(src.encode()), 'bytes')

# every build gets a new cache name, so phones swap to the new files on their next launch
import time
sw = (ROOT / 'sw.js').read_text()
sw = re.sub(r"const V='rebuild-[0-9]+';", f"const V='rebuild-{time.strftime('%Y%m%d%H%M%S')}';", sw)
(ROOT / 'sw.js').write_text(sw)
