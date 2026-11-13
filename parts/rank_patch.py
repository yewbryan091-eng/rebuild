RANK_CODE = (ROOT / 'parts/rank.js').read_text()
RANK_CSS = (ROOT / 'parts/rank.css').read_text()

rep('</style>\n</head><body>', RANK_CSS + '\n</style>\n</head><body>')
rep('.tabs{display:grid;grid-template-columns:repeat(4,1fr)}',
    '.tabs{display:grid;grid-template-columns:repeat(5,1fr)}')
rep('    <button data-act="tab" data-v="food">', '''    <button data-act="tab" data-v="rank"><svg viewBox="0 0 24 24"><path d="m12 3 7 4v6l-7 8-7-8V7zM9 12l2 2 4-4"/></svg>Rank</button>
    <button data-act="tab" data-v="food">''')
rep('/* ============ rendering ============ */', RANK_CODE + '\n/* ============ rendering ============ */')
rep("S.tab==='food'?viewFood(k):viewBody(k);", "S.tab==='food'?viewFood(k):S.tab==='rank'?rankView(k):viewBody(k);")
rep('  mountFigs(v); hydratePhotos(v); setSync(); renderRest();',
    "  rankDraw(v.querySelector('#rank-map')); mountFigs(v); hydratePhotos(v); setSync(); renderRest();")
rep("else if(pk) motiv=`Last ${plan.n} day (${nice(pk)}): ${dayVolume(S.days[pk]).toLocaleString()} kg moved. Beat it.`;",
    "else if(pk) motiv=`Last ${plan.n} day: ${nice(pk)}. Use the targets on your exercise cards.`;")
rep('  if(day.finished) return h+doneCard(k)+cardioCard(k);',
    '  h+=rankFocusCard(k);\n  if(day.finished) return h+rankRecap(k)+doneCard(k)+cardioCard(k);')
rep('<section class="card ex${grp?', '<section data-rank-exercise="${esc(id)}" class="card ex${grp?')

rep("    case 'closebtn': closeLayer(); break;", """    case 'closebtn': closeLayer(); break;
    case 'rankgroup': {
      S.rankGroup=el.dataset.g; render();
      document.querySelector('.rank-pick[aria-pressed="true"]')?.focus({preventScroll:true});
      break;}
    case 'rankmap': {
      const box=el.getBoundingClientRect();
      const group=rankDraw(el,{x:(ev.clientX-box.left)*el.width/box.width,y:(ev.clientY-box.top)*el.height/box.height});
      if(group){S.rankGroup=group; render()}
      break;}
    case 'rankfocus': {
      const group=el.dataset.g;
      if(k!==todayKey()||getDay(k).finished||!MAIN_GROUPS.includes(group))break;
      const slots=rankOptions(k,group);
      if(!slots.length)break;
      const target=Math.min(3,slots.reduce((n,slot)=>n+slot.sets,0));
      editDay(k).rankFocus={group,target};
      S.tab='today'; render(); window.scrollTo(0,0); break;}
    case 'rankclear':
      if(k===todayKey()&&!getDay(k).finished){delete editDay(k).rankFocus; render()}
      break;
    case 'rankexercise': rankJump(el.dataset.id); break;""")

# Keep log validation consistent with the coaching engine.
rep("if(s.w==null&&!s.wu0&&EX[id].bw) s.w=0;", "if(s.w==null&&!s.wu0&&EX[id].bw&&!assistOf(id)) s.w=0;")
rep("if(s.r==null){toast('Enter the reps first.');break}", "if(!(num(s.r)>0)){toast('Enter the reps you completed.');break}")
rep("const arr=d.sets[id]=(d.sets[id]||[]).filter(s=>s&&s.d), bw=exOf(id).bw;",
    "const arr=d.sets[id]=(d.sets[id]||[]).filter(s=>s&&s.d), bw=exOf(id).bw&&!assistOf(id);")
rep("    case 'shortgo': {const d=editDay(k), lu=lineupFor(d,k), r=pickShort(lu,+el.dataset.m,k);",
    """    case 'shortgo': {const d=editDay(k), lu=lineupFor(d,k), r=pickShort(lu,+el.dataset.m,k);
      if(!r.keep.length){toast('No remaining exercise group fits that time.');break}""")
