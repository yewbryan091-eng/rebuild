LIVE_SETS = (ROOT / 'parts/live_sets.js').read_text()
LIVE_SETS_CSS = (ROOT / 'parts/live_sets.css').read_text()

rep('</style>\n</head><body>', LIVE_SETS_CSS + '\n</style>\n</head><body>')
rep('/* ============ rendering ============ */', LIVE_SETS + '\n/* ============ rendering ============ */')
rep("    case 'closebtn': closeLayer(); break;", """    case 'closebtn': closeLayer(); break;
    case 'liveapply': applyLiveSet(k,el.dataset.id,+el.dataset.i); break;""")

# Filter past sessions before the shared progression engine uses their numbers.
# Missing or changed format remains visible in the log, with no suggested load.
rep('function readSession(k,id){\n  const day=S.days[k], all=doneSets(day,id); if(!all.length) return null;',
    'function readSession(k,id,context=null){\n  const day=S.days[k], all=doneSets(day,id); if(!all.length) return null;')
rep('  const sets=all.filter(s=>num(s.w)!=null);\n  let top=null;',
    '  const sets=all.filter(s=>!s.wu0&&num(s.w)!=null&&num(s.w)>=0&&(!context||liveSetContextMatches(s,context,!!slot?.ss)));\n  let top=null;')
rep('function sessionsOf(id,before,n=4){const out=[];for(const k of Object.keys(S.days).filter(k=>k<before).sort().reverse()){const r=readSession(k,id);if(r)out.push(r);if(out.length>=n)break}return out}',
    'function sessionsOf(id,before,n=4,context=null){const out=[];for(const k of Object.keys(S.days).filter(k=>k<before).sort().reverse()){const r=readSession(k,id,context);if(r)out.push(r);if(out.length>=n)break}return out}')
rep('function decide(id,sl,before){',
    '''function decide(id,sl,before,context={...liveEquipmentContext(id),superset:[]}){''')
rep('  const hist=sessionsOf(id,before), last=hist[0], ref=hist.find(h=>h.top!=null);',
    '''  const hist=sessionsOf(id,before,4,context), last=hist[0];
  const changed=last?.all.some(s=>!s.wu0&&num(s.w)!=null&&num(s.w)>=0&&!liveSetContextMatches(s,context,!!last.slot?.ss));
  const ref=changed?null:hist.find(h=>h.top!=null);''')
rep("  if(!ref) return out(null,'unknown',",
    """  if(changed) return out(null,'unknown','This setup or set format changed. Log a set here to establish a new starting point.');
  if(!ref) return out(null,'unknown',""")
rep('  const lastTxt=last?fmtSets(id,last.all):\'\';',
    '''  const lastTxt=last&&last.sets.length?fmtSets(id,last.sets):'';
  const live=liveSetAdvice(k,sl,i,day);
  const currentContext=liveLiftContext(k,i);''')
rep('    const prevW=prev&&num(prev.w)!=null&&!isWU(prev)?num(prev.w):null;',
    '''    const prevW=prev?.d&&!isWU(prev)&&!prev.pain&&liveEquipmentMatches(prev.liftContext,currentContext)?liveLoad(id,prev,currentContext):null;
    const liveRow=live?.next===s;''')
rep("    const phW=cur.wu0?'?':prevW!=null?fmtW(prevW):dec.w!=null?fmtW(dec.w):'';",
    "    const phW=cur.wu0?'?':liveRow?'':prevW!=null?fmtW(prevW):dec.w!=null?fmtW(dec.w):'';")
rep('    const g=dec.goal, phR=String(g?g[Math.min(s,g.length-1)]:sl.lo);',
    "    const g=dec.goal, phR=liveRow?'':String(g?g[Math.min(s,g.length-1)]:sl.lo);")
rep('    <div class="sets">${rows}</div>\n    <div class="setbtns">',
    '    ${liveSetCard(id,live)}\n    <div class="sets">${rows}</div>\n    <div class="setbtns">')
rep('        if(grp) s.ss=1;',
    '        s.liftContext=liveLiftContext(k,si)||{...liveEquipmentContext(id),superset:[]};\n        delete s.targetContext;\n        if(grp) s.ss=1;')
rep("      const wIn=document.getElementById(`w-${id}-${i}`), rIn=document.getElementById(`r-${id}-${i}`);",
    """      const slotIndex=lineupOf(k).findIndex(slot=>slot.ex===id&&!slot.skip);
      const context=liveLiftContext(k,slotIndex)||{...liveEquipmentContext(id),superset:[]};
      if(!s.d&&s.targetContext&&!liveSetContextMatches({liftContext:s.targetContext},context)){
        delete s.targetContext; delete s.w; delete s.r;
        render(); toast('Your setup changed. Enter the set you completed.'); break;
      }
      const wIn=document.getElementById(`w-${id}-${i}`), rIn=document.getElementById(`r-${id}-${i}`);""")
rep('delete s.at; delete s.rest; delete s.rir; delete s.ss',
    'delete s.at; delete s.rest; delete s.rir; delete s.ss; delete s.liftContext')
rep("arr[+i][f]=el.value===''?null:num(el.value); if(f==='w'&&el.value!=='') delete arr[+i].wu0; return}",
    """const set=arr[+i], edited=el.value===''?null:num(el.value);
    set[f]=edited;
    if(f==='w'){
      if(edited!=null)delete set.wu0;
      delete set.targetContext;
    }
    if(set.d)pendingRender=true;
    return}""")
rep("        for(let j=0;j<r.sets;j++) arr.push(r.w!=null?{d:true,r:r.reps,w:r.w,src:'text'}:bw?{d:true,r:r.reps,w:0,src:'text'}:{d:true,r:r.reps,w:null,wu0:true,src:'text'});",
    """        const liftContext=liveLiftContext(k,lu.findIndex(slot=>slot.ex===id));
        for(let j=0;j<r.sets;j++){
          const weight=r.w!=null?r.w:bw?0:null;
          arr.push({d:true,r:r.reps,w:weight,src:'text',liftContext,...(weight==null?{wu0:true}:{})});
        }""")
