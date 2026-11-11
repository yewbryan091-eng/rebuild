# ---------- type your own exercise when the library doesn't have it ----------
rep("""    return hits.length?hits.slice(0,80).map(row).join(''):'<div class="muted" style="padding:12px 0">Nothing matches. Try one word, like “row” or “incline”.</div>';""",
    """    const mine=`<button class="pk" data-act="newex"><div class="pn">+ Add “${esc(p.q.trim())}” as your own exercise</div><div class="pm">Saved under ${esc(GROUPS[p.g]||'Core')} · tap a muscle chip first to change it</div></button>`;
    return (hits.length?hits.slice(0,80).map(row).join(''):'<div class="muted" style="padding:12px 0">Not in the library. Add it as your own:</div>')+mine;""")
rep("    case 'rmslot':", """    case 'newex': {const name=S.pick.q.trim().replace(/\\s+/g,' ').slice(0,60); if(!name) break;
      const g=S.pick.g||'core', id='x_'+uid().slice(0,8); S.customEx[id]={n:name.charAt(0).toUpperCase()+name.slice(1),g}; queueSave('exercises/'+id); applyCustomEx();
      const d=editDay(k), lu=lineupFor(d,k);
      if(S.pick.mode==='swap'){lu[S.pick.i].ex=id; closeLayer(); toast(`Swapped to ${EX[id].n}`)}
      else {lu.push(slotOf(id,'i')); S.pick.q=''; renderPicker(); toast(`Added ${EX[id].n}`)}
      render(); break;}
    case 'rmslot':""")
