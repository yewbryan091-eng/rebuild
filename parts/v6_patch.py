# ---------- v6: coaching during the workout (progression, effort, honest logging, equipment, coverage) ----------
BRAIN = (ROOT / 'parts/brain.js').read_text()

def fn_cut(name):
    """remove a top-level function, up to the next top-level statement"""
    global src
    start = src.find('\nfunction ' + name + '(')
    if start < 0 or src.count('\nfunction ' + name + '(') != 1:
        sys.exit(f'fn_cut: {name}')
    ends = [src.find(m, start + 1) for m in ('\nfunction ', '\nasync function ', '\nconst ', '\nlet ', '\n/* ', '\n// ', '\ndocument.')]
    end = min(e for e in ends if e > 0)
    src = src[:start] + src[end:]

for n in ('verdict', 'suggestion', 'liftScore', 'dayPRs', 'dayVolume', 'exCard'):
    fn_cut(n)
rep("// double progression: top of the rep range on every work set → add weight; well under the range → drop and rebuild\n", '')
rep("// one number per session to track progress: est. 1RM for loaded lifts, top-weight reps for bodyweight/assisted\n", '')
rep("function doneSets(day,exId){const bw=EX[exId]&&(EX[exId].bw||EX[exId].as);return ((day.sets||{})[exId]||[]).filter(s=>s&&s.d&&num(s.r)!=null&&(num(s.w)!=null||bw)).map(s=>num(s.w)==null?{...s,w:0}:s)}\n",
    BRAIN + '\n')
rep("    if(!s||!s.d||(k===exceptKey&&i===exceptIdx))return;", "    if(!s||!s.d||isWU(s)||(k===exceptKey&&i===exceptIdx))return;")
rep("const fmtSet = (id,s)=>`${num(s.w)===0&&EX[id]&&EX[id].bw?'BW':fmtW(num(s.w))}",
    "const fmtSet = (id,s)=>`${num(s.w)==null?'?':num(s.w)===0&&EX[id]&&EX[id].bw?'BW':fmtW(num(s.w))}")
rep("const coachLift = (k,id)=>{const wk=S.weeks[mondayOf(k)];return wk&&wk.lifts&&wk.lifts[id]||''};\n", '')

# ---------- exercise card ----------
EXCARD = r'''
function exCard(k,day,sl,i,L){
  const lab=L?L.lab[i]:String(i+1), grp=L?L.grp[i]:null;
  const id=sl.ex, ex=exOf(id), arr=(day.sets||{})[id]||[], eq=equipOf(id), unit=unitOf(id);
  if(sl.skip) return `<section class="card ex skipped"><div class="row between"><div style="min-width:0"><b>${esc(lab)} · ${esc(ex.n)}</b><div class="small muted">Skipped today. It won't count against your progress.</div></div><button class="btn sm" data-act="skipslot" data-i="${i}">Undo</button></div></section>`;
  const n=Math.max(sl.sets,arr.length), dec=decide(id,sl,k), last=dec.last;
  const lastTxt=last?fmtSets(id,last.all):'';
  let rows='', anyDone=false;
  for(let s=0;s<n;s++){
    const cur=arr[s]||{}, prev=s>0?arr[s-1]:null, key=`${id}|${s}`; if(cur.d) anyDone=true;
    // empty boxes show exactly what a tick will log: the previous set's weight, else today's target
    const prevW=prev&&num(prev.w)!=null&&!isWU(prev)?num(prev.w):null;
    const phW=cur.wu0?'?':prevW!=null?fmtW(prevW):dec.w!=null?fmtW(dec.w):'';
    const g=dec.goal, phR=String(g?g[Math.min(s,g.length-1)]:sl.lo);
    const tag=cur.rir!=null?`<small>@${cur.rir==='u'?'?':cur.rir==4?'4+':cur.rir}</small>`:cur.pain?'<small>⚠</small>':cur.wu0&&cur.d?'<small>?kg</small>':'';
    rows+=`<div class="set${cur.d?' done':''}${isWU(cur)?' wuset':''}"><button class="n nbtn" data-act="setmenu" data-k="${key}" aria-label="Set ${s+1} options">${isWU(cur)?'W':s+1}${tag}</button>
      <div class="field"><input id="w-${id}-${s}" type="number" inputmode="decimal" step="0.5" placeholder="${esc(phW)}" value="${esc(cur.w??'')}" data-set="${id}|${s}|w" aria-label="Set ${s+1} weight"><span>${esc(unit)}</span></div>
      <div class="field"><input id="r-${id}-${s}" type="number" inputmode="numeric" placeholder="${esc(phR)}" value="${esc(cur.r??'')}" data-set="${id}|${s}|r" aria-label="Set ${s+1} reps"><span>reps</span></div>
      <button class="tick${cur.d?' on':''}" data-act="tick" data-id="${id}" data-i="${s}" data-rest="${sl.rest}" data-ph="${esc(phW==='?'?'':phW)}|${esc(phR)}" aria-label="Set ${s+1} done">✓</button></div>`;
    if(S.setMenu===key) rows+=setMenuRow(id,s,cur,prev);
    else if(S.rirFor===key&&cur.d&&cur.rir==null) rows+=rirRow(id,s);
  }
  const note=assistOf(id)?' · kg = assist':ex.bw?' · kg = added weight, 0 = bodyweight':'';
  const ssTxt=grp?(grp[0]===i?`<div class="sstag">Superset · 1 set each, back to back, then rest</div>`:''):'';
  return `<section class="card ex${grp?' ss':''}${grp&&grp[0]!==i?' sscont':''}">${ssTxt}
    <div class="exhead"><button class="head" data-act="form" data-kind="ex" data-id="${id}"><span class="thumbwrap">${figTag(ex.an,ex.p,'thumb')}<span class="exn num">${esc(lab)}</span></span><div style="min-width:0"><div class="title">${esc(ex.n)}</div>
      <div class="presc num">${sl.sets} × ${sl.lo}–${sl.hi} reps · rest ${mmss(sl.rest)}${note}${eq.setup?` · ${esc(eq.setup)}`:''}</div><div class="how">Form + cues ›</div></div></button>
      <button class="swapbtn" data-act="slot" data-i="${i}" aria-label="Swap or edit ${esc(ex.n)}">⇄<span>Swap</span></button></div>
    <div class="hint${dec.up?' up':''}${dec.down?' down':''}"><b class="num">${esc(dec.head)}</b><div>${esc(dec.why)}</div>${lastTxt?`<div class="muted num">Last (${nice(last.k)}): ${esc(lastTxt)}</div>`:''}</div>
    <div class="sets">${rows}</div>
    <div class="setbtns"><button class="btn sm ghost" data-act="addset" data-id="${id}" data-i="${i}">+ Set</button>${n>1?`<button class="btn sm ghost" data-act="rmset" data-id="${id}" data-i="${i}">− Set</button>`:''}${anyDone?'':`<button class="btn sm ghost" data-act="skipslot" data-i="${i}" style="margin-left:auto">Skip</button>`}</div>
    ${i===0&&!anyDone?'<div class="small muted">✓ logs what’s in the boxes; empty boxes take the grey numbers. Tap a set number for reps left, same as last set, unknown weight, warm-up or pain.</div>':''}
  </section>`;
}'''
rep("\nfunction doneCard(k){", EXCARD + "\nfunction doneCard(k){")
rep("  const tg=lu.map(sl=>{const ds=doneSets(day,sl.ex);const v=verdict(sl.ex,sl.lo,sl.hi,ds);return v?`<div class=\"${v.up?'up':v.down?'down':''}\"><b>${esc(exOf(sl.ex).n)}</b> · ${esc(v.text)}</div>`:''}).join('');",
    "  const tg=nextTargets(k);")
rep("  const tg=lu.map(sl=>{const v=verdict(sl.ex,sl.lo,sl.hi,doneSets(day,sl.ex));return `<div class=\"${v?(v.up?'up':v.down?'down':''):'muted'}\"><b>${esc(exOf(sl.ex).n)}</b> · ${v?esc(v.text):'skipped today'}</div>`}).join('');",
    "  const tg=nextTargets(k);")
rep("  const canShort=!!day.full||runs(lu).length>3;", "  const canShort=!!day.full||runs(lu).length>2;")
rep("""  h+=`<button class="btn addex" data-act="addex">+ Add exercise</button>`;""",
    """  h+=`<div class="row" style="gap:8px"><button class="btn addex" data-act="addex" style="flex:1">+ Add exercise</button><button class="btn addex" data-act="tlopen" style="flex:1">+ Log from text</button></div>`;""")

# ---------- history guards: sessions with only unknown weights have no score ----------
rep("const ds=doneSets(d,id);if(ds.length)(seen[id]=seen[id]||[]).push({k:x,sc:liftScore(id,ds)})",
    "const sc=liftScore(id,doneSets(d,id));if(sc)(seen[id]=seen[id]||[]).push({k:x,sc})")
rep("if(ds.length)hs.push({k,ds,sc:liftScore(id,ds)})", "{const sc=liftScore(id,ds);if(sc)hs.push({k,ds,sc})}")
rep("let d=''; if(ps){const dv=sc.v-ps.v;", "let d=''; if(ps&&sc){const dv=sc.v-ps.v;")
rep("${fmtSets(id,ds)}${sc.e1?", "${fmtSets(id,ds)}${sc&&sc.e1?")

# ---------- log tab: coverage + honest food averages ----------
rep("let h=coachCard(mon)+`<section class=\"card\"><div class=\"row between\"><h2>Week of ${nice(mon)}</h2>",
    "let h=coachCard(mon)+coverageCard(mon===mondayOf(todayKey())?todayKey():addDays(mon,6))+`<section class=\"card\"><div class=\"row between\"><h2>Week of ${nice(mon)}</h2>")
rep("const mon=mondayOf(k); let rows='', ses=0, vol=0, kc=0, pr=0, nd=0;", "const mon=mondayOf(k); let rows='', ses=0, vol=0, kc=0, pr=0, nd=0, kcA=0, prA=0, ndA=0;")
rep("vol+=dayVolume(day); if(mt.kcal){kc+=mt.kcal;pr+=mt.p;nd++}",
    "vol+=dayVolume(day); if(mt.kcal){kcA+=mt.kcal;prA+=mt.p;ndA++;if(day.foodDone){kc+=mt.kcal;pr+=mt.p;nd++}}")
rep("${Math.round(mt.kcal)} kcal · ${Math.round(mt.p)} g protein</div>`:''}</div>",
    "${Math.round(mt.kcal)} kcal · ${Math.round(mt.p)} g protein${day.foodDone?'':' · partial'}</div>`:''}</div>")
rep("<div class=\"stat\"><b>${nd?Math.round(kc/nd).toLocaleString():'—'}</b><span>Avg kcal${tg?",
    "<div class=\"stat\"><b>${nd?Math.round(kc/nd).toLocaleString():ndA?Math.round(kcA/ndA).toLocaleString():'—'}</b><span>Avg kcal${nd?` · ${nd} full day${nd>1?'s':''}`:ndA?' · partial logs':''}${tg?")
rep("<div class=\"stat\"><b>${nd?Math.round(pr/nd):'—'}</b><span>Avg protein g${tg?",
    "<div class=\"stat\"><b>${nd?Math.round(pr/nd):ndA?Math.round(prA/ndA):'—'}</b><span>Avg protein g${tg?")

# ---------- equipment & setup, in the swap sheet ----------
rep("""        <div class="small muted">Pick a replacement below. Sets, reps and rest stay the same.</div>`:''}""",
    """        ${equipBox(cur.ex)}
        <div class="small muted">Pick a replacement below. Sets, reps and rest stay the same. A different machine is a different exercise: add it as your own so its numbers stay separate.</div>`:''}""")
EQUIP = r'''
// how this exercise's numbers work on his actual equipment
function equipBox(id){
  const eq=equipOf(id), ex=exOf(id), sel=(f,v)=>String(eq[f]??'')===String(v)?' selected':'';
  return `<details class="equip"${Object.keys(eq).length?' open':''}><summary class="small">Your equipment & setup${eq.gym?` · ${esc(eq.gym)}`:''}</summary>
    <div class="form2" style="margin-top:8px">
      <label>Weight jumps<select class="inp" data-eq="inc">${['',0.5,1,1.25,2,2.5,5,10].map(v=>`<option value="${v}"${sel('inc',v)}>${v===''?`Default ${fmtW(ex.inc||2.5)} kg`:v+' kg'}</option>`).join('')}</select></label>
      <label>The number means<select class="inp" data-eq="unit">${[['','Total'],['side','Per side'],['each','Per dumbbell'],['assist','Assistance']].map(([v,t])=>`<option value="${v}"${sel('unit',v)}>${t}</option>`).join('')}</select></label>
      <label>Effort target<select class="inp" data-eq="rir">${[['','Default'],['1','1 rep left'],['2','2 reps left'],['3','3 reps left']].map(([v,t])=>`<option value="${v}"${sel('rir',v)}>${t}</option>`).join('')}</select></label>
      <label>Machine / gym<input class="inp" data-eq="gym" value="${esc(eq.gym??'')}" placeholder="e.g. Gym A, rack 2"></label>
    </div>
    <label class="small muted" style="display:flex;flex-direction:column;gap:4px;margin-top:8px">Setup<input class="inp" data-eq="setup" value="${esc(eq.setup??'')}" placeholder="e.g. seat 4, pad 2, feet high"></label></details>`;
}'''
rep("\nfunction renderPicker(){", EQUIP + "\nfunction renderPicker(){")

# ---------- food: regular meals, complete vs partial days ----------
rep("""<button class="btn sm ghost" data-act="editmeal" data-id="${m.id}">Edit</button>""",
    """<button class="btn sm ghost" data-act="foodsave" data-id="${m.id}" aria-label="Save as a regular meal">${Object.values(S.foods).some(f=>f.name===m.name)?'★':'☆'}</button><button class="btn sm ghost" data-act="editmeal" data-id="${m.id}">Edit</button>""")
rep("""        <button class="btn" data-act="manual">Type numbers</button>
      </div></section>`;""",
    """        <button class="btn" data-act="manual">Type numbers</button>
      </div>
      ${Object.keys(S.foods).length?`<div class="label">Your regulars · one tap logs them</div>${Object.entries(S.foods).sort((a,b)=>a[1].name.localeCompare(b[1].name)).map(([id,f])=>`<div class="row" style="gap:6px"><button class="pk" data-act="foodlog" data-id="${id}" style="flex:1;min-width:0"><div class="pn">${esc(f.name)}</div><div class="pm num">${Math.round(f.kcal)} kcal · ${Math.round(f.p)} g protein · saved estimate</div></button><button class="iconbtn" data-act="fooddel" data-id="${id}" aria-label="Remove ${esc(f.name)} from regulars">✕</button></div>`).join('')}`:'<div class="small muted">Tap ☆ on a meal you eat often to log it in one tap next time.</div>'}</section>`;""")
rep("""    <div class="small muted num">Carbs ${Math.round(t.c)} g · Fat ${Math.round(t.f)} g${tg?` · targets ${tg.carbs} g / ${tg.fat} g`:''}</div></section>`;""",
    """    <div class="small muted num">Carbs ${Math.round(t.c)} g · Fat ${Math.round(t.f)} g${tg?` · targets ${tg.carbs} g / ${tg.fat} g`:''}</div>
    ${(day.meals||[]).length?`<button class="btn sm${day.foodDone?' ink':''}" data-act="fooddone" style="align-self:flex-start">${day.foodDone?'✓ Everything eaten is logged':'Mark: everything eaten is logged'}</button>${day.foodDone?'':'<div class="small muted">Until then this day counts as a partial log, and your coach won’t judge calories from it.</div>'}`:''}</section>`;""")

# ---------- body: waist, progress photos, priorities ----------
rep("""data-day="bw" placeholder="${esc(latestWeight()??'')}"></label>""",
    """data-day="bw" placeholder="${esc(latestWeight()??'')}"></label>
    <label>Waist cm (at the navel)<input class="inp num" id="waist" type="number" inputmode="decimal" step="0.5" value="${esc(day.waist??'')}" data-day="waist" placeholder="${esc(lastWaist()??'')}"></label>""")
rep("""    ${weightChart()}</section>`;""", """    ${weightChart()}
    ${(()=>{const ids=Object.keys(S.days).sort().reverse().flatMap(x=>(S.days[x].prog||[]).map(id=>({id,x}))).slice(0,6);
      return `<div class="label">Progress photos</div><div class="photos">${ids.map(p=>`<button class="ph" data-act="lightbox" data-src="" style="padding:0;border:0"><img data-ph="${esc(p.id)}" alt="Progress photo ${nice(p.x)}"></button>`).join('')}<label class="ph filebtn">+ Photo<input type="file" accept="image/*" data-act="progpick"></label></div>
      <div class="small muted">Same spot, same light, every 2–4 weeks. Private to your account. Waist and photos show fat loss the scale can hide.</div>`})()}</section>
  <section class="card"><h2>Priorities</h2><div class="small muted">Muscles you want extra work on. Short sessions and the coach lean toward them, without letting the rest slide.</div>
    <div class="chips" style="flex-wrap:wrap">${MAIN_GROUPS.map(g=>`<button class="chipb${prioOf().includes(g)?' on':''}" data-act="prio" data-g="${g}">${esc(GROUPS[g])}</button>`).join('')}</div></section>`;""")
rep("Re-scan every 4–6 weeks, same time of day.", "Re-scan every 4–6 weeks, same time of day. A scan's body-fat % is an estimate; trust the trend, not one reading.")

# ---------- coach: same targets, real context ----------
rep("+ids.map(id=>`${exOf(id).n} [${id}] ${fmtSets(id,doneSets(d,id),', ')}`).join('; '));",
    "+ids.map(id=>`${exOf(id).n} [${id}] ${doneSets(d,id).map(s=>fmtSet(id,s)+(s.rir!=null?` @${s.rir==='u'?'?':s.rir}RIR`:'')+(s.pain?' (pain/form)':'')+(s.ss?' (superset)':'')).join(', ')}`).join('; '));")
rep("    else if(d.plan&&d.plan!=='rest') parts.push(`${planLabel(pid,k)} opened, nothing logged`);",
    "    else if(d.plan&&d.plan!=='rest') parts.push(`${planLabel(pid,k)} opened, nothing logged`);\n"
    "    {const lu=d.lineup||[], sk=lu.filter(s=>s.skip).map(s=>exOf(s.ex).n), un=ids.length?lu.filter(s=>!s.skip&&!doneSets(d,s.ex).length).map(s=>exOf(s.ex).n):[], lo=d.full?d.full.filter(f=>!lu.some(s=>s.ex===f.ex)).map(s=>exOf(s.ex).n):[];\n"
    "     if(sk.length||un.length||lo.length) parts.push([sk.length?`skipped: ${sk.join(', ')}`:'',un.length?`not logged: ${un.join(', ')}`:'',lo.length?`left out (short session): ${lo.join(', ')}`:''].filter(Boolean).join('; '))}")
rep("    if(num(d.bw)) parts.push(`weighed ${num(d.bw)} kg`);", "    if(num(d.bw)) parts.push(`weighed ${num(d.bw)} kg`);\n    if(num(d.waist)) parts.push(`waist ${num(d.waist)} cm`);")
rep("logged, ${Math.round(t.kcal)} kcal, ${Math.round(t.p)} g protein`)}", "logged, ${Math.round(t.kcal)} kcal, ${Math.round(t.p)} g protein${d.foodDone?', complete day':', partial log'}`)}")
rep("""${prev?`Last week's plan was ${prev.sessions.length} sessions: ${prev.sessions.map(s=>s.plan).join(', ')}.`:''}""",
    """${prev?`Last week's plan was ${prev.sessions.length} sessions: ${prev.sessions.map(s=>s.plan).join(', ')}.`:''}

The app's next lift targets (calculated from his logged sets; these are fixed):
${(()=>{const seen=new Set(), out=[];for(const p of ROT.concat(Object.keys(S.customs).map(id=>'c_'+id)))for(const sl of tplOf(p)){if(seen.has(sl.ex))continue;seen.add(sl.ex);const v=decide(sl.ex,sl,addDays(today,1));if(v.last)out.push(`${exOf(sl.ex).n}: ${v.head}. ${v.why}`)}return out.join('\\n')||'(none yet)'})()}

Work sets per muscle, last 7 / 14 days: ${(()=>{const a=coverage(7,today),b=coverage(14,today);return MAIN_GROUPS.map(g=>`${GROUPS[g]} ${a[g]||0}/${b[g]||0}`).join(', ')})()}. His priority muscles: ${prioOf().map(g=>GROUPS[g]).join(', ')||'none'}.""")
rep("- Lifts: give a target for the main lifts of the planned sessions, based on his latest sets and double progression: when every work set reached the top of the rep range, add the smallest jump (2.5 kg barbell, 2 kg dumbbells); otherwise keep the weight and add reps. If a lift went backwards twice in a row, drop about 10% and rebuild. Only use exercise ids from the log or the workout list.",
    "- If he has been averaging 3 or fewer sessions a week, choose the sessions that cover the most neglected muscles (see the work-set counts) instead of blindly following the rotation, and keep his priority muscles covered. A missed day moves the plan forward; never stack make-up sessions.\n"
    "- Lift targets come from the app (above). Do not invent different weights or reps; you may point at one in a session note. RIR = reps in reserve he reported, ? weight = not logged, skipped and not-logged exercises are listed per day.")
rep("- Calories: judge by his weight trend, not by logged food if fewer than 4 days of food were logged.",
    "- Calories: judge by his weight trend, not by logged food unless at least 4 days are marked complete. Change calories only with about 2 weeks of weigh-ins (3+ a week) behind it; otherwise keep the target and say exactly what data is missing.")
rep(""","kcal":0,"protein":0,"steps":0,"lifts":{"exercise_id":"e.g. 92.5 kg × 6, 6, 6"}}`;""", ""","kcal":0,"protein":0,"steps":0}`;""")
rep("    const lifts={}; if(r.lifts&&typeof r.lifts==='object') for(const [id,v] of Object.entries(r.lifts)) if(EX[id]) lifts[id]=String(v).slice(0,80);", "    const lifts={};")
rep("then sets this week’s sessions, lift targets and calories.", "then sets this week’s sessions and calories. Lift targets come from your own logged sets, on every exercise card.")

# ---------- events ----------
TICK_OLD = """      if(!s.d){
        if(s.w==null&&num(phW)!=null) s.w=num(phW);
        if(s.r==null&&num(phR)!=null) s.r=num(phR);
        if(s.w==null&&EX[id].bw) s.w=0;
        if(s.w==null||s.r==null){toast('Enter the weight and reps first.');break}
        const prev=bestE1(id,k,i); s.d=true; if(!d.started) d.started=new Date().toISOString();
        if(prev&&s.r>0&&e1rm(s.w,s.r)>prev.v+0.01&&(s.w>0)) toast(`PR! ${EX[id].n}: ${fmtW(s.w)} × ${s.r} (est. 1RM ${fmtW(Math.round(e1rm(s.w,s.r)*2)/2)} kg)`);
        const lu=lineupOf(k), si=lu.findIndex(x=>x.ex===id), grp=si>=0?slotLabels(lu).grp[si]:null;"""
TICK_NEW = """      if(!s.d){
        // empty boxes take the grey numbers on screen; say so, so a tick never silently invents work
        const filled=[];
        if(s.w==null&&!s.wu0&&num(phW)!=null){s.w=num(phW);filled.push(`${fmtW(s.w)} kg`)}
        if(s.r==null&&num(phR)!=null){s.r=num(phR);filled.push(`${s.r} reps`)}
        if(s.w==null&&!s.wu0&&EX[id].bw) s.w=0;
        if(s.r==null){toast('Enter the reps first.');break}
        const prev=bestE1(id,k,i); s.d=true; s.at=Date.now(); if(!d.started) d.started=new Date().toISOString();
        const before=arr.slice(0,i).reverse().find(x=>x&&x.d&&x.at); if(before) s.rest=Math.round((s.at-before.at)/1000);
        S.rirFor=isWU(s)?null:`${id}|${i}`; S.setMenu=null;
        if(prev&&s.w!=null&&!isWU(s)&&s.r>0&&e1rm(s.w,s.r)>prev.v+0.01&&(s.w>0)) toast(`PR! ${EX[id].n}: ${fmtW(s.w)} × ${s.r} (est. 1RM ${fmtW(Math.round(e1rm(s.w,s.r)*2)/2)} kg)`);
        else if(s.w==null) toast(`Logged ${s.r} reps, weight not recorded. It counts as work, not toward load increases.`);
        else if(filled.length) toast(`Logged the suggested ${filled.join(' × ')}. Tap the box to change it.`);
        const lu=lineupOf(k), si=lu.findIndex(x=>x.ex===id), grp=si>=0?slotLabels(lu).grp[si]:null;
        if(grp) s.ss=1;"""
rep(TICK_OLD, TICK_NEW)
rep("      } else s.d=false;\n      render(); break;}",
    "      } else {s.d=false; delete s.at; delete s.rest; delete s.rir; delete s.ss}\n      render(); break;}")
rep("""    case 'short': {const d=editDay(k), lu=lineupFor(d,k);
      if(d.full){d.lineup=d.full; delete d.full; toast('Back to the full session')}
      else {const keep=runs(lu).slice(0,3).flat(); d.full=clone(lu); d.lineup=keep.map(i=>lu[i]); toast('Short session: the 3 main lifts. Still counts.')}
      render(); break;}""",
    """    case 'short': {const d=editDay(k);
      if(d.full){d.lineup=d.full; delete d.full; toast('Back to the full session'); render(); break}
      openShort(); break;}
    case 'shortgo': {const d=editDay(k), lu=lineupFor(d,k), r=pickShort(lu,+el.dataset.m,k);
      d.full=clone(lu); d.lineup=r.keep.map(i=>lu[i]); closeLayer(); render(); window.scrollTo(0,0);
      toast(`Short session, about ${r.used} min: ${d.lineup.map(s=>exOf(s.ex).n).join(', ')}`); break;}
    case 'setmenu': S.setMenu=S.setMenu===el.dataset.k?null:el.dataset.k; S.rirFor=null; render(); break;
    case 'rir': {const [id,i]=el.dataset.k.split('|'); const d=editDay(k); const s=((d.sets||{})[id]||[])[+i];
      if(s){const v=el.dataset.v; if(String(s.rir)===v) delete s.rir; else s.rir=v==='u'?'u':+v}
      S.rirFor=null; S.setMenu=null; render(); break;}
    case 'setflag': {const [id,i]=el.dataset.k.split('|'), f=el.dataset.f; const d=editDay(k); lineupFor(d,k); d.sets=d.sets||{};
      const arr=d.sets[id]=d.sets[id]||[]; while(arr.length<=+i)arr.push({}); const s=arr[+i];
      if(f==='wu'){if(s.k==='wu')delete s.k;else s.k='wu'}
      else if(f==='pain'){if(s.pain)delete s.pain;else s.pain=true}
      else if(f==='wunk'){if(s.wu0)delete s.wu0;else{s.wu0=true;s.w=null}}
      else if(f==='same'){const p=arr[+i-1]; if(p){s.w=p.w??null;s.r=p.r??null;if(p.wu0)s.wu0=true;else delete s.wu0}}
      else if(f==='clear'){arr[+i]={}}
      S.setMenu=null; render(); break;}
    case 'skipslot': {const d=editDay(k), sl=lineupFor(d,k)[+el.dataset.i]; if(sl.skip)delete sl.skip; else sl.skip=true; render(); break;}
    case 'tlopen': S.textLog=null; openTextLog(); setTimeout(()=>document.getElementById('tl-text')?.focus(),50); break;
    case 'tlparse': {const t=document.getElementById('tl-text')?.value||''; S.textLog={text:t,rows:parseLogText(t)}; openTextLog(); break;}
    case 'tlcycle': {const r=S.textLog.rows[+el.dataset.i]; r.pick=((r.pick||0)+1)%(r.cands.length+1); openTextLog(); break;}
    case 'tlsave': {const rows=S.textLog.rows; const d=editDay(k), lu=lineupFor(d,k); d.sets=d.sets||{};
      for(const r of rows){let id=r.cands[r.pick||0];
        if(!id){id='x_'+uid().slice(0,8); const nm=(r.name||'Exercise').replace(/^\\w/,c=>c.toUpperCase()); S.customEx[id]={n:nm,g:guessGroup(nm)}; queueSave('exercises/'+id); applyCustomEx()}
        if(!lu.some(s=>s.ex===id)) lu.push({...slotOf(id,exOf(id).sc),sets:r.sets});
        const arr=d.sets[id]=(d.sets[id]||[]).filter(s=>s&&s.d), bw=exOf(id).bw;
        for(let j=0;j<r.sets;j++) arr.push(r.w!=null?{d:true,r:r.reps,w:r.w,src:'text'}:bw?{d:true,r:r.reps,w:0,src:'text'}:{d:true,r:r.reps,w:null,wu0:true,src:'text'});
      }
      S.textLog=null; closeLayer(); render(); toast(`Added ${rows.length} exercise${rows.length>1?'s':''} from text`); break;}
    case 'prio': {const g=el.dataset.g, p=prioOf().slice(), j=p.indexOf(g); if(j>=0)p.splice(j,1); else p.push(g); S.profile.prio=p; saveProfile(); render(); break;}
    case 'foodsave': {const m=(getDay(k).meals||[]).find(x=>x.id===el.dataset.id); if(!m)break;
      const hit=Object.entries(S.foods).find(([,f])=>f.name===m.name);
      if(hit){delete S.foods[hit[0]]; queueSave('foods/'+hit[0]); toast(`${m.name} removed from regulars`)}
      else {const id=uid().slice(0,8); S.foods[id]={name:m.name,kcal:+m.kcal||0,p:+m.p||0,c:+m.c||0,f:+m.f||0,items:m.items||[]}; queueSave('foods/'+id); toast(`Saved ${m.name} as a regular. One tap logs it next time.`)}
      render(); break;}
    case 'foodlog': logRegular(k,el.dataset.id); break;
    case 'fooddel': {const f=S.foods[el.dataset.id]; delete S.foods[el.dataset.id]; queueSave('foods/'+el.dataset.id); render(); if(f) toast(`${f.name} removed from regulars`); break;}
    case 'fooddone': {const d=editDay(k); if(d.foodDone)delete d.foodDone; else d.foodDone=true; render(); break;}""")
rep("  if(el.dataset.scan){S.scanDraft=S.scanDraft||{}; S.scanDraft[el.dataset.scan]=el.value; return}",
    """  if(el.dataset.scan){S.scanDraft=S.scanDraft||{}; S.scanDraft[el.dataset.scan]=el.value; return}
  if(el.dataset.eq&&S.pick){const id=lineupOf(S.date)[S.pick.i].ex, e=S.equip[id]=S.equip[id]||{}, f=el.dataset.eq, v=el.value;
    if(v==='') delete e[f]; else e[f]=(f==='inc'||f==='rir')?num(v):v.slice(0,80);
    if(!Object.keys(e).length) delete S.equip[id]; queueSave('equip/'+id); pendingRender=true; return}
  if(el.id==='tl-text'&&S.textLog){S.textLog.text=el.value; return}""")
rep("arr[+i][f]=el.value===''?null:num(el.value); return}", "arr[+i][f]=el.value===''?null:num(el.value); if(f==='w'&&el.value!=='') delete arr[+i].wu0; return}")
rep("  if(el.dataset.act==='scanpick'&&el.files&&el.files[0]){readScan(el.files[0]);return}",
    """  if(el.dataset.act==='scanpick'&&el.files&&el.files[0]){readScan(el.files[0]);return}
  if(el.dataset.act==='progpick'&&el.files&&el.files[0]){const blob=await shrink(el.files[0],1600); const id=await savePhoto(blob); const d=editDay(S.date); d.prog=(d.prog||[]).concat(id); render(); toast('Progress photo saved'); return}""")

# ---------- styles ----------
rep("@media (prefers-reduced-motion: reduce)", """/* v6: set menu, effort, coverage */
.nbtn{background:none;border:0;padding:0;height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.05;font-weight:700;color:var(--muted)}
.nbtn small{font-size:10px;font-weight:700;color:var(--plate)}
.set.wuset .nbtn{color:var(--warn)}
.set.wuset input{opacity:.7}
.setmenu{display:flex;flex-direction:column;gap:6px;background:var(--sunk);border-radius:10px;padding:8px 10px}
.setmenu .chips{flex-wrap:wrap}
.setmenu .chipb{padding:6px 10px;font-size:13px}
.card.ex.skipped{opacity:.75}
.covgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}
.cov{display:grid;grid-template-columns:minmax(0,1fr) 28px 28px;gap:6px;font-size:14px;padding:5px 0;border-top:1px solid var(--line)}
.cov b,.cov .num{text-align:right}
.cov.gap span:first-child{color:var(--warn)}
.tlrow{border-top:1px solid var(--line);padding:6px 0}
details.equip{background:var(--sunk);border-radius:10px;padding:8px 10px}
details.equip summary{font-weight:700;cursor:pointer}
@media (prefers-reduced-motion: reduce)""")
