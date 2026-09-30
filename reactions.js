// Anonymous emoji reactions. No background polling or WebSocket connection.
(()=>{
 const API='https://116.205.226.31:8049';
 const options=[["like","👍","赞"],["love","❤️","喜欢"],["clap","👏","鼓掌"],["laugh","😂","笑哭"],["wow","😮","惊讶"],["sweat-smile","😅","流汗黄豆"],["sweat","😓","汗颜"],["cry","😭","大哭"],["think","🤔","思考"],["fire","🔥","火了"],["eyes","👀","看看"],["skull","💀","绷不住了"],["smile","😀","开心"],["grin","😁","咧嘴笑"],["rolling-laugh","🤣","笑翻了"],["joy","😆","大笑"],["wink","😉","眨眼"],["cool","😎","酷"],["heart-eyes","😍","心动"],["party","🥳","庆祝"],["facepalm","🤦","捂脸"],["shrug","🤷","无奈"],["upside-down","🙃","倒脸"],["neutral","😐","无语"],["unamused","😒","不爽"],["eye-roll","🙄","白眼"],["pleading","🥺","委屈"],["sob","😢","难过"],["angry","😠","生气"],["scream","😱","震惊"],["sleep","😴","困了"],["robot","🤖","机器人"],["poop","💩","一坨"],["thumbs-down","👎","不赞"],["hundred","💯","满分"],["rocket","🚀","起飞"]];
 const baseOrder=['like','sweat-smile','poop','scream','rolling-laugh'];
 const priority=new Map(options.map(([key],index)=>[key,baseOrder.includes(key)?baseOrder.indexOf(key):baseOrder.length+index]));
 let visitor, persist=true;
 try{visitor=localStorage.getItem('pelican-reaction-visitor');if(!/^[a-f0-9-]{36}$/i.test(visitor||'')){visitor=crypto.randomUUID();localStorage.setItem('pelican-reaction-visitor',visitor)}}catch{persist=false;visitor=crypto.randomUUID()}
 const state=new Map(),pending=new Set();let loaded=false,loadError=false,loading;
 let openPicker=null;
 function positionPicker(picker,anchor){
  const r=anchor.getBoundingClientRect(),gap=8,pad=8;
  picker.style.maxHeight=Math.max(120,window.innerHeight-2*pad)+'px';
  const box=picker.getBoundingClientRect();
  const left=Math.max(pad,Math.min(r.left,window.innerWidth-box.width-pad));
  const below=r.bottom+gap,above=r.top-gap-box.height;
  const top=below+box.height<=window.innerHeight-pad?below:above>=pad?above:Math.max(pad,Math.min(below,window.innerHeight-box.height-pad));
  picker.style.left=left+'px';picker.style.top=top+'px';
 }
 function reposition(){if(openPicker&&openPicker.picker.isConnected&&openPicker.picker.matches(':popover-open'))positionPicker(openPicker.picker,openPicker.anchor);else openPicker=null}
 window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);
 async function request(path,init){
  const response=await fetch(API+path,{...init,signal:AbortSignal.timeout(12000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'表情服务暂时不可用');return data;
 }
 async function load(){
  if(loading)return loading;
  loading=(async()=>{try{const data=await request('/reactions?visitorId='+encodeURIComponent(visitor));for(const [id,value] of Object.entries(data.works))state.set(id,value);loaded=true;loadError=false}catch{loadError=true}finally{loading=null;refresh()}})();return loading;
 }
 function statusMessage(row,text){row.querySelector('.reaction-status').textContent=text}
 function refresh(){
  document.querySelectorAll('.reactions').forEach(row=>{
   const id=row.dataset.workId,value=state.get(id),busy=pending.has(id);
   const ranked=[...options].sort((a,b)=>(value?.counts[b[0]]||0)-(value?.counts[a[0]]||0)||priority.get(a[0])-priority.get(b[0]));
   const top=new Set(ranked.slice(0,5).map(option=>option[0]));
   const add=row.querySelector('.reaction-add'),picker=row.querySelector('.reaction-picker');
   row.querySelectorAll('[data-reaction]').forEach(button=>{
    const key=button.dataset.reaction,total=value?.counts[key]||0,chosen=value?.selected.includes(key)||false;
    button.disabled=!loaded||busy;button.setAttribute('aria-pressed',String(chosen));
    button.querySelector('.reaction-count').textContent=loaded?String(total):'–';
    button.hidden=!top.has(key);
   });
   ranked.forEach(([key])=>{
    row.insertBefore(row.querySelector('[data-reaction="'+key+'"]'),add);
    const choice=picker.querySelector('[data-picker-reaction="'+key+'"]');
    choice.disabled=!loaded||busy;choice.setAttribute('aria-pressed',String(value?.selected.includes(key)||false));
    choice.querySelector('.reaction-count').textContent=loaded?String(value?.counts[key]||0):'–';
    picker.querySelector('.reaction-picker-grid').append(choice);
   });
   const status=row.querySelector('.reaction-status');
   if(!row.dataset.error)status.textContent=loadError?'表情加载失败，点＋重试':!loaded?'加载表情…':!persist?'浏览器不允许保存身份，关闭后会忘记已选表情':'';
  });
 }
 async function setReaction(row,key){
  const id=row.dataset.workId;if(pending.has(id)||!loaded)return;
  const active=!(state.get(id)?.selected.includes(key));pending.add(id);delete row.dataset.error;refresh();
  try{const data=await request('/reactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitorId:visitor,workId:id,reaction:key,active})});state.set(id,data);const picker=row.querySelector('.reaction-picker');if(picker.matches(':popover-open'))picker.hidePopover()}
  catch(error){row.dataset.error='true';statusMessage(row,error.message==='Failed to fetch'?'网络连接失败，请重试':error.message)}
  finally{pending.delete(id);refresh()}
 }
 function mount(){
  document.querySelectorAll('.card[data-work-id]').forEach(card=>{
   if(card.querySelector('.reactions'))return;
   const row=document.createElement('div');row.className='reactions';row.dataset.workId=card.dataset.workId;row.setAttribute('role','group');row.setAttribute('aria-label','作品表情反应');
   function button(option,isPicker=false){const [key,emoji,label]=option,b=document.createElement('button');b.type='button';b.className='reaction-button';if(isPicker)b.dataset.pickerReaction=key;else b.dataset.reaction=key;b.title=label;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed','false');const icon=document.createElement('span');icon.textContent=emoji;icon.setAttribute('aria-hidden','true');const count=document.createElement('span');count.className='reaction-count';count.textContent='–';b.append(icon,count);b.onclick=()=>setReaction(row,key);return b}
   options.forEach(option=>row.append(button(option)));
   const add=document.createElement('button');add.type='button';add.className='reaction-add';add.textContent='☺＋';add.title='添加表情';add.setAttribute('aria-label','添加表情');add.setAttribute('aria-expanded','false');row.append(add);
   const picker=document.createElement('div');picker.className='reaction-picker';picker.setAttribute('popover','auto');picker.setAttribute('role','dialog');picker.setAttribute('aria-label','选择表情');add.setAttribute('aria-haspopup','dialog');
   const header=document.createElement('div');header.className='reaction-picker-header';const title=document.createElement('strong');title.textContent='添加表情';
   const close=document.createElement('button');close.type='button';close.className='reaction-add';close.textContent='×';close.setAttribute('aria-label','关闭表情选择');close.onclick=()=>picker.hidePopover();header.append(title,close);
   const choices=document.createElement('div');choices.className='reaction-picker-grid';options.forEach(option=>choices.append(button(option,true)));picker.append(header,choices);
   picker.addEventListener('toggle',event=>{add.setAttribute('aria-expanded',String(event.newState==='open'));if(event.newState==='closed'&&openPicker?.picker===picker)openPicker=null});
   add.onclick=()=>{if(!loaded){load();return}if(picker.matches(':popover-open')){picker.hidePopover();return}picker.showPopover();openPicker={picker,anchor:add};positionPicker(picker,add);add.setAttribute('aria-expanded','true')};
   const status=document.createElement('span');status.className='reaction-status';status.setAttribute('role','status');row.append(picker,status);card.append(row);
  });refresh();
 }
 window.addEventListener('pelican-gallery-rendered',mount);mount();load();
})();
