AW_CODE = (ROOT / 'parts/adaptive_week.js').read_text()
AW_CSS = (ROOT / 'parts/adaptive_week.css').read_text()

rep('</style>\n</head><body>', AW_CSS + '\n</style>\n</head><body>')
rep('/* ============ rendering ============ */', AW_CODE + '\n/* ============ rendering ============ */')
rep('equip:{},foods:{},weeks:{},mode:', 'equip:{},foods:{},weeks:{},adaptiveWeeks:{},mode:')
rep('foods:S.foods,weeks:S.weeks}', 'foods:S.foods,weeks:S.weeks,adaptiveWeeks:S.adaptiveWeeks}')
rep("weeks:'weeks',exercises:", "weeks:'weeks',adaptiveWeeks:'adaptiveWeeks',exercises:")
rep('S.weeks=local.weeks||{};S.customEx=', 'S.weeks=local.weeks||{};S.adaptiveWeeks=local.adaptiveWeeks||{};S.customEx=')

rep('  return nextUp(k);\n}', """  if(adaptiveWeekFor(mondayOf(k))&&adaptiveFixed(k)) return adaptiveFixedPlan(k);
  return nextUp(k);
}""")
rep('function nextUp(k){\n  if(k>todayKey())', """function nextUp(k){
  const adaptive=adaptivePlanFor(k);
  if(adaptive!==null) return adaptive;
  if(k>todayKey())""")
rep('const weekTarget = mon=>{const wk=S.weeks[mon];return wk&&wk.sessions&&wk.sessions.length?wk.sessions.length:4};',
    'const weekTarget = mon=>{const target=adaptiveTarget(mon);if(target!==null)return target;const wk=S.weeks[mon];return wk&&wk.sessions&&wk.sessions.length?wk.sessions.length:4};')
rep("const coachNote = k=>{const wk=S.weeks[mondayOf(k)];if(!wk)return '';const pid=planOf(k);",
    """const coachNote = k=>{
  const mon=mondayOf(k), adaptive=adaptiveWeekFor(mon), pid=planOf(k);
  if(adaptive&&k>=adaptive.start) return adaptive.sessions.find(s=>s?.date===k&&s.plan===pid)?.note||'';
  const wk=S.weeks[mon];if(!wk)return '';""")
rep("S.weeks[mondayOf(k)]?' <span class=\"small muted\">· coach plan</span>':''",
    "adaptivePlanFor(k)!==null?' <span class=\"small muted\">· adaptive week</span>':S.weeks[mondayOf(k)]?' <span class=\"small muted\">· coach plan</span>':''")
rep("    const rows=wk.sessions.map(s=>", "    const rows=adaptiveWeekFor(mon)?'':wk.sessions.map(s=>")
rep("      ${wk.fix?", "      ${adaptiveWeekFor(mon)?'<div class=\"small muted\">Your Adaptive week sets the workout days.</div>':''}\n      ${wk.fix?")
rep("let h=coachCard(mon)+coverageCard(", "let h=adaptiveWeekCard(mon)+coachCard(mon)+coverageCard(")
rep("open=kk>todayKey()&&pid==='rest'&&!day.plan;", "open=kk>todayKey()&&pid==='rest'&&!day.plan&&adaptivePlanFor(kk)===null;")
rep("function closeLayer(){document.getElementById('layer').innerHTML='';S.pick=null}",
    "function closeLayer(){document.getElementById('layer').innerHTML='';S.pick=null;S.awDraft=null}")
rep("case 'warm': {const d=editDay(k); d.warm=d.warm||{};",
    "case 'warm': {const d=editDay(k); if(adaptivePlanFor(k)!==null&&!d.plan)d.plan=planOf(k); d.warm=d.warm||{};")
rep("    case 'tab': S.tab=el.dataset.v; render(); window.scrollTo(0,0); break;", """    case 'tab': S.tab=el.dataset.v; render(); window.scrollTo(0,0); break;
    case 'awopen': adaptiveOpen(el.dataset.mon); break;
    case 'awday': adaptiveUpdateDate(el.dataset.k); break;
    case 'awcount': adaptiveUpdateCount(Number(el.dataset.n)); break;
    case 'awpreview': adaptivePreview(); break;
    case 'awapply': adaptiveApply(); break;
    case 'awreset': adaptiveReset(); break;""")
