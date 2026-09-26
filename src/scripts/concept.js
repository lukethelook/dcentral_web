/** Narrative pacing and interaction for the independent Von hier. Weiter. concept. */
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const fine=matchMedia('(hover:hover) and (pointer:fine)');
let paused=reduce.matches || document.documentElement.classList.contains('motion-paused');
const canMove=()=>!paused&&!reduce.matches;

// The service stage is a real tab interface; all source copy remains in the document.
const tabs=[...document.querySelectorAll('[role=tab][data-discipline]')];
const compact=matchMedia('(max-width:760px)');
const orientTabs=()=>document.querySelector('.discipline-tabs').setAttribute('aria-orientation',compact.matches?'horizontal':'vertical');orientTabs();compact.addEventListener('change',orientTabs);
const panels=tabs.map(t=>document.getElementById(t.getAttribute('aria-controls')));
function choose(index,animate=false){
 tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;});
 if(animate&&canMove())panels[index].animate([{opacity:.55,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,easing:'cubic-bezier(.23,1,.32,1)'});
}
tabs.forEach((tab,index)=>{
 tab.addEventListener('click',e=>choose(index,e.detail!==0));
 tab.addEventListener('keydown',e=>{let i=index;if(['ArrowDown','ArrowRight'].includes(e.key))i=(index+1)%tabs.length;else if(['ArrowUp','ArrowLeft'].includes(e.key))i=(index-1+tabs.length)%tabs.length;else if(e.key==='Home')i=0;else if(e.key==='End')i=tabs.length-1;else return;e.preventDefault();choose(i);tabs[i].focus();});
});
function hashTab(){const i=panels.findIndex(p=>'#'+p.id===location.hash);if(i>=0)choose(i);}
choose(0);hashTab();addEventListener('hashchange',hashTab);

// Reading progress follow normal document scrolling.
const progress=document.querySelector('.reading-progress');
const reading=document.querySelector('[data-reading]');
const text=reading.textContent.replace(/\s+/g,' ').trim();reading.replaceChildren();
text.split(' ').forEach((word,i)=>{if(i)reading.append(' ');const span=document.createElement('span');span.className='reading-word';span.textContent=word;reading.append(span);});
const words=[...reading.querySelectorAll('.reading-word')];let pending=0;
function updateScroll(){pending=0;const range=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${range>0?scrollY/range:0})`;
 const box=reading.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(innerHeight*.83-box.top)/(innerHeight*.6)));
 words.forEach((w,i)=>w.classList.toggle('read',!canMove()||i/words.length<fraction));
}
function queueScroll(){if(!pending)pending=requestAnimationFrame(updateScroll);}
addEventListener('scroll',queueScroll,{passive:true});addEventListener('resize',queueScroll);updateScroll();

// Hero text is present immediately; only the terrain has a first-visit entrance.
// Section reveals below the hero live in motion-system.js (Motion inView + stagger).
document.addEventListener('motion-state',e=>{paused=e.detail.paused;if(paused)document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).forEach(a=>a.finish());queueScroll();});
