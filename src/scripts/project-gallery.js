/** Continuous, interruptible project gallery. Dummy media is explicitly labelled in HTML. */
import {inertia} from 'motion';
const gallery=document.querySelector('.gallery');
const originals=[...gallery.querySelectorAll('.project')];
const filters=[...document.querySelectorAll('[data-filter]')];
const highlight=document.querySelector('.filter-highlight');
const prev=document.querySelector('#gallery-prev'),next=document.querySelector('#gallery-next'),play=document.querySelector('#gallery-play');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
let paused=document.documentElement.classList.contains('motion-paused'),stopped=false,visible=false,hover=false,focused=false;
let period=0,position=0,lastApplied=0,raf=0,last=0,holdUntil=0,activeFilter=filters[0],drag=null,suppressClick=false;
const previews=new Map();
const motion=()=>!paused&&!reduced.matches;
const canRun=()=>motion()&&!stopped&&visible&&!document.hidden&&!hover&&!focused&&!drag&&period>0;

function indicator(instant=false){const b=activeFilter.getBoundingClientRect(),r=activeFilter.parentElement.getBoundingClientRect();highlight.style.transition=instant||!motion()?'none':'';highlight.style.height=b.height+'px';highlight.style.transform=`translateX(${b.left-r.left}px) scaleX(${b.width})`;}
function controls(){const max=gallery.scrollWidth-gallery.clientWidth;prev.disabled=period?false:gallery.scrollLeft<4;next.disabled=period?false:gallery.scrollLeft>=max-4;}
function syncPlay(){const unavailable=!motion();play.disabled=unavailable;play.setAttribute('aria-pressed',String(stopped||unavailable));play.setAttribute('aria-label',unavailable?'Galeriebewegung ist global pausiert':stopped?'Automatischen Galeriedurchlauf starten':'Automatischen Galeriedurchlauf pausieren');play.querySelector('span').textContent=unavailable?'Pausiert':stopped?'Start':'Pause';play.querySelector('path').setAttribute('d',stopped||unavailable?'M9 5l10 7-10 7Z':'M9 6v12M15 6v12');}
function stopFrame(){cancelAnimationFrame(raf);raf=0;last=0;}
function wake(){if(canRun()){if(!raf)raf=requestAnimationFrame(frame);}else stopFrame();}
function frame(now){raf=0;if(!canRun()){last=0;return;}const dt=last?Math.min((now-last)/1000,.05):0;last=now;
 if(now>=holdUntil){if(Math.abs(gallery.scrollLeft-lastApplied)>2)position=gallery.scrollLeft;position+=22*dt;if(position>=period)position-=period;gallery.scrollLeft=position;lastApplied=gallery.scrollLeft;}
 raf=requestAnimationFrame(frame);
}
function hold(ms=1800){holdUntil=performance.now()+ms;position=gallery.scrollLeft;lastApplied=position;last=0;wake();}
function preload(card){return Promise.all([...card.querySelectorAll('.preview-frame')].map(img=>{if(!img.src)img.src=img.dataset.src;return img.decode().catch(()=>null);}));}
function leavePreview(card){const state=previews.get(card);if(!state)return;clearTimeout(state.timer);previews.delete(card);card.classList.remove('is-preview');card.querySelectorAll('.preview-frame').forEach(i=>i.classList.remove('is-current'));}
function closePreviews(except=null){for(const card of [...previews.keys()])if(card!==except)leavePreview(card);}
function cycle(card){const state=previews.get(card);if(!state)return;const frames=[...card.querySelectorAll('.preview-frame')];frames.forEach((img,i)=>img.classList.toggle('is-current',i===state.index));card.querySelector('.preview-count').textContent=String(state.index+1).padStart(2,'0')+' / '+String(frames.length).padStart(2,'0');clearTimeout(state.timer);if(motion()&&!stopped&&!document.hidden)state.timer=setTimeout(()=>{state.index=(state.index+1)%frames.length;cycle(card);},2100);}
async function enterPreview(card){if(previews.has(card))return;closePreviews(card);const state={index:0,timer:0};previews.set(card,state);await preload(card);if(previews.get(card)!==state)return;card.classList.add('is-preview');cycle(card);}
function wire(card){card.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'&&fine.matches)enterPreview(card);});card.addEventListener('pointerleave',()=>{if(!card.contains(document.activeElement))leavePreview(card);});card.addEventListener('focusin',()=>enterPreview(card));card.addEventListener('focusout',e=>{if(!card.contains(e.relatedTarget))leavePreview(card);});card.querySelector('a').addEventListener('click',e=>{if(!fine.matches&&e.detail>0&&!card.classList.contains('is-preview')){e.preventDefault();enterPreview(card);}});}
originals.forEach(wire);
function buildLoop(){stopFrame();closePreviews();gallery.querySelectorAll('[data-loop-copy]').forEach(el=>el.remove());period=0;
 const cards=originals.filter(p=>!p.hidden);
 if(cards.length>1&&gallery.scrollWidth>gallery.clientWidth+2){const copies=cards.map(card=>{const copy=card.cloneNode(true);copy.dataset.loopCopy='true';copy.setAttribute('aria-hidden','true');copy.querySelectorAll('a,button,[tabindex]').forEach(el=>el.tabIndex=-1);wire(copy);gallery.append(copy);return copy;});period=copies[0].offsetLeft-cards[0].offsetLeft;}
 gallery.scrollLeft=position=lastApplied=0;indicator(true);controls();wake();
}
filters.forEach(button=>button.addEventListener('click',e=>{activeFilter=button;filters.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));originals.forEach(card=>card.hidden=button.dataset.filter!=='Alle'&&!card.dataset.discipline.split('|').includes(button.dataset.filter));const count=originals.filter(p=>!p.hidden).length;document.querySelector('#filter-status').textContent=count===1?'1 Arbeit angezeigt':`${count} Arbeiten angezeigt`;buildLoop();indicator(e.detail===0);hold(1200);}));
function step(direction,event){closePreviews();const card=originals.find(p=>!p.hidden);if(!card)return;const distance=card.getBoundingClientRect().width+(parseFloat(getComputedStyle(gallery).gap)||0);let left=gallery.scrollLeft+direction*distance;
 if(period&&left<0)left=period+left;else if(period&&left>=period)left-=period;
 holdUntil=performance.now()+2500;gallery.scrollTo({left,behavior:motion()&&event.detail&&Math.abs(left-gallery.scrollLeft)<distance*1.5?'smooth':'instant'});last=0;}
prev.addEventListener('click',e=>step(-1,e));next.addEventListener('click',e=>step(1,e));
play.addEventListener('click',()=>{stopped=!stopped;syncPlay();for(const card of previews.keys())cycle(card);wake();});
gallery.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'){hover=true;wake();}});
gallery.addEventListener('pointerleave',()=>{hover=false;hold(500);wake();});
gallery.addEventListener('focusin',()=>{focused=true;wake();});
gallery.addEventListener('focusout',e=>{focused=gallery.contains(e.relatedTarget);if(!focused){hold(1000);wake();}});
gallery.addEventListener('wheel',()=>hold(2400),{passive:true});
gallery.addEventListener('touchstart',()=>{focused=true;wake();},{passive:true});
gallery.addEventListener('touchend',()=>{focused=false;hold(4500);wake();},{passive:true});
gallery.addEventListener('keydown',e=>{if(e.target===gallery&&['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();step(e.key==='ArrowRight'?1:-1,e);}});
gallery.addEventListener('scroll',()=>{if(period&&gallery.scrollLeft>=period){gallery.scrollLeft-=period;position=lastApplied=gallery.scrollLeft;}controls();},{passive:true});
gallery.addEventListener('pointerdown',e=>{stopGlide();if(!fine.matches||e.button!==0)return;drag={x:e.clientX,y:e.clientY,left:gallery.scrollLeft,id:e.pointerId,moved:false,samples:[]};wake();});
gallery.addEventListener('wheel',stopGlide,{passive:true});
gallery.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){drag.moved=true;gallery.setPointerCapture(e.pointerId);gallery.classList.add('dragging');closePreviews();}if(drag.moved){e.preventDefault();gallery.scrollLeft=drag.left-dx;drag.samples.push({t:e.timeStamp,x:e.clientX});if(drag.samples.length>6)drag.samples.shift();}});
// Momentum on release (Motion inertia): the strip keeps the flick's velocity and settles
// like native touch scrolling, wrapping through the loop copies. Any new input stops it.
let glide=0;
function stopGlide(){if(glide){cancelAnimationFrame(glide);glide=0;}}
function releaseVelocity(samples){const recent=samples.filter(s=>samples[samples.length-1].t-s.t<=90);if(recent.length<2)return 0;const a=recent[0],b=recent[recent.length-1],dt=(b.t-a.t)/1000;return dt>0?(b.x-a.x)/dt:0;}
function startGlide(pointerVelocity){
 const velocity=Math.max(-4000,Math.min(4000,-pointerVelocity));
 if(Math.abs(velocity)<150||!motion())return 0;
 const gen=inertia({keyframes:[gallery.scrollLeft],velocity,power:.35,timeConstant:325,restDelta:.5,restSpeed:8});
 const t0=performance.now();
 const frame=now=>{const {value,done}=gen.next(now-t0);let v=value;if(period)v=((v%period)+period)%period;else v=Math.max(0,Math.min(gallery.scrollWidth-gallery.clientWidth,v));gallery.scrollLeft=v;position=lastApplied=gallery.scrollLeft;glide=done?0:requestAnimationFrame(frame);};
 glide=requestAnimationFrame(frame);
 return 2600; // inertia with timeConstant 325 settles in < 2.6 s — hold the autoplay until then
}
function endDrag(){if(!drag)return;suppressClick=drag.moved;setTimeout(()=>suppressClick=false,0);gallery.classList.remove('dragging');const id=drag.id,moved=drag.moved,samples=drag.samples;drag=null;if(gallery.hasPointerCapture(id))gallery.releasePointerCapture(id);const glideMs=moved?startGlide(releaseVelocity(samples)):0;hold(1800+glideMs);wake();}
gallery.addEventListener('pointerup',endDrag);gallery.addEventListener('pointercancel',endDrag);gallery.addEventListener('lostpointercapture',endDrag);
window.addEventListener('pointerup',endDrag);
gallery.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation();suppressClick=false;}},true);
gallery.addEventListener('dragstart',e=>e.preventDefault());
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)originals.forEach(preload);else closePreviews();wake();},{threshold:.05}).observe(gallery);
let measuredWidth=0;new ResizeObserver(()=>{const width=gallery.clientWidth;if(width!==measuredWidth){measuredWidth=width;buildLoop();}}).observe(gallery);
document.fonts.ready.then(buildLoop);
document.addEventListener('visibilitychange',()=>{if(document.hidden)closePreviews();wake();});
document.addEventListener('motion-state',e=>{paused=e.detail.paused;syncPlay();for(const card of previews.keys())cycle(card);wake();});
reduced.addEventListener('change',()=>{syncPlay();for(const card of previews.keys())cycle(card);wake();});
syncPlay();buildLoop();

const mediaNote=document.querySelector('#gallery-note');function note(){mediaNote.textContent=fine.matches?'Bildvorschauen mit Dummymotiven · Originale folgen.':'Antippen: Vorschau · Erneut tippen: Projekt · Dummymotive';}note();fine.addEventListener('change',note);

// Yield to page scrolling. Native scrollIntoView and horizontal autoplay must not compete.
window.addEventListener('scroll',()=>{holdUntil=performance.now()+600;last=0;},{passive:true});
