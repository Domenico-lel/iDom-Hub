// Render release notes as DOM nodes. Remote HTML is always displayed as text.
(function(root){
 function safeURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
 function inline(text,document,openLink){
  const fragment=document.createDocumentFragment();const pattern=/\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|`([^`\n]+)`|\*([^*\n]+)\*/g;let last=0;
  for(const m of text.matchAll(pattern)){fragment.append(document.createTextNode(text.slice(last,m.index)));let node;
   if(m[1]){const url=safeURL(m[2]);if(url){node=document.createElement('a');node.href=url;node.textContent=m[1];node.addEventListener('click',e=>{e.preventDefault();openLink(url);});}else node=document.createTextNode(m[1]);}
   else {node=document.createElement(m[3]?'strong':m[4]?'code':'em');node.textContent=m[3]||m[4]||m[5];}fragment.append(node);last=m.index+m[0].length;
  }fragment.append(document.createTextNode(text.slice(last)));return fragment;
 }
 function render(container,markdown,openLink=()=>{}){
  const document=container.ownerDocument;container.replaceChildren();const lines=String(markdown||'').replace(/\r\n?/g,'\n').split('\n');let paragraph=[],list=null,fence=false,code=[];
  function add(tag,text){const node=document.createElement(tag);node.append(inline(text,document,openLink));container.append(node);return node;}
  function flush(){if(paragraph.length){add('p',paragraph.join(' '));paragraph=[];}list=null;}
  for(const line of lines){
   if(/^\s*```/.test(line)){flush();if(fence){const pre=document.createElement('pre');const node=document.createElement('code');node.textContent=code.join('\n');pre.append(node);container.append(pre);code=[];}fence=!fence;continue;}
   if(fence){code.push(line);continue;}if(!line.trim()){flush();continue;}
   const heading=line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);if(heading){flush();add('h'+Math.min(heading[1].length+1,6),heading[2]);continue;}
   const item=line.match(/^\s*(?:([-*+])|\d+[.)])\s+(.+)$/);if(item){if(paragraph.length)flush();const tag=item[1]?'ul':'ol';if(!list||list.tagName.toLowerCase()!==tag){list=document.createElement(tag);container.append(list);}const li=document.createElement('li');li.append(inline(item[2],document,openLink));list.append(li);continue;}
   if(/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)){flush();container.append(document.createElement('hr'));continue;}
   if(list){const li=list.lastElementChild;li.append(document.createTextNode(' '),inline(line.trim(),document,openLink));}else paragraph.push(line.trim());
  }flush();if(code.length){const pre=document.createElement('pre');pre.textContent=code.join('\n');container.append(pre);}
 }
 root.ReleaseMarkdown={render,safeURL};
})(globalThis);
