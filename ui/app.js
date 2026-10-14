'use strict';
let state=null,filter='all',mode=readSetting('view','grid'),busy=false,checking=false,selected=null,lastCheck=null;
let updatingLauncher=false,launcherProgress=null,seenUpdateResult=null;
const progress=new Map();
const $=selector=>document.querySelector(selector);
const colors={iblock:'#2d81ff',ivolume:'#925cf6'};
function readSetting(key,fallback){try{return localStorage.getItem('idom-'+key)||fallback;}catch{return fallback;}}
function writeSetting(key,value){try{localStorage.setItem('idom-'+key,value);}catch{}}
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function button(cls,text,action){const node=el('button',cls,text);node.type='button';node.addEventListener('click',action);return node;}
function notice(text){$('#notice').hidden=!text;$('#notice').textContent=text||'';}
function inFilter(a,f){return f==='all'||f==='installed'&&!!a.installed||f==='updates'&&a.update===true||f==='available'&&!a.installed&&a.available&&a.osCompatible;}
function appStatus(a){
  if(progress.has(a.id))return {tone:'available',text:'Installazione in corso'};
  if(a.error)return {tone:'error',text:'Controllo non riuscito'};
  if(!a.osCompatible)return {tone:'unavailable',text:state.platform==='win32'?'Solo per macOS':`Richiede macOS ${a.minimum}`};
  if(a.update===true)return {tone:'update',text:'Aggiornamento disponibile'};
  if(a.installed&&a.update===null)return {tone:'update',text:'Versione da verificare'};
  if(a.installed)return {tone:'good',text:'Installata · aggiornata'};
  if(a.available)return {tone:'available',text:'Disponibile da installare'};
  return {tone:'unavailable',text:'Release non disponibile'};
}
function badge(a){const s=appStatus(a);return el('span','status-badge '+s.tone,s.text);}
function shortDescription(a){return a.id==='iblock'?'Blocca la tastiera per pulire il Mac':'Volume separato per ogni applicazione';}
function actionLabel(a){if(!a.osCompatible)return 'Non disponibile';if(a.installed&&a.update===true)return 'Aggiorna'+(/^v?\d/.test(a.latest||'')?' a '+a.latest.replace(/^v/,''):'');return a.installed?'Apri':'Installa';}
function primary(a){const b=button('primary'+(a.installed&&a.update!==true?' open':''),actionLabel(a),()=>a.installed&&a.update!==true?openApp(a):installApps([a]));b.disabled=busy||checking||!window.hub||!a.osCompatible||(!a.installed&&!a.available);return b;}
function phaseDisplay(a){const p=progress.get(a.id);const area=el('div','progress-area');const caption=el('div','progress-caption',`${p.phase}${p.phase==='Download'?` · ${p.progress}%`:''}`);const track=el('div','progress-track'+(p.phase==='Download'?'':' indeterminate'));track.setAttribute('role','progressbar');track.setAttribute('aria-label',p.phase);if(p.phase==='Download'){track.setAttribute('aria-valuenow',String(p.progress));track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');}const fill=el('div','progress-fill');if(p.phase==='Download')fill.style.width=p.progress+'%';track.append(fill);area.append(caption,track);return area;}
function renderCard(a,index){
  const card=el('article','card');card.dataset.id=a.id;card.style.setProperty('--app-color',colors[a.id]||'#74aaff');
  const strip=el('div','card-strip');const links=el('div','strip-links');links.append(button('hud-link','Dettagli ↗',()=>showDetails(a)),button('hud-link','GitHub ↗',()=>repository(a.id)));strip.append(el('span','number',String(index+1).padStart(2,'0')),links);card.append(strip);
  const content=el('div','card-content');const heading=el('div','app-heading');const icon=el('img','app-icon');icon.src='assets/'+a.icon;icon.alt='';icon.draggable=false;const title=button('title-button','',()=>showDetails(a));const h=el('h3');h.append(document.createTextNode('i'),el('span','',a.name.slice(1)));title.append(h,el('p','description',shortDescription(a)));heading.append(icon,title);content.append(heading,badge(a));
  const version=a.installed?`${a.installed.version} installata${a.update===true?' → '+a.latest+' disponibile':''}`:`${a.latest?'Release '+a.latest:'In attesa di una release'}`;const meta=el('p','meta',version);meta.append(el('small','',`macOS ${a.minimum}+${a.id==='ivolume'?' · Intel, Rosetta su Apple Silicon':' · Intel e Apple Silicon'}`));content.append(meta);
  const bottom=el('div','card-bottom');bottom.dataset.actionFor=a.id;
  if(progress.has(a.id)){bottom.append(phaseDisplay(a));}else{
    const menu=el('div','card-menu');menu.hidden=true;menu.setAttribute('role','menu');menu.append(button('','Dettagli dell’app',()=>{menu.hidden=true;showDetails(a);}),button('','Apri repository GitHub',()=>repository(a.id)));
    if(a.installed&&a.update===null&&a.available&&a.osCompatible){const link=button('','Collega l’ultima release',()=>{menu.hidden=true;installApps([a]);});link.disabled=busy;menu.append(link);}
    const more=button('square','⋯',()=>{const wasHidden=menu.hidden;document.querySelectorAll('.card-menu').forEach(m=>m.hidden=true);menu.hidden=!wasHidden;more.setAttribute('aria-expanded',String(!menu.hidden));});more.setAttribute('aria-label','Altre azioni per '+a.name);more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');bottom.append(primary(a),more);content.append(menu);
  }content.append(bottom);card.append(content);return card;
}
function renderRow(a){
  const row=el('tr');row.dataset.id=a.id;row.style.setProperty('--app-color',colors[a.id]);const cell=el('td');const info=el('div','table-app');const icon=el('img','table-icon');icon.src='assets/'+a.icon;icon.alt='';icon.draggable=false;const title=button('title-button','',()=>showDetails(a));title.append(el('div','table-name',a.name),el('div','table-category',a.category));info.append(icon,title);cell.append(info);const status=el('td');status.append(badge(a));const actions=el('td');const group=el('div','table-actions');group.dataset.actionFor=a.id;
  if(progress.has(a.id)){group.classList.add('table-progress');group.append(phaseDisplay(a));}else {const more=button('square','↗',()=>showDetails(a));more.setAttribute('aria-label','Dettagli di '+a.name);group.append(primary(a),more);}actions.append(group);row.append(cell,status,el('td','version-cell',a.installed?.version||'—'),el('td','version-cell',a.latest||'—'),actions);return row;
}
function render(){
  if(!state)return;
  renderLauncherUpdate();
  document.body.classList.toggle('mac',state.platform==='darwin');$('#platform').textContent=state.platform==='darwin'?'Per macOS':'Per Windows';
  for(const f of ['all','installed','updates','available']){const count=state.apps.filter(a=>inFilter(a,f)).length;$('#'+(f==='all'?'all':f==='available'?'available':f==='updates'?'update':'installed')+'-count').textContent=count;}
  document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});
  document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
  const q=$('#search').value.trim().toLocaleLowerCase('it');let apps=state.apps.filter(a=>inFilter(a,filter)&&`${a.name} ${a.description} ${a.category}`.toLocaleLowerCase('it').includes(q));const sort=$('#sort').value;if(sort==='name')apps.sort((a,b)=>a.name.localeCompare(b.name,'it'));if(sort==='status')apps.sort((a,b)=>Number(b.update===true)-Number(a.update===true)||Number(!!b.installed)-Number(!!a.installed));
  $('#view-title').textContent={all:'01 / Le tue applicazioni',installed:'01 / Applicazioni installate',updates:'01 / Aggiornamenti disponibili',available:'01 / Applicazioni da installare'}[filter];$('#result-count').textContent=`${apps.length} app`;
  $('#cards').replaceChildren(...apps.map(a=>renderCard(a,state.apps.indexOf(a))));$('#rows').replaceChildren(...apps.map(renderRow));$('#cards').hidden=mode!=='grid'||apps.length===0;$('#table-wrap').hidden=mode!=='table'||apps.length===0;$('#empty').hidden=apps.length!==0;$('#empty').textContent=q?'Nessuna app corrisponde alla ricerca.':filter==='updates'?'Le tue app sono aggiornate.':filter==='available'?'Nessuna app da installare per questo sistema.':'Nessuna app in questa sezione.';
  const updates=state.apps.filter(a=>a.update===true&&a.available&&a.osCompatible).length;$('#update-all').hidden=!updates;$('#update-all').textContent=`Aggiorna tutte (${updates})`;$('#update-all').disabled=busy||checking||!window.hub;$('#refresh').disabled=busy||checking||!window.hub;$('#refresh').classList.toggle('checking',checking);$('#checked').textContent=checking?'Controllo aggiornamenti…':lastCheck?'Controllato '+lastCheck.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})+' · GitHub':window.hub?'Controllo in attesa':'Anteprima';
}
async function refresh(){if(busy||checking||!window.hub)return;checking=true;render();try{state=await window.hub.catalog();lastCheck=new Date();}catch(e){notice(e.message);}finally{checking=false;render();}}
async function installApps(apps){
  if(busy||checking||!window.hub)return;busy=true;notice('');render();const errors=[],done=[];
  try{for(const a of apps){progress.set(a.id,{phase:'Preparazione',progress:0});render();try{state=await window.hub.install(a.id);done.push(a.name);}catch(e){errors.push(`${a.name}: ${e.message}`);state=await window.hub.catalog().catch(()=>state);}finally{progress.delete(a.id);render();}}lastCheck=new Date();notice([done.length?`${done.join(', ')} ${done.length===1?'è pronta':'sono pronte'}. Puoi aprire ${done.length===1?'l’app':'le app'} dal launcher.`:'',...errors].filter(Boolean).join('\n'));}finally{busy=false;render();}
}
async function openApp(a){try{await window.hub.open(a.id);}catch(e){notice(e.message);}}
async function repository(id){try{if(id==='launcher')await window.hub.project();else await window.hub.repository(id);}catch(e){notice(e.message);}}
async function project(){try{if(window.hub?.project)await window.hub.project();}catch(e){notice(e.message);}}
function showDetails(a){
  selected=a;$('#detail-title').textContent=a.name;$('#detail-description').textContent=a.description;const meta=$('#detail-meta');meta.replaceChildren();for(const [label,value] of [['Installata',a.installed?.version||'Non installata'],['Ultima release',a.latest||'Non disponibile'],['Compatibilità',`macOS ${a.minimum}+`],...(a.architectureNote?[['Architettura',a.architectureNote]]:[]),...(a.error?[['Controllo release',a.error]]:[])])meta.append(el('dt','',label),el('dd','',value));$('#detail-notes').textContent=(a.notes||'').trim()||'Questa release non contiene note di aggiornamento.';$('#detail-reinstall').hidden=!(a.installed&&a.update===null&&a.available&&a.osCompatible);$('#detail-reinstall').disabled=busy||checking;if(!$('#details').open)$('#details').showModal();
}
function applyTheme(){const choice=$('#theme').value;const actual=choice==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):choice;document.documentElement.dataset.theme=actual;writeSetting('theme',choice);}
function renderLauncherUpdate(){
  const l=state?.launcher;
  $('#launcher-update-banner').hidden=!(l?.available||updatingLauncher);
  $('#launcher-update-title').textContent=l?.latest?`iDom Launcher ${l.latest} è disponibile`:'Aggiornamento di iDom Launcher';
  $('#launcher-update-button').disabled=busy||checking||!l?.supported;
  $('#launcher-update-button').textContent=updatingLauncher?'Aggiornamento in corso…':'Aggiorna e riavvia';
  $('#launcher-update-cancel').hidden=!updatingLauncher||launcherProgress?.phase==='Riavvio';
  $('#launcher-progress-caption').textContent=launcherProgress?`${launcherProgress.phase}${launcherProgress.phase==='Download'?` · ${launcherProgress.progress}%`:''}`:'';
  $('#launcher-progress-track').hidden=!launcherProgress;
  $('#launcher-progress-fill').style.width=(launcherProgress?.progress||0)+'%';
  $('#launcher-check').disabled=busy||checking;
  $('#launcher-status').textContent=l?.error?l.error:l?.available?`Versione ${l.current} · disponibile ${l.latest}`:`Versione ${l?.current||''} · il launcher è aggiornato`;
  if(l?.available&&!l.supported)$('#launcher-status').textContent+=' · usa la versione installata';
  if(l?.result&&!l.result.success&&seenUpdateResult!==l.result.token){seenUpdateResult=l.result.token;notice(l.result.message);}
}
async function updateLauncher(){
  if(busy||checking||!state?.launcher?.supported)return;
  busy=true;updatingLauncher=true;launcherProgress={phase:'Preparazione',progress:0};notice('');render();
  try{await window.hub.updateLauncher();}catch(e){busy=false;updatingLauncher=false;launcherProgress=null;notice(e.message);render();}
}
$('#launcher-update-button').addEventListener('click',updateLauncher);
$('#launcher-update-cancel').addEventListener('click',()=>window.hub.cancelLauncherUpdate().catch(e=>notice(e.message)));
$('#launcher-check').addEventListener('click',refresh);
$('#launcher-update-notes').addEventListener('click',()=>{const l=state.launcher;showDetails({id:'launcher',name:'iDom Launcher',description:'Aggiornamento del launcher. Verrà scaricato, verificato e installato prima del riavvio.',installed:{version:l.current},latest:l.latest,minimum:'13.0',notes:l.notes||''});});
$('#theme').value=readSetting('theme','system');if(!['system','dark','light'].includes($('#theme').value))$('#theme').value='system';applyTheme();$('#auto-check').checked=readSetting('auto-check','true')==='true';
$('#theme').addEventListener('change',applyTheme);matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if($('#theme').value==='system')applyTheme();});$('#auto-check').addEventListener('change',()=>writeSetting('auto-check',String($('#auto-check').checked)));
$('#settings-open').addEventListener('click',()=>$('#settings').showModal());$('#settings-close').addEventListener('click',()=>$('#settings').close());$('#close-details').addEventListener('click',()=>$('#details').close());$('#detail-repo').addEventListener('click',()=>repository(selected.id));$('#detail-reinstall').addEventListener('click',()=>{$('#details').close();installApps([selected]);});
for(const id of ['project','footer-project','settings-project'])$('#'+id).addEventListener('click',project);
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;render();}));document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;writeSetting('view',mode);render();}));if(!['grid','table'].includes(mode))mode='grid';$('#sort').addEventListener('change',render);$('#search').addEventListener('input',render);$('#refresh').addEventListener('click',()=>{notice('');refresh();});$('#update-all').addEventListener('click',()=>installApps(state.apps.filter(a=>a.update===true&&a.available&&a.osCompatible)));
document.addEventListener('click',e=>{if(!e.target.closest('.card-menu,.square')){document.querySelectorAll('.card-menu').forEach(m=>m.hidden=true);document.querySelectorAll('[aria-haspopup=menu]').forEach(b=>b.setAttribute('aria-expanded','false'));}});
const editable=target=>target instanceof Element&&!!target.closest('input,textarea,[contenteditable=true]');document.addEventListener('selectstart',e=>{if(!editable(e.target))e.preventDefault();});document.addEventListener('dragstart',e=>{if(!editable(e.target))e.preventDefault();});document.addEventListener('contextmenu',e=>{if(!editable(e.target))e.preventDefault();});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'&&!editable(e.target))e.preventDefault();});
if(window.hub?.info)window.hub.info().then(info=>{document.querySelector('footer .version').textContent='v'+info.version;$('#settings-version').textContent='iDom Launcher '+info.version+' · Domenico Colella';}).catch(()=>{});
if(window.hub?.onLauncherProgress)window.hub.onLauncherProgress(p=>{launcherProgress=p;renderLauncherUpdate();});
if(window.hub?.ready)window.hub.ready().catch(()=>{});
if(window.hub){window.hub.onProgress(p=>{progress.set(p.id,p);document.querySelectorAll(`[data-action-for="${p.id}"]`).forEach(area=>{const a=state?.apps.find(a=>a.id===p.id);if(a)area.replaceChildren(phaseDisplay(a));});});refresh();setInterval(()=>{if($('#auto-check').checked)refresh();},15*60*1000);}else{notice('Anteprima dell’interfaccia. Per installare e aprire le app usa il launcher desktop.');state={platform:'darwin',apps:[{id:'iblock',name:'iBlock',description:'Blocca temporaneamente la tastiera e il puntatore per pulire il Mac.',category:'Utility',icon:'iblock.png',minimum:'13.0',latest:'v2.3.3',available:false,osCompatible:true},{id:'ivolume',name:'iVolume',description:'Regola separatamente il volume delle applicazioni sul Mac.',category:'Audio',icon:'ivolume.png',minimum:'14.2',latest:'iVolume',available:false,osCompatible:true,architectureNote:'Intel; Rosetta su Apple Silicon.'}]};render();}
