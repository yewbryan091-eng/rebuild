/* ============ state + storage ============ */
// Local-first: every change lands on this phone at once and waits in an outbox until it reaches the cloud.
const S = {tab:'today',date:todayKey(),days:{},profile:{},scans:[],tpl:{},customs:{},customEx:{},equip:{},foods:{},weeks:{},mode:'loading',draft:null,editMeal:null,scanDraft:null,sheet:null,pick:null,logf:'all',dirty:new Set(),saving:0,user:null};
const SB_URL='https://hzutrayxpqzeaxwbuafi.supabase.co', SB_KEY='sb_publishable_Dg0tQQN7f3ZO6g-dDCsCSg_ML6I_RhW';
const sb = window.supabase ? window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}) : null;
const LSK='rebuild:v2', OUTK='rebuild:outbox', PULLK='rebuild:pulled';
function lsLoad(){try{return JSON.parse(localStorage.getItem(LSK))||null}catch(e){return null}}
function lsSave(){try{localStorage.setItem(LSK,JSON.stringify({days:S.days,profile:S.profile,scans:S.scans,tpl:S.tpl,customs:S.customs,customEx:S.customEx,equip:S.equip,foods:S.foods,weeks:S.weeks}))}catch(e){toast('This phone is out of storage space.')}}
// callers change the doc right after editDay() returns, so the copy is written once the current tap has finished
let lsPending=false;
function lsSoon(){if(lsPending)return;lsPending=true;setTimeout(()=>{lsPending=false;lsSave()},0)}

/* each cloud path maps onto one part of S */
const splitPath=p=>{const i=p.indexOf('/');return [p.slice(0,i),p.slice(i+1)]};
const BAGS={days:'days',templates:'tpl',customs:'customs',weeks:'weeks',exercises:'customEx',equip:'equip',foods:'foods'};
function docGet(path){
  const [c,id]=splitPath(path);
  if(c==='profile') return S.profile;
  if(c==='scans'){const s=S.scans.find(x=>x.id===id);if(!s)return null;const {id:_,...rest}=s;return rest}
  return BAGS[c]?(S[BAGS[c]][id]??null):null;
}
function docPut(path,data){
  const [c,id]=splitPath(path);
  if(c==='profile'){S.profile=data||{};return}
  if(c==='scans'){S.scans=S.scans.filter(x=>x.id!==id);if(data)S.scans=[{id,...data},...S.scans].sort((a,b)=>a.date<b.date?1:-1);return}
  if(!BAGS[c]) return;
  if(data) S[BAGS[c]][id]=data; else delete S[BAGS[c]][id];
}

let outbox=(()=>{try{return JSON.parse(localStorage.getItem(OUTK))||{}}catch(e){return {}}})();
const saveOutbox=()=>{try{localStorage.setItem(OUTK,JSON.stringify(outbox))}catch(e){}};
function queueSave(path){
  outbox[path]=Date.now(); saveOutbox(); S.dirty.add(path); lsSoon();
  clearTimeout(queueSave.t); queueSave.t=setTimeout(push,700); setSync();
}
let pushing=false;
async function push(){
  if(pushing||!sb||!S.user||!navigator.onLine){setSync();return}
  const paths=Object.keys(outbox); if(!paths.length){setSync();return}
  pushing=true; S.saving++; setSync();
  try{
    const rows=paths.map(p=>{const d=docGet(p);return {user_id:S.user.id,path:p,data:d==null?null:JSON.parse(JSON.stringify(d)),deleted:d==null,client_ts:outbox[p]}});
    const {error}=await sb.from('docs').upsert(rows,{onConflict:'user_id,path'});
    if(error) throw error;
    // a path edited again while it was in flight stays in the outbox for the next push
    rows.forEach(r=>{if(outbox[r.path]===r.client_ts){delete outbox[r.path];S.dirty.delete(r.path)}});
    saveOutbox(); S.lastSync=Date.now(); S.syncErr='';
  }catch(e){S.syncErr=(e&&e.message)||'Couldn’t reach the cloud'}
  pushing=false; S.saving--; setSync();
  if(Object.keys(outbox).length&&!S.syncErr) setTimeout(push,1500);
}
async function pull(){
  if(!sb||!S.user||!navigator.onLine) return false;
  const since=+localStorage.getItem(PULLK)||0;
  // look back a minute so a row committed a moment late is never skipped; re-applying a row is harmless
  const from=new Date(Math.max(0,since-60000)).toISOString();
  let maxTs=since, changed=false;
  for(let off=0;;off+=500){
    const {data,error}=await sb.from('docs').select('path,data,deleted,updated_at').gt('updated_at',from).order('updated_at').range(off,off+499);
    if(error) throw error;
    for(const r of data){
      maxTs=Math.max(maxTs,Date.parse(r.updated_at)||0);
      if(outbox[r.path]) continue; // this phone has a newer unsent edit
      docPut(r.path,r.deleted?null:r.data); changed=true;
    }
    if(data.length<500) break;
  }
  try{localStorage.setItem(PULLK,String(maxTs))}catch(e){}
  if(changed){applyCustomEx();freezeOldPlans();lsSave()}
  return changed;
}
let syncing=false;
async function syncAll(){
  if(syncing||!S.user||!navigator.onLine){setSync();return}
  syncing=true;
  try{await push(); if(await pull()) requestRender()}catch(e){S.syncErr=(e&&e.message)||'Couldn’t reach the cloud'}
  syncing=false; setSync();
  uploadPhotos(); estimatePending(); coachCheck();
}
function setSync(){
  const el=document.getElementById('sync'); if(!el) return;
  const n=Object.keys(outbox).length;
  let c='sync', t='Synced';
  if(S.mode==='loading'){c='sync busy';t='Loading'}
  else if(!S.user){c='sync local';t='Sign in to sync'}
  else if(!navigator.onLine){c='sync local';t=n?`Offline · ${n} to sync`:'Offline · saved'}
  else if(S.saving||n){c='sync busy';t='Syncing'}
  el.className=c; el.lastChild.textContent=t;
}
// exercises he typed in himself join the library, each as its own "movement" family
function applyCustomEx(){
  for(const [id,c] of Object.entries(S.customEx)){
    if(EX[id]&&EX[id].mine){EX[id].n=c.n;EX[id].g=c.g;EX[id].m=GROUPS[c.g]||'';continue}
    const fam=FAMS.length; FAMS.push([id]);
    EX[id]={n:c.n,g:c.g,fam,m:GROUPS[c.g]||'',an:null,p:null,inc:2.5,sc:'i',bw:0,as:0,mine:1,
      c:['Your own exercise: same setup every time, so the numbers compare week to week.','Control the lowering, full range, stop 1–2 reps before failure.'],x:'Ego weight or half reps.'};
  }
}
const getDay = k=>S.days[k]||{date:k};
function editDay(k){
  if(!S.days[k]) S.days[k]={date:k};
  const d=S.days[k]; d.date=k;
  queueSave('days/'+k);
  return d;
}
function saveProfile(){queueSave('profile/me')}

async function init(){
  const local=lsLoad();
  if(local){S.days=local.days||{};S.profile=local.profile||{};S.scans=local.scans||[];S.tpl=local.tpl||{};S.customs=local.customs||{};S.weeks=local.weeks||{};S.customEx=local.customEx||{};S.equip=local.equip||{};S.foods=local.foods||{}}
  applyCustomEx();
  render();
  if(sb){
    // the saved session works with no signal; the token refreshes once the phone is back online
    try{const {data}=await sb.auth.getSession(); S.user=data&&data.session?data.session.user:null}catch(e){}
    sb.auth.onAuthStateChange((ev,session)=>{
      const was=S.user; S.user=session?session.user:null;
      if(S.user&&(!was||was.id!==S.user.id)){closeLayer();S.mode='ready';render();syncAll()}
      if(!S.user&&was){render()}
      setSync();
    });
  }
  S.mode='ready';
  if(!S.profile.start&&Object.keys(S.days).length){S.profile.start=todayKey();saveProfile()}
  freezeOldPlans(); setSync(); render();
  if(S.user) syncAll();
}
addEventListener('online',syncAll);
addEventListener('offline',setSync);
addEventListener('pagehide',()=>{lsSave();saveOutbox()});
setInterval(()=>{if(!document.hidden)syncAll()},60000);

/* ============ photos ============ */
// Meal photos stay in this phone's IndexedDB, and upload to private cloud storage whenever there's signal.
const PDB=new Promise((res,rej)=>{const r=indexedDB.open('rebuild-photos',1);r.onupgradeneeded=()=>r.result.createObjectStore('p');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function idb(mode,fn){const db=await PDB;return new Promise((res,rej)=>{const tx=db.transaction('p',mode);const q=fn(tx.objectStore('p'));tx.oncomplete=()=>res(q?q.result:undefined);tx.onerror=()=>rej(tx.error)})}
const photoGet=id=>idb('readonly',st=>st.get(id));
const photoPut=(id,rec)=>idb('readwrite',st=>st.put(rec,id));
const photoDel=id=>idb('readwrite',st=>st.delete(id));
const photoKeys=()=>idb('readonly',st=>st.getAllKeys());
const photoPath=id=>`${S.user.id}/${id}.jpg`;
const photoURLs={};
async function photoURL(id){
  if(photoURLs[id]) return photoURLs[id];
  let rec=null; try{rec=await photoGet(id)}catch(e){}
  if(!rec&&sb&&S.user&&navigator.onLine){
    const {data,error}=await sb.storage.from('photos').download(photoPath(id));
    if(!error&&data){rec={blob:data,up:true};try{await photoPut(id,rec)}catch(e){}}
  }
  return rec?(photoURLs[id]=URL.createObjectURL(rec.blob)):null;
}
// after each render, fill in <img data-ph> from this phone, or from the cloud the first time
function hydratePhotos(root){
  root.querySelectorAll('img[data-ph]').forEach(async img=>{
    const u=await photoURL(img.dataset.ph);
    if(u){img.src=u;const b=img.closest('[data-act="lightbox"]');if(b)b.dataset.src=u}
  });
}
async function savePhoto(blob){const id=uid();await photoPut(id,{blob,up:false});uploadPhotos();return id}
let uploading=false;
async function uploadPhotos(){
  if(uploading||!sb||!S.user||!navigator.onLine) return;
  uploading=true;
  try{
    for(const id of await photoKeys()){
      const rec=await photoGet(id); if(!rec||rec.up) continue;
      const {error}=await sb.storage.from('photos').upload(photoPath(id),rec.blob,{contentType:'image/jpeg',upsert:true});
      if(!error){rec.up=true;await photoPut(id,rec)}
    }
  }catch(e){}
  uploading=false;
}
async function deletePhotos(ids){
  for(const id of ids){try{await photoDel(id)}catch(e){} if(photoURLs[id]){URL.revokeObjectURL(photoURLs[id]);delete photoURLs[id]}}
  if(sb&&S.user&&navigator.onLine){try{await sb.storage.from('photos').remove(ids.map(photoPath))}catch(e){}}
}

/* ============ Claude ============ */
// Every AI call goes through the "ai" function in Supabase, which holds the API key.
const AI_MAX_PHOTOS=4;
const blobB64=blob=>new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]);fr.onerror=()=>rej(fr.error);fr.readAsDataURL(blob)});
function parseJSON(t){
  const s=String(t||'').replace(/^```(?:json)?\s*/,'').replace(/\s*```\s*$/,'').trim();
  try{return JSON.parse(s)}catch(e){const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a>=0&&b>a){try{return JSON.parse(s.slice(a,b+1))}catch(e2){}}}
  throw {code:'invalid_json'};
}
async function aiJSON(prompt,{images=[],effort='medium'}={}){
  if(!navigator.onLine) throw {code:'offline'};
  if(!sb||!S.user) throw {code:'signed_out'};
  const imgs=[]; for(const b of images.slice(0,AI_MAX_PHOTOS)) imgs.push(await blobB64(b));
  const {data}=await sb.auth.getSession(); const token=data&&data.session&&data.session.access_token;
  if(!token) throw {code:'signed_out'};
  let r;
  try{r=await fetch(`${SB_URL}/functions/v1/ai`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,apikey:SB_KEY},body:JSON.stringify({prompt,images:imgs,effort})})}
  catch(e){throw {code:navigator.onLine?'upstream':'offline'}}
  let j=null; try{j=await r.json()}catch(e){}
  if(!j) throw {code:'upstream'};
  if(j.error) throw j.error;
  return parseJSON(j.text);
}
const AI_ERR = {offline:'No signal right now. Save the photos and Claude estimates them when you’re back online.',signed_out:'Sign in first: tap the sync status at the top.',no_key:'The Claude API key isn’t set up yet.',bad_key:'The Claude API key was rejected. Check it in Supabase.',no_access:'This API key isn’t allowed to use that Claude model. Check the key’s workspace in the Claude Console.',no_credit:'Your Claude API credit has run out. Top up at console.anthropic.com.',rate_limited:'Too many requests right now. Try again in a minute.',image_rejected:'One of the photos couldn’t be read. Try a different shot.',refused:'Claude couldn’t estimate this one. Type the numbers instead.',invalid_json:'The answer came back garbled. Try again.',empty_completion:'Nothing came back. Add a note and try again.',upstream:'Couldn’t reach Claude. Try again.',bad_request:'That request didn’t go through. Try again.'};
const errMsg = e=>AI_ERR[e&&e.code]||'Couldn’t reach Claude. Try again.';
