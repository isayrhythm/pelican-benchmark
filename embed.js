// 展示适配层：不改 SVG 图形、动画、原按钮或其事件处理。
(()=>{
 if(new URLSearchParams(location.search).get('embed')!=='1')return;
 function fit(){
  const candidates=[...document.querySelectorAll('svg[viewBox]')];
  const art=candidates.sort((a,b)=>{
   const area=s=>{const v=s.viewBox.baseVal;return v.width*v.height};
   return area(b)-area(a);
  })[0];
  if(!art)return;
  const stage=art.closest('#canvasWrapper, #animationContainer, div.scene, .card')||art;
  const controls=document.querySelector('footer:has(button), .footer:has(button), .controls:has(button)');
  const viewport=document.createElement('div');viewport.className='bb-viewport';
  const canvas=document.createElement('div');canvas.className='bb-canvas';
  viewport.append(canvas);canvas.append(stage);
  stage.classList.add('bb-stage');art.classList.add('bb-art');
  art.setAttribute('preserveAspectRatio','xMidYMid meet');
  if(controls){controls.classList.add('bb-controls');viewport.append(controls)}
  document.body.append(viewport);document.documentElement.classList.add('bb-embed');
  const style=document.createElement('style');
  style.textContent=`
   html.bb-embed,html.bb-embed body{width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}
   .bb-embed body{display:block!important}
   .bb-embed body>:not(.bb-viewport):not(script):not(style){display:none!important}
   .bb-viewport{position:absolute!important;inset:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
   .bb-canvas{width:100%!important;flex:1!important;min-height:0!important;overflow:hidden!important;display:flex!important;align-items:stretch!important}
   .bb-stage{width:100%!important;height:100%!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;aspect-ratio:auto!important;overflow:hidden!important}
   svg.bb-art{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;flex:1!important}
   .bb-stage .hint{display:none!important}
   .bb-controls{display:flex!important;flex:0 0 auto!important;flex-wrap:wrap!important;align-items:center!important;justify-content:center!important;gap:4px!important;min-width:0!important;max-width:none!important;width:100%!important;margin:0!important;padding:5px 6px!important;border:0!important;border-radius:0!important;box-shadow:none!important;font-size:10px!important;line-height:1.3!important;box-sizing:border-box!important}
   .bb-controls .caption,.bb-controls>div:last-child:has(#cadenceBadge){display:none!important}
   .bb-controls .controls,.bb-controls .button-group,.bb-controls>div{display:flex;align-items:center;gap:4px!important;min-width:0!important}
   .bb-controls .slider-group,.bb-controls>div:has(>input[type=range]){flex:1 1 100%!important;max-width:none!important;min-width:0!important;gap:5px!important}
   .bb-controls button{padding:4px 6px!important;font-size:10px!important;line-height:1.3!important;min-width:0!important;white-space:nowrap!important;border-radius:5px!important}
   .bb-controls label,.bb-controls span{font-size:10px!important;white-space:nowrap!important}
   .bb-controls input[type=range]{width:60px!important;min-width:20px!important;flex:1!important}
   .bb-controls button svg{width:12px!important;height:12px!important;flex:none!important}
  `;
  document.head.append(style);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fit,{once:true});else fit();
})();
