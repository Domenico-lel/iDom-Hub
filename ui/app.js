'use strict';
let state=null,filter='all',mode=readSetting('view','grid'),busy=false,checking=false,selected=null,lastCheck=null;
let updatingLauncher=false,launcherProgress=null,seenUpdateResult=null;
let guideApp=null,guideQueue=[],guideStage=0,guideReturnFocus=null;
let openActions=null;
const openingApps=new Set();
const progress=new Map();
const $=selector=>document.querySelector(selector);
const colors={'prompt-builder':'#eca7d7',iblock:'#2d81ff',ivolume:'#925cf6'};
function readSetting(key,fallback){try{return localStorage.getItem('idom-'+key)||fallback;}catch{return fallback;}}
function writeSetting(key,value){try{localStorage.setItem('idom-'+key,value);}catch{}}
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function button(cls,text,action){const node=el('button',cls,text);node.type='button';node.addEventListener('click',action);return node;}
function notice(text){$('#notice').hidden=!text;$('#notice').textContent=text||'';}
function inFilter(a,f){return f==='all'||f==='installed'&&!!a.installed||f==='updates'&&a.update===true||f==='available'&&a.type!=='web'&&!a.installed&&a.available&&a.osCompatible;}
function appStatus(a){
  if(a.type==='web')return {tone:'good',text:'App web · pronta all’uso'};
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
function shortDescription(a){if(a.type==='web')return a.description;return a.id==='iblock'?'Blocca la tastiera per pulire il Mac':'Volume separato per ogni applicazione';}
function versionLabel(a){return a.latestVersion||(/^v?\d+(?:\.\d+)*$/.test(a.latest||'')?a.latest.replace(/^v/,''):null);}
function compatibilityLabel(a){if(a.type==='web')return 'Browser web · macOS e Windows';return a.id==='launcher'?(state.platform==='darwin'?'macOS 13 o successivo':'Windows 64 bit'):`macOS ${a.minimum} o successivo`;}
function actionLabel(a){if(a.type==='web')return 'Apri sito';if(!a.osCompatible)return 'Non disponibile';if(a.installed&&a.update===true)return 'Aggiorna'+(versionLabel(a)?' a '+versionLabel(a):'');return a.installed?'Apri':'Installa';}
function primary(a){const b=button('primary',actionLabel(a),()=>a.type==='web'||a.installed&&a.update!==true?openApp(a):installApps([a]));b.disabled=busy||checking||!window.hub||!a.osCompatible||(!a.installed&&!a.available);return b;}
function phaseDisplay(a){const p=progress.get(a.id);const area=el('div','progress-area');const caption=el('div','progress-caption',`${p.phase}${p.phase==='Download'?` · ${p.progress}%`:''}`);const track=el('div','progress-track'+(p.phase==='Download'?'':' indeterminate'));track.setAttribute('role','progressbar');track.setAttribute('aria-label',p.phase);if(p.phase==='Download'){track.setAttribute('aria-valuenow',String(p.progress));track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');}const fill=el('div','progress-fill');if(p.phase==='Download')fill.style.width=p.progress+'%';track.append(fill);area.append(caption,track);return area;}
function renderCard(a,index){
  const card=el('article','card');card.dataset.id=a.id;card.style.setProperty('--app-color',colors[a.id]||'#74aaff');
  const strip=el('div','card-strip');strip.append(button('hud-link','Dettagli',()=>showDetails(a)));card.append(strip);
  const content=el('div','card-content');const heading=el('div','app-heading');const icon=el('img','app-icon');icon.src='assets/'+a.icon;icon.alt='';icon.draggable=false;const title=el('div','app-title');const h=el('h3');h.append(document.createTextNode(a.name[0]),el('span','',a.name.slice(1)));title.append(h,el('p','description',shortDescription(a)));heading.append(icon,title);content.append(heading,badge(a));
  const version=a.type==='web'?'Nessuna installazione richiesta':a.installed?`${a.installed.version} installata${a.update===true?' → '+(versionLabel(a)||'nuova release')+' disponibile':''}`:`${versionLabel(a)?'Versione '+versionLabel(a):a.latest?'Release disponibile':'In attesa di una release'}`;const meta=el('p','meta',version);meta.append(el('small','',a.type==='web'?'Si apre nel browser predefinito':`macOS ${a.minimum}+${a.requiresRosetta?' · Intel (su Apple Silicon serve Rosetta)':a.architectures?' · '+a.architectures:''}`));content.append(meta);
  const bottom=el('div','card-bottom');bottom.dataset.actionFor=a.id;
  if(progress.has(a.id)){bottom.append(phaseDisplay(a));}else{
    bottom.append(primary(a));
    if(a.installed&&state.platform==='darwin'){
      const menu=el('div','card-menu');menu.hidden=true;menu.id='actions-'+a.id;menu.setAttribute('aria-label','Azioni per '+a.name);
      menu.append(button('','Guida al primo avvio',()=>{closeActions(true);showLaunchGuide(a);}));
      if(a.update===null&&a.available&&a.osCompatible){const link=button('','Collega l’ultima versione',()=>{closeActions();installApps([a]);});link.disabled=busy;menu.append(link);}
      const more=button('square','⋯',()=>toggleActions(more,menu));more.setAttribute('aria-label','Altre azioni per '+a.name);more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls',menu.id);
      bottom.append(more);card._actions=menu;
    }
  }content.append(bottom);if(card._actions){content.append(card._actions);delete card._actions;}card.append(content);return card;
}
function renderRow(a){
  const row=el('tr');row.dataset.id=a.id;row.style.setProperty('--app-color',colors[a.id]);const cell=el('td');const info=el('div','table-app');const icon=el('img','table-icon');icon.src='assets/'+a.icon;icon.alt='';icon.draggable=false;const title=el('div','app-title');title.append(el('div','table-name',a.name),el('div','table-category',a.category));info.append(icon,title);cell.append(info);const status=el('td');status.append(badge(a));const actions=el('td');const group=el('div','table-actions');group.dataset.actionFor=a.id;
  if(progress.has(a.id)){group.classList.add('table-progress');group.append(phaseDisplay(a));}else {const more=button('secondary','Dettagli',()=>showDetails(a));more.setAttribute('aria-label','Dettagli di '+a.name);group.append(primary(a),more);}actions.append(group);row.append(cell,status,el('td','version-cell',a.installed?.version||'—'),el('td','version-cell',a.type==='web'?'Online':versionLabel(a)||'Non indicata'),actions);return row;
}
function render(){
  if(!state)return;
  closeActions();
  renderLauncherUpdate();
  document.body.classList.toggle('mac',state.platform==='darwin');$('#platform').textContent=state.platform==='darwin'?'Per macOS':'Per Windows';
  for(const f of ['all','installed','updates','available']){const count=state.apps.filter(a=>inFilter(a,f)).length;$('#'+(f==='all'?'all':f==='available'?'available':f==='updates'?'update':'installed')+'-count').textContent=count;}
  document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});
  document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
  const q=$('#search').value.trim().toLocaleLowerCase('it');let apps=state.apps.filter(a=>inFilter(a,filter)&&`${a.name} ${a.description} ${a.category}`.toLocaleLowerCase('it').includes(q));const sort=$('#sort').value;if(sort==='name')apps.sort((a,b)=>a.name.localeCompare(b.name,'it'));if(sort==='status')apps.sort((a,b)=>Number(b.update===true)-Number(a.update===true)||Number(!!b.installed)-Number(!!a.installed));
  $('#view-title').textContent={all:'Le tue applicazioni',installed:'Applicazioni installate',updates:'Aggiornamenti disponibili',available:'Applicazioni da installare'}[filter];$('#result-count').textContent=`${apps.length} app`;
  $('#cards').replaceChildren(...apps.map(a=>renderCard(a,state.apps.indexOf(a))));$('#rows').replaceChildren(...apps.map(renderRow));$('#cards').hidden=mode!=='grid'||apps.length===0;$('#table-wrap').hidden=mode!=='table'||apps.length===0;$('#empty').hidden=apps.length!==0;$('#empty').textContent=q?'Nessuna app corrisponde alla ricerca.':filter==='updates'?'Le tue app sono aggiornate.':filter==='available'?'Nessuna app da installare per questo sistema.':'Nessuna app in questa sezione.';
  const updates=state.apps.filter(a=>a.update===true&&a.available&&a.osCompatible).length;$('#update-all').hidden=!updates;$('#update-all').textContent=`Aggiorna tutte (${updates})`;$('#update-all').disabled=busy||checking||!window.hub;$('#refresh').disabled=busy||checking||!window.hub;$('#refresh').classList.toggle('checking',checking);$('#checked').textContent=checking?'Controllo aggiornamenti…':lastCheck?'Controllato '+lastCheck.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})+' · GitHub':window.hub?'Controllo in attesa':'Anteprima';
}
async function refresh(){if(busy||checking||!window.hub)return;checking=true;render();try{state=await window.hub.catalog();lastCheck=new Date();}catch(e){notice(e.message);}finally{checking=false;render();}}
async function installApps(apps){
  if(busy||checking||!window.hub)return;busy=true;notice('');render();const errors=[],done=[];
  try{for(const a of apps){progress.set(a.id,{phase:'Preparazione',progress:0});render();try{state={...await window.hub.install(a.id),launcher:state.launcher};done.push(a.name);if(state.platform==='darwin')guideQueue.push(state.apps.find(x=>x.id===a.id)||a);}catch(e){errors.push(`${a.name}: ${e.message}`);state=await window.hub.catalog().catch(()=>state);}finally{progress.delete(a.id);render();}}lastCheck=new Date();notice([done.length?`${done.join(', ')} ${done.length===1?'è installata':'sono installate'}. Completa il primo avvio con la guida qui sotto.`:'',...errors].filter(Boolean).join('\n'));}finally{busy=false;render();if(guideQueue.length)showLaunchGuide(guideQueue.shift(),'installed');}
}
function closeActions(restoreFocus=false){
  if(!openActions)return;const {trigger,panel}=openActions;openActions=null;panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(restoreFocus&&trigger.isConnected)trigger.focus();
}
function toggleActions(trigger,panel){
  const closing=openActions?.panel===panel;closeActions();if(closing)return;
  panel.hidden=false;trigger.setAttribute('aria-expanded','true');openActions={trigger,panel};panel.querySelector('button:not(:disabled)')?.focus();
}
function showLaunchGuide(a,status='help',message=''){
  if(a.type==='web'||state?.platform!=='darwin')return;
  if(!guideApp)guideReturnFocus=document.activeElement;
  guideApp=a;guideStage=status==='authorization'?1:0;
  $('#launch-guide-title').textContent=status==='installed'?`${a.name} è installata. Completa il primo avvio.`:`Primo avvio di ${a.name}`;
  $('#launch-guide-first-step').textContent=`Apri ${a.name}. Se macOS mostra un avviso sullo sviluppatore non verificato, chiudilo e passa all’autorizzazione.`;
  $('#launch-guide-open').textContent=`Apri ${a.name}`;
  $('#launch-guide-help').open=false;
  $('#launch-guide').hidden=false;renderGuide(message);
  $('#launch-guide-title').focus({preventScroll:true});$('#launch-guide').scrollIntoView({block:'start',behavior:'instant'});
}
function renderGuide(message='',focusAction=false){
  const stages=['start','authorize','retry','done'];
  for(let i=0;i<stages.length;i++)$('#guide-stage-'+stages[i]).hidden=i!==guideStage;
  const controls=['open','settings','retry','done'];for(let i=0;i<controls.length;i++)$('#launch-guide-'+controls[i]).hidden=i!==guideStage;
  $('#launch-guide-progress').textContent=guideStage===3?'Primo avvio completato':`Passo ${guideStage+1} di 3`;
  const messages=['Inizia aprendo l’app. Ti guideremo solo se macOS richiede un’autorizzazione.','Consenti l’apertura nelle impostazioni del Mac. Il launcher non richiede la tua password.','L’autorizzazione si conferma nelle finestre di macOS. Quando hai finito, riprova da qui.','L’app è stata aperta.'];
  $('#launch-guide-message').textContent=message||messages[guideStage];
  $('#launch-guide-back').hidden=guideStage===0||guideStage===3;
  $('#launch-guide-skip').hidden=guideStage!==0;
  $('#launch-guide-permissions').hidden=guideApp?.id!=='ivolume'||guideStage!==3;
  $('#launch-guide-help').hidden=guideStage===3;
  if(focusAction)$('#launch-guide-'+controls[guideStage]).focus();
}
function closeLaunchGuide(){
  if(guideQueue.length){showLaunchGuide(guideQueue.shift(),'installed');return;}
  $('#launch-guide').hidden=true;guideApp=null;
  if(guideReturnFocus?.isConnected)guideReturnFocus.focus();else $('#search').focus();guideReturnFocus=null;
}
async function openGuideSettings(){
  try{await window.hub.privacySecurity();guideStage=2;renderGuide('',true);}
  catch{$('#launch-guide-message').textContent='Apri manualmente Impostazioni di Sistema → Privacy e sicurezza e scorri fino a Sicurezza.';}
}
async function openApp(a){
  if(openingApps.has(a.id))return;
  openingApps.add(a.id);
  if(guideApp?.id===a.id)for(const id of ['launch-guide-open','launch-guide-retry'])$('#'+id).disabled=true;
  try{
    const result=await window.hub.open(a.id);
    if(result?.status==='authorization'||result?.status==='cancelled'){notice('');showLaunchGuide(a,result.status,result.message);}
    else if(result?.status==='opened'){
      notice('');
      if(guideApp?.id===a.id){if(result.running===true){guideStage=3;renderGuide(`${a.name} è in esecuzione.`,true);}else{renderGuide(`Richiesta inviata a ${a.name}. Se vedi un avviso di macOS, passa all’autorizzazione. Se l’app è già aperta, puoi chiudere la guida.`);}}else notice(`Richiesta di apertura inviata a ${a.name}.`);
    }else if(result?.message){$('#launch-guide').hidden=true;guideApp=null;notice(result.message);}
  }catch{
    notice(a.type==='web'?`Non è stato possibile aprire ${a.name} nel browser. Riprova dal launcher.`:`Non è stato possibile aprire ${a.name}. Riprova dal launcher o dalla cartella Applicazioni.`);
  }finally{
    openingApps.delete(a.id);
    if(guideApp?.id===a.id)for(const id of ['launch-guide-open','launch-guide-retry']){const control=$('#'+id);if(control)control.disabled=false;}
  }
}
async function repository(id){try{if(id==='launcher')await window.hub.project();else await window.hub.repository(id);}catch(e){notice(e.message);}}
async function project(){try{if(window.hub?.project)await window.hub.project();}catch(e){notice(e.message);}}
function showDetails(a){
  selected=a;$('#detail-title').textContent=a.name;$('#detail-description').textContent=a.description;
  const meta=$('#detail-meta');meta.replaceChildren();
  const entries=a.type==='web'?[['Tipo','Applicazione web'],['Categoria',a.category||'Produttività'],['Sistema richiesto',compatibilityLabel(a)]]:[['Versione installata',a.installed?.version||'Non installata'],['Versione disponibile',versionLabel(a)||'Non indicata'],['Sistema richiesto',compatibilityLabel(a)]];
  if(a.architectures)entries.push(['Processori',a.architectures]);
  if(a.latest&&!versionLabel(a))entries.push(['Tag della release',a.latest]);
  if(a.error)entries.push(['Controllo aggiornamenti',a.error]);
  for(const [label,value] of entries)meta.append(el('dt','',label),el('dd','',value));
  const help=$('#detail-compatibility');help.hidden=a.type==='web'||!(a.requiresRosetta||(state.platform==='win32'&&a.id!=='launcher'));
  help.textContent=state.platform==='win32'&&a.id!=='launcher'?'Questa applicazione è disponibile solo per macOS.': 'Sui Mac Intel funziona direttamente. Sui Mac Apple Silicon (M1, M2 e successivi) Rosetta permette di eseguire questa versione Intel. macOS può proporti di installarla al primo avvio.';
  const isLauncher=a.id==='launcher';
  $('#detail-guide').hidden=isLauncher||a.type==='web'||!a.installed||state.platform!=='darwin';
  $('#detail-notes-heading').textContent=isLauncher?'Novità della versione':'Funzioni e utilizzi';
  $('#detail-notes-source').hidden=true;
  ReleaseMarkdown.render($('#detail-notes'),isLauncher?(a.notes?.trim()||'Non sono state pubblicate note per questa versione.'):(a.details||a.description),url=>window.hub?.external(url).catch(e=>notice(e.message)));
  $('#detail-notes').scrollTop=0;
  $('#detail-reinstall').hidden=!(a.installed&&a.update===null&&a.available&&a.osCompatible);$('#detail-reinstall').disabled=busy||checking;
  if(!$('#details').open)$('#details').showModal();
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
function handleShortcuts(e){
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='f'&&!$('#details').open&&!$('#settings').open){e.preventDefault();$('#search').focus();$('#search').select();return;}
  if(e.key==='Escape'){
    if(openActions){e.preventDefault();closeActions(true);}
    else if(guideApp&&!$('#details').open&&!$('#settings').open){e.preventDefault();closeLaunchGuide();}
  }
}
$('#launcher-update-button').addEventListener('click',updateLauncher);
$('#detail-guide').addEventListener('click',()=>{$('#details').close();showLaunchGuide(selected);});
$('#launch-guide-close').addEventListener('click',closeLaunchGuide);
$('#launch-guide-done').addEventListener('click',closeLaunchGuide);
$('#launch-guide-back').addEventListener('click',()=>{guideStage=Math.max(0,guideStage-1);renderGuide('',true);});
$('#launch-guide-skip').addEventListener('click',()=>{guideStage=1;renderGuide('',true);});
for(const id of ['launch-guide-open','launch-guide-retry'])$('#'+id).addEventListener('click',()=>{if(guideApp)openApp(guideApp);});
$('#launch-guide-settings').addEventListener('click',openGuideSettings);
$('#launch-guide-apple').addEventListener('click',()=>window.hub?.external('https://support.apple.com/it-it/102445').catch(()=>notice('Apri la guida Apple su support.apple.com/it-it/102445.')));
$('#launcher-update-cancel').addEventListener('click',()=>window.hub.cancelLauncherUpdate().catch(e=>notice(e.message)));
$('#launcher-check').addEventListener('click',refresh);
$('#launcher-update-notes').addEventListener('click',()=>{const l=state.launcher;showDetails({id:'launcher',name:'iDom Launcher',description:'Aggiornamento del launcher. Verrà scaricato, verificato e installato prima del riavvio.',installed:{version:l.current},latest:l.latest,minimum:'13.0',notes:l.notes||''});});
$('#theme').value=readSetting('theme','system');if(!['system','dark','light'].includes($('#theme').value))$('#theme').value='system';applyTheme();$('#auto-check').checked=readSetting('auto-check','true')==='true';
$('#theme').addEventListener('change',applyTheme);matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if($('#theme').value==='system')applyTheme();});$('#auto-check').addEventListener('change',()=>writeSetting('auto-check',String($('#auto-check').checked)));
$('#settings-open').addEventListener('click',()=>$('#settings').showModal());$('#settings-close').addEventListener('click',()=>$('#settings').close());$('#close-details').addEventListener('click',()=>$('#details').close());$('#detail-repo').addEventListener('click',()=>repository(selected.id));$('#detail-reinstall').addEventListener('click',()=>{$('#details').close();installApps([selected]);});
$('#footer-project').addEventListener('click',project);
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;render();}));document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;writeSetting('view',mode);render();}));if(!['grid','table'].includes(mode))mode='grid';$('#sort').addEventListener('change',render);$('#search').addEventListener('input',render);$('#refresh').addEventListener('click',()=>{notice('');refresh();});$('#update-all').addEventListener('click',()=>installApps(state.apps.filter(a=>a.update===true&&a.available&&a.osCompatible)));
document.addEventListener('click',e=>{if(openActions&&!openActions.panel.contains(e.target)&&!openActions.trigger.contains(e.target))closeActions();});
document.addEventListener('focusin',e=>{if(openActions&&!openActions.panel.contains(e.target)&&e.target!==openActions.trigger)closeActions();});
document.addEventListener('keydown',handleShortcuts);
const editable=target=>target instanceof Element&&!!target.closest('input,textarea,[contenteditable=true]');document.addEventListener('selectstart',e=>{if(!editable(e.target))e.preventDefault();});document.addEventListener('dragstart',e=>{if(!editable(e.target))e.preventDefault();});document.addEventListener('contextmenu',e=>{if(!editable(e.target))e.preventDefault();});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'&&!editable(e.target))e.preventDefault();});
if(window.hub?.info)window.hub.info().then(info=>{document.querySelector('footer .version').textContent='v'+info.version;$('#settings-version').textContent='iDom Launcher '+info.version+' · Domenico Lella';}).catch(()=>{});
if(window.hub?.onLauncherProgress)window.hub.onLauncherProgress(p=>{launcherProgress=p;renderLauncherUpdate();});
if(window.hub?.ready)window.hub.ready().catch(()=>{});
if(window.hub){window.hub.onProgress(p=>{progress.set(p.id,p);document.querySelectorAll(`[data-action-for="${p.id}"]`).forEach(area=>{const a=state?.apps.find(a=>a.id===p.id);if(a)area.replaceChildren(phaseDisplay(a));});});refresh();setInterval(()=>{if($('#auto-check').checked)refresh();},15*60*1000);}else{notice('Anteprima dell’interfaccia. Per installare e aprire le app usa il launcher desktop.');state={platform:'darwin',apps:[{id:'prompt-builder',name:'Prompt Builder',description:'Crea e personalizza i tuoi prompt direttamente nel browser.',category:'Produttività',icon:'prompt-builder.svg',type:'web',url:'https://prompt-builder-cyan.vercel.app',available:true,osCompatible:true,update:false},{id:'iblock',name:'iBlock',description:'Blocca temporaneamente la tastiera e il puntatore per pulire il Mac.',category:'Utility',icon:'iblock.png',minimum:'13.0',latest:'v2.3.3',available:false,osCompatible:true},{id:'ivolume',name:'iVolume',description:'Regola separatamente il volume delle applicazioni sul Mac.',category:'Audio',icon:'ivolume.png',minimum:'14.2',latest:'iVolume',available:false,osCompatible:true,architectureNote:'Intel; Rosetta su Apple Silicon.'}]};render();}
