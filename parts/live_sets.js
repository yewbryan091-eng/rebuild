/* Next-set targets use today's confirmed work. Equipment details travel with each new set. */
function liveEquipmentContext(id){
  const equipment=equipOf(id);
  const legacyUnit=exOf(id).as?'assist':'total';
  const unit=assistOf(id)?'assist':['side','each'].includes(equipment.unit)?equipment.unit:'total';
  return {unit,legacyUnit,gym:String(equipment.gym||'').trim(),setup:String(equipment.setup||'').trim()};
}

function liveLiftContext(date,slotIndex){
  return liveSlotContext(lineupOf(date),slotIndex);
}

function liveSlotContext(lineup,slotIndex){
  const slot=lineup[slotIndex];
  if(!slot)return null;
  const group=slotLabels(lineup).grp[slotIndex];
  const superset=group?group.filter(index=>!lineup[index].skip).map(index=>lineup[index].ex):[];
  return {...liveEquipmentContext(slot.ex),superset:superset.length>1?superset:[]};
}

function liveEquipmentMatches(snapshot,current){
  if(!current)return false;
  const normalize=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
  if(!snapshot)return current.unit===current.legacyUnit&&!normalize(current.gym)&&!normalize(current.setup);
  return snapshot.unit===current.unit&&normalize(snapshot.gym)===normalize(current.gym)&&
    normalize(snapshot.setup)===normalize(current.setup);
}

function liveSetContextMatches(set,current,wasSuperset=false){
  if(!liveEquipmentMatches(set.liftContext,current))return false;
  const saved=set.liftContext?.superset;
  if(!Array.isArray(saved))return !wasSuperset&&!set.ss&&!current.superset.length;
  return saved.length===current.superset.length&&saved.every((id,index)=>id===current.superset[index]);
}

function liveRir(set){
  const rir=num(set.rir);
  return rir!=null&&Number.isInteger(rir)&&rir>=0&&rir<=4?rir:null;
}

function liveLoad(id,set,context){
  if(set.wu0)return null;
  const load=num(set.w);
  if(load!=null)return load>=0?load:null;
  return exOf(id).bw&&context.unit!=='assist'?0:null;
}

function liveLoadLabel(id,load,unit){
  if(exOf(id).bw&&unit!=='assist'&&load===0)return 'Bodyweight';
  return `${fmtW(load)} ${UNIT_LABEL[unit]||'kg'}`;
}

function liveSetLabel(id,set,context){
  const load=liveLoad(id,set,context), rir=liveRir(set);
  const effort=rir==null?'':` · ${rir===4?'4+':rir} left`;
  const weight=load==null?'Weight unknown':liveLoadLabel(id,load,context.unit);
  return `${weight} · ${num(set.r)} reps${effort}`;
}

function liveComparison(id,date,context,load,workIndex){
  if(load==null)return null;
  for(const session of sessionsOf(id,date,6)){
    const matched=session.all.filter(set=>!set.pain&&liveSetContextMatches(set,context,!!session.slot?.ss));
    const exact=matched[workIndex];
    if(exact&&liveLoad(id,exact,context)===load)return exact;
    const fallback=matched.find(set=>liveLoad(id,set,context)===load);
    if(fallback)return fallback;
  }
  return null;
}

// One usual increment for an easier set. Large steps call for choosing an available setup manually.
function liveEasierLoad(id,load,context){
  const increment=incOf(id), assisted=context.unit==='assist';
  if(!(increment>0))return null;
  if(!assisted&&(load===0||increment>load*0.20))return null;
  if(assisted&&increment>Math.max(5,load*0.25))return null;
  const easier=Math.round((load+(assisted?increment:-increment))*1000)/1000;
  return easier>=0?easier:null;
}

function liveSetAdvice(date,slot,slotIndex,day=getDay(date)){
  if(date!==todayKey()||day.finished||slot.skip)return null;
  const id=slot.ex, rows=(day.sets||{})[id]||[];
  const pain=rows.some(set=>set?.pain);
  let lastIndex=rows.length-1;
  while(lastIndex>=0&&!(rows[lastIndex]?.d&&!isWU(rows[lastIndex])&&num(rows[lastIndex].r)>0))lastIndex--;
  const count=Math.max(slot.sets,rows.length);
  if((lastIndex<0&&!pain)||count<=lastIndex+1)return null;
  let next=lastIndex+1;
  while(next<count&&(isWU(rows[next])||rows[next]?.d))next++;
  if(next>=count)return null;
  const context=liveLiftContext(date,slotIndex);
  if(!context)return null;

  const last=rows[lastIndex]||{}, repCount=num(last.r), rir=liveRir(last);
  const sameSetup=liveEquipmentMatches(last.liftContext,context);
  const load=sameSetup?liveLoad(id,last,context):null;
  const ref=liveComparison(id,date,context,load,doneSets(day,id).length-1);
  const target=(title,reason,weight=null,reps=null)=>({
    next,title,reason,weight,reps,unit:context.unit,
    today:lastIndex>=0?liveSetLabel(id,last,last.liftContext||context):null,
    previous:ref?liveSetLabel(id,ref,context):null
  });

  if(pain){
    return target('Pain or form flagged','Pause here. Choose a movement you can do without pain or loss of form.');
  }
  if(!sameSetup)return target('Changed setup','Log a work set on this setup to get a fresh target.');
  if(!liveSetContextMatches(last,context)){
    return target('Changed set format','Log a set in the current format to get a fresh target.');
  }
  if(load==null)return target('Weight unknown','Log the load on a work set to get a target.');
  if(rir==null)return target('How many reps did you have left?','Tap the last set number to log reps in reserve.');
  const lo=Math.max(1,Math.round(slot.lo)), hi=Math.max(lo,Math.round(slot.hi)), effort=effortOf(id);
  if(!Number.isFinite(lo)||!Number.isFinite(hi))return null;
  const elapsed=num(last.rest), restTarget=num(slot.rest);
  const superset=context.superset.length>1;
  const shortRest=elapsed!=null&&restTarget>0&&elapsed<restTarget*.75;
  if((rir<effort.lo||repCount<lo)&&shortRest){
    const rest=mmss(restTarget);
    return target('Take your full rest',superset?
      `Rest ${rest} after the round. Then reassess how much work you can do at the planned effort.`:
      `The last set followed a short break. Take ${rest} before reassessing the load.`);
  }

  if(rir<effort.lo||repCount<lo){
    const fewer=repCount-Math.max(1,effort.lo-rir);
    if(fewer>=lo){
      return target('Keep the load, trim the reps',`You finished with ${rir} left. Stop the next set with ${effort.txt}.`,
        load,Math.min(hi,fewer));
    }
    const easier=liveEasierLoad(id,load,context);
    const reason=repCount<lo?`You logged ${repCount} reps. The target starts at ${lo}.`:
      `You finished with ${rir} left. The target is ${effort.txt}.`;
    if(easier==null)return target('Choose an easier setup',`${reason} Choose an available variation or load that leaves more reps in reserve.`);
    return target(context.unit==='assist'?'Use a little more assistance':'Take one step down',
      `${reason}${superset?' Take the full rest after the round.':''}`,easier,lo);
  }
  if(rir>effort.hi&&!superset&&repCount<hi){
    return target('Keep the load, try one more rep',`You had ${rir===4?'4+':rir} left. Stop with ${effort.txt}.`,
      load,Math.min(hi,repCount+1));
  }
  return target('Repeat this load',superset?
    `Keep the same effort across the round. Finish with ${effort.txt}.`:
    `Aim for ${effort.txt} again and log what you complete.`,load,Math.min(hi,repCount));
}

function liveSetCard(id,advice){
  if(!advice)return '';
  const {next,title,reason,weight,reps,unit,today,previous}=advice;
  const actionable=weight!=null&&reps!=null;
  return `<aside class="live-set" data-live-set aria-label="Next set coaching">
    <div class="live-set-label">Next set · ${next+1}</div>
    <div class="live-set-main">
      <div><div class="live-set-action">${esc(title)}</div>${actionable?
        `<b class="num">${esc(liveLoadLabel(id,weight,unit))} × ${reps}</b>`:''}</div>
      ${actionable?`<button class="btn sm" data-act="liveapply" data-id="${esc(id)}" data-i="${next}">Use target</button>`:''}
    </div>
    <div class="small">${esc(reason)}</div>
    ${today?`<div class="live-set-history"><span>Today · ${esc(today)}</span>${previous?`<span>Comparable · ${esc(previous)}</span>`:''}</div>`:''}
  </aside>`;
}

function applyLiveSet(date,id,index){
  const lineup=lineupOf(date), slotIndex=lineup.findIndex(slot=>slot.ex===id&&!slot.skip);
  if(slotIndex<0)return;
  const advice=liveSetAdvice(date,lineup[slotIndex],slotIndex);
  if(!advice||advice.next!==index||advice.weight==null||advice.reps==null)return;
  const day=editDay(date);
  lineupFor(day,date);
  day.sets||={};
  const sets=day.sets[id]||=[];
  const set=sets[index]||={};
  if(set.d||isWU(set))return;
  set.w=advice.weight;
  set.r=advice.reps;
  delete set.wu0;
  set.targetContext=liveLiftContext(date,slotIndex);
  render();
  const input=document.getElementById(`r-${id}-${index}`);
  input?.closest('.set')?.querySelector('.tick')?.focus({preventScroll:true});
  toast('Target filled. Check the set after lifting.');
}
