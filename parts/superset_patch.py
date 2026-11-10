# ---------- superset with any exercise, from its swap sheet ----------
rep('''        <div class="row" style="gap:6px"><button class="btn sm danger" data-act="rmslot">Remove from today</button></div>''',
    '''        <div class="row" style="gap:6px"><button class="btn sm danger" data-act="rmslot">Remove from today</button></div>
        ${lu.length>1?`<div class="label">Superset with</div><div class="chips">${lu.map((s,j)=>j===p.i?'':`<button class="chipb${cur.ss&&s.ss===cur.ss?' on':''}" data-act="sswith" data-j="${j}">${esc(exOf(s.ex).n)}</button>`).join('')}</div>`:''}''')
rep("    case 'rmslot':", """    // tapping a partner moves it right under this exercise and links them; tapping a linked one unlinks it
    case 'sswith': {const d=editDay(k), lu=lineupFor(d,k), a=lu[S.pick.i], b=lu[+el.dataset.j];
      if(a.ss&&b.ss===a.ss){delete b.ss; tidySS(lu); toast(`${exOf(b.ex).n} unlinked`)}
      else {lu.splice(lu.indexOf(b),1); lu.splice(lu.indexOf(a)+1,0,b); const id=a.ss||uid().slice(0,6); a.ss=id; b.ss=id; tidySS(lu); toast(`Superset: ${exOf(a.ex).n} + ${exOf(b.ex).n}`)}
      closeLayer(); render(); break;}
    case 'rmslot':""")
