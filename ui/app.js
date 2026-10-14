let state=null,view='all',busy=false,selected=null;
const $=s=>document.querySelector(s);
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function notice(text){$('#notice').hidden=!text;$('#notice').textContent=text||'';}
function render(){
  if(!state)return;$('#platform').textContent=state.platform==='darwin'?'macOS · '+(navigator.userAgent.includes('ARM')?'Apple Silicon':'Desktop'):'Windows';
  $('#installed-count').textContent=state.apps.filter(a=>a.installed).length;$('#update-count').textContent=state.apps.filter(a=>a.update===true).length;
  $('#view-title').textContent={all:'Esplora le app',installed:'Le tue app installate',updates:'Aggiornamenti disponibili'}[view];
  $('#view-subtitle').textContent={all:'Due strumenti, una quotidianità più semplice.',installed:'Pronte quando ti servono.',updates:'L’ultima versione, con un clic.'}[view];
  const filtered=state.apps.filter(a=>view==='all'||view==='installed'&&a.installed||view==='updates'&&a.update===true);$('#cards').replaceChildren();$('#empty').hidden=filtered.length>0;
  for(const a of filtered){
    const card=el('article','card');card.dataset.id=a.id;const top=el('div','card-top');const icon=el('img','app-icon');icon.src='assets/'+a.icon;icon.alt='';top.append(icon,el('span','category',a.category.toUpperCase()));card.append(top,el('h3','',a.name),el('p','description',a.description));
    const meta=el('div','meta');meta.append(el('span','',`macOS ${a.minimum}+`),el('span',a.installed?'installed-badge':'',a.installed?`Installata · ${a.installed.version}`:a.latest?`Release ${a.latest}`:'Release non disponibile'));card.append(meta);
    if(a.error)card.append(el('p','card-error',a.error));
    if(a.architectureNote)card.append(el('p','description',a.architectureNote));
    if(state.platform==='win32')card.append(el('p','card-error','Disponibile per macOS. La versione Windows non è ancora stata pubblicata.'));
    else if(!a.osCompatible)card.append(el('p','card-error',`Questa app richiede macOS ${a.minimum} o successivo.`));
    else if(a.installed&&a.update===null)card.append(el('p','card-error','Tag senza versione: puoi reinstallare l’ultima release per collegarla al launcher.'));
    const bottom=el('div','card-bottom');const details=el('button','info','Dettagli ↗');details.addEventListener('click',()=>showDetails(a));bottom.append(details);
    const action=el('button','primary',a.installed?(a.update===true?'Aggiorna ↻':'Apri ↗'):'Installa ↓');action.disabled=busy||!a.osCompatible||(!a.installed&&!a.available);action.addEventListener('click',()=>a.installed&&a.update!==true?open(a):install(a));bottom.append(action);card.append(bottom);
    if(a.installed&&a.update===null&&a.available&&a.osCompatible){const reinstall=el('button','info','Reinstalla l’ultima release');reinstall.disabled=busy;reinstall.addEventListener('click',()=>install(a));card.append(reinstall);}
    $('#cards').append(card);
  }$('#refresh').disabled=busy;
}
async function refresh(){if(busy)return;$('#refresh').disabled=true;try{state=await window.hub.catalog();render();$('#checked').textContent='Ultimo controllo · '+new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});}catch(e){notice(e.message);}finally{$('#refresh').disabled=false;}}
async function install(a){busy=true;notice('');render();try{state=await window.hub.install(a.id);notice(`${a.name} è pronta. Al primo avvio macOS potrebbe chiederti di autorizzarla in Privacy e sicurezza.`);}catch(e){notice(e.message);state=await window.hub.catalog().catch(()=>state);}finally{busy=false;render();}}
async function open(a){try{await window.hub.open(a.id);}catch(e){notice(e.message);}}
function showDetails(a){selected=a;$('#detail-title').textContent=a.name;$('#detail-version').textContent=`Ultima release: ${a.latest||'non disponibile'} · macOS ${a.minimum}+`;$('#detail-notes').textContent=a.notes.trim()||'Questa release non contiene note di aggiornamento.';$('#details').showModal();}
$('#close-details').addEventListener('click',()=>$('#details').close());$('#detail-repo').addEventListener('click',()=>window.hub.repository(selected.id).catch(e=>notice(e.message)));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.view;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===button));render();}));
$('#refresh').addEventListener('click',()=>{notice('');refresh();});
if(window.hub){window.hub.onProgress(({id,phase,progress})=>{const card=document.querySelector(`[data-id="${id}"]`);if(card){let p=card.querySelector('.progress');if(!p){p=el('p','progress');card.append(p);}p.textContent=`${phase}${phase==='Download'?` · ${progress}%`:''}`;}});refresh();setInterval(()=>refresh(),15*60*1000);}else{notice('Anteprima dell’interfaccia. Installa e apri funzionano nell’app desktop.');state={platform:'darwin',apps:[{id:'iblock',name:'iBlock',description:'Una pausa per la tua tastiera. Blocca i tasti e pulisci il Mac in tranquillità.',category:'Utility',icon:'iblock.png',minimum:'13.0',latest:'v2.3.3',available:false,osCompatible:true},{id:'ivolume',name:'iVolume',description:'Il suono, come vuoi tu. Regola separatamente il volume delle applicazioni sul Mac.',category:'Audio',icon:'ivolume.png',minimum:'14.2',latest:'iVolume',available:false,osCompatible:true}]};$('#refresh').disabled=true;render();$('#refresh').disabled=true;$('#checked').textContent='Anteprima';}
