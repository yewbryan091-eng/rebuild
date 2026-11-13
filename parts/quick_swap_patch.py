SWAP_CODE = (ROOT / 'parts/quick_swap.js').read_text()
SWAP_CSS = (ROOT / 'parts/quick_swap.css').read_text()

rep('</style>\n</head><body>', SWAP_CSS + '\n</style>\n</head><body>')
rep('/* ============ swap / add picker ============ */',
    SWAP_CODE + '\n/* ============ swap / add picker ============ */')
rep('<button class="swapbtn" data-act="slot" data-i="${i}" aria-label="Swap or edit ${esc(ex.n)}">⇄<span>Swap</span></button>',
    '<button class="swapbtn" data-act="quickswap" data-i="${i}" aria-label="Swap or edit ${esc(ex.n)}">⇄<span>Swap</span></button>')
rep('dec=decide(id,sl,k), last=dec.last;',
    "dec=swapDecision(id,sl,k,typeof liveLiftContext==='function'?liveLiftContext(k,i):undefined), last=dec.last;")
rep('      <button class="swapbtn" data-act="quickswap" data-i="${i}" aria-label="Swap or edit ${esc(ex.n)}">⇄<span>Swap</span></button></div>',
    '      <button class="swapbtn" data-act="quickswap" data-i="${i}" aria-label="Swap or edit ${esc(ex.n)}">⇄<span>Swap</span></button></div>\n    ${swapCarryLabel(day,sl)}')
rep("S.pick=null;S.awDraft=null}",
    "S.pick=null;S.awDraft=null;S.swapPicker=null}")
rep("    case 'slot': openPicker('swap',+el.dataset.i); break;", """    case 'slot': openPicker('swap',+el.dataset.i); break;
    case 'quickswap': swapPanel(k,+el.dataset.i); break;
    case 'swapfilter': {
      const current=swapPickerContext(), filter=el.dataset.e;
      if(current&&Object.hasOwn(SWAP_FILTERS,filter)){
        const {p}=current; swapPanel(k,p.index,filter,p.fast,false);
        document.querySelector('[data-act="swapfilter"][aria-pressed="true"]')?.focus({preventScroll:true});
      }
      break;}
    case 'swapfast': {
      const current=swapPickerContext();
      if(current){
        const {p}=current; swapPanel(k,p.index,p.filter,!p.fast,false);
        document.querySelector('[data-act="swapfast"]')?.focus({preventScroll:true});
      }
      break;}
    case 'swapbrowse': {
      const current=swapPickerContext();
      if(current){const {p}=current; closeLayer(); openPicker('swap',p.index)}
      break;}
    case 'swapapply': applyQuickSwap(el.dataset.id); break;
    case 'swapundo': undoQuickSwap(); break;""")
cut("    case 'pickex':", "    // tapping a partner", """    case 'pickex': swapFullPickerChoice(el.dataset.id); break;
""")
rep("        <div class=\"small muted\">Pick a replacement below. Sets, reps and rest stay the same. A different machine is a different exercise: add it as your own so its numbers stay separate.</div>`:''}",
    """        <div class="small muted">Swaps are for today. The replacement takes over the remaining sets, using its own reps, rest and history. Add a different machine as a custom exercise to track its loads separately.</div>`:''}""")
rep("  const p=S.pick, lu=lineupOf(S.date), inToday=new Set(lu.map(s=>s.ex)), cur=p.mode==='swap'?exOf(lu[p.i].ex):null;",
    """  const p=S.pick, date=S.date, day=getDay(date), lu=lineupOf(date), cur=p.mode==='swap'?exOf(lu[p.i].ex):null;
  const inToday=new Set([...lu,...(day.full||[])].map(slot=>slot.ex));
  if(cur&&!swapRemaining(day,lu[p.i])) return '<div class="small muted">All work sets logged. You can still edit this exercise above.</div>';""")
rep("""  const row=id=>{const e=EX[id], ls=p.seen[id];return `<button class="pk" data-act="pickex" data-id="${id}"${inToday.has(id)?' disabled':''}><div class="pn">${esc(e.n)}${inToday.has(id)?' <span class="muted small">· in today</span>':''}</div><div class="pm">${esc(e.m)}${ls?` · last ${nice(ls)}`:''}</div></button>`};""",
    """  const row=id=>{const e=EX[id], ls=p.seen[id], reason=inToday.has(id)?'in today':cur&&swapRecorded(day,id)?'already logged today':'';
    return `<button class="pk" data-act="pickex" data-id="${esc(id)}"${reason?' disabled':''}><div class="pn">${esc(e.n)}${reason?` <span class="muted small">· ${reason}</span>`:''}</div><div class="pm">${esc(e.m)}${ls?` · last ${nice(ls)}`:''}</div></button>`};""")
rep("""      if(S.pick.mode==='swap'){lu[S.pick.i].ex=id; closeLayer(); toast(`Swapped to ${EX[id].n}`)}
      else {lu.push(slotOf(id,'i')); S.pick.q=''; renderPicker(); toast(`Added ${EX[id].n}`)}""",
    """      if(S.pick.mode==='swap'){
        const current=lu[S.pick.i], sets=current&&swapRemaining(d,current);
        if(!sets)break;
        swapReplaceSlot(d,lu,S.pick.i,swapPrescription(current,id,sets));
        closeLayer(); toast(`Swapped to ${EX[id].n}`);
      }else {lu.push(slotOf(id,'i')); S.pick.q=''; renderPicker(); toast(`Added ${EX[id].n}`)}""")

rep('const changed=JSON.stringify(day.full||lu)!==JSON.stringify(tplOf(pid));',
    'const changed=JSON.stringify(swapReusableLineup(day.full||lu))!==JSON.stringify(tplOf(pid));')
rep('const full=clone(d.full||d.lineup);',
    'const full=swapReusableLineup(d.full||d.lineup);')
rep('const total=lu.reduce((a,e)=>a+e.sets,0);\n  let done=0;',
    'const carried=swapCarriedSets(day,lu), total=lu.reduce((a,e)=>a+e.sets,0)+carried;\n  let done=carried;')
rep('planned:lu.reduce((a,s)=>a+s.sets,0),vol,prev,pv,mins',
    'planned:lu.reduce((a,s)=>a+s.sets,0)+swapCarriedSets(day,lu),vol,prev,pv,mins')
rep("    +(day.full?day.full.filter(f=>!lu.some(s=>s.ex===f.ex)).map(f=>",
    "    +swapCarrySummary(day,lu)\n    +(day.full?day.full.filter(f=>!lu.some(s=>s.ex===f.ex)).map(f=>")
