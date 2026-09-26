// Magnetic, Tilt and Animated Background adapted from Motion Primitives by Julien Thibeaut.
// Original MIT sources and 21st.dev discovery references: COMPONENTS.md.
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
let paused=reduced.matches;
const motion=()=>!paused&&!reduced.matches;
const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('#navigation');
function closeMenu(){menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Menü öffnen');nav.classList.remove('open');}
menu.onclick=()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Menü schließen':'Menü öffnen');nav.classList.toggle('open',open);};
nav.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});matchMedia('(min-width:761px)').addEventListener('change',closeMenu);
// Native spring integrator for the source components' spring motion values.
const effects=[];
function springEffect(el,type){let x=0,y=0,vx=0,vy=0,tx=0,ty=0,last=0,raf=0;const max=type==='tilt'?4:.22;
 function draw(now){raf=0;const dt=last?Math.min((now-last)/1000,.025):.016;last=now;
  vx+=(160*(tx-x)-24*vx)*dt;vy+=(160*(ty-y)-24*vy)*dt;x+=vx*dt;y+=vy*dt;
  el.style.transform=type==='tilt'?`perspective(1000px) rotateX(${y}deg) rotateY(${-x}deg)`:`translate3d(${x}px,${y}px,0)`;
  if(Math.abs(tx-x)+Math.abs(ty-y)+Math.abs(vx)+Math.abs(vy)>.02)raf=requestAnimationFrame(draw);else last=0;
 }
 function wake(){if(!raf)raf=requestAnimationFrame(draw);}
 el.addEventListener('pointermove',e=>{if(!fine.matches||!motion()||e.pointerType==='touch')return;const r=el.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;
  if(type==='tilt'){tx=dx/r.width*max;ty=dy/r.height*max;}else{const distance=Math.hypot(dx,dy),scale=Math.max(0,1-distance/160);tx=dx*max*scale;ty=dy*max*scale;}wake();});
 function reset(){tx=ty=0;if(!motion()){cancelAnimationFrame(raf);raf=0;x=y=vx=vy=0;el.style.transform='none';last=0;}else wake();}
 el.addEventListener('pointerleave',reset);el.addEventListener('blur',reset);effects.push(reset);
}
document.querySelectorAll('.magnetic').forEach(el=>springEffect(el,'magnetic'));document.querySelectorAll('[data-tilt]').forEach(el=>springEffect(el,'tilt'));
document.addEventListener('motion-state',e=>{paused=e.detail.paused;effects.forEach(reset=>reset());});
document.querySelectorAll('details').forEach(d=>{let pointer=false;d.querySelector('summary').addEventListener('click',e=>pointer=e.detail!==0);d.addEventListener('toggle',()=>{if(d.open&&pointer&&motion()){const c=d.querySelector('.detail-content');c.getAnimations().forEach(a=>a.cancel());c.animate([{opacity:.3,transform:'translateY(-5px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'cubic-bezier(.23,1,.32,1)'});}pointer=false;});});

const themeButton=document.querySelector('#hero-theme-toggle');
if(themeButton)themeButton.onclick=()=>{const dark=document.documentElement.dataset.heroTheme!=='dark';document.documentElement.dataset.heroTheme=dark?'dark':'light';themeButton.setAttribute('aria-pressed',String(dark));themeButton.setAttribute('aria-label',dark?'Helle Hero-Ansicht aktivieren':'Dunkle Hero-Ansicht aktivieren');themeButton.querySelector('span').textContent=dark?'Helle Ansicht':'Dunkle Ansicht';document.querySelector('meta[name="theme-color"]').content=dark?'#102f28':'#f3f4ec';document.dispatchEvent(new CustomEvent('hero-theme',{detail:{dark}}));};
