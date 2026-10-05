/* Film section (Films.astro)
   Desktop: hovering or focusing a panel opens it and plays its muted loop; a label
   follows the pointer. Phones: swipeable row, the centred card plays.
   Click → the player grows out of the panel (clip-path) with minimal controls;
   Vimeo/YouTube load only on click (privacy). Loops pause offscreen and respect
   reduced motion and the global motion pause. */
import { animate } from 'motion';

const stage = document.querySelector('[data-films]');
const modal = document.querySelector('.film-modal');

if (stage && modal) {
  const root = document.documentElement;
  const films = [...stage.querySelectorAll('.film')];
  const wide = matchMedia('(min-width: 1024px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = films[0];
  let visible = false;
  let paused = root.classList.contains('motion-paused');

  // ── loops: only the open panel plays, only while the section is on screen
  const sync = () => films.forEach((f) => {
    const v = f.querySelector('video.film-media');
    if (!v) return;
    const on = f === current && visible && !paused && !reduced.matches && !modal.open;
    if (on) {
      if (!v.src && v.dataset.loop) v.src = v.dataset.loop;
      v.play().catch(() => {});
    } else v.pause();
  });
  const activate = (f) => {
    if (f === current) return;
    current?.removeAttribute('aria-current');
    current = f;
    f.setAttribute('aria-current', 'true');
    sync();
  };

  films.forEach((f) => {
    let t;
    f.addEventListener('pointerenter', (e) => {
      if (!wide.matches || e.pointerType !== 'mouse') return;
      clearTimeout(t);
      t = setTimeout(() => activate(f), 90);
    });
    f.addEventListener('pointerleave', () => { clearTimeout(t); f.classList.remove('is-pointer'); });
    f.addEventListener('pointermove', (e) => {
      if (!wide.matches || e.pointerType !== 'mouse') return;
      const r = f.getBoundingClientRect();
      f.style.setProperty('--x', `${e.clientX - r.left}px`);
      f.style.setProperty('--y', `${e.clientY - r.top}px`);
      f.classList.add('is-pointer');
    });
    f.addEventListener('focusin', () => activate(f));
  });

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { threshold: 0.2 }).observe(stage);
  // phones: the card that sits in the middle of the row is the open one
  const centre = new IntersectionObserver((entries) => {
    if (wide.matches) return;
    entries.forEach((en) => { if (en.isIntersecting) activate(en.target); });
  }, { root: stage, threshold: 0.65 });
  films.forEach((f) => centre.observe(f));
  document.addEventListener('motion-state', (e) => { paused = e.detail.paused; sync(); });
  reduced.addEventListener('change', sync);

  // ── player
  const frame = modal.querySelector('.fm-frame');
  const video = modal.querySelector('.fm-video');
  const embed = modal.querySelector('.fm-embed');
  const range = modal.querySelector('.fm-range');
  const time = modal.querySelector('.fm-time');
  const playBtn = modal.querySelector('.fm-play');
  const muteBtn = modal.querySelector('.fm-mute');
  const caseLink = modal.querySelector('.fm-case');
  const ease = [0.23, 1, 0.32, 1];
  let origin = null;
  let idle;

  const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
  const clipFrom = (r) => {
    const f = frame.getBoundingClientRect();
    return `inset(${r.top - f.top}px ${f.right - r.right}px ${f.bottom - r.bottom}px ${r.left - f.left}px round 2px)`;
  };
  const full = 'inset(0px 0px 0px 0px round 2px)';
  const wake = () => {
    frame.classList.remove('is-idle');
    clearTimeout(idle);
    idle = setTimeout(() => { if (!video.paused) frame.classList.add('is-idle'); }, 2200);
  };

  const open = (btn) => {
    origin = btn;
    const { play, provider, title, client } = btn.dataset;
    modal.querySelector('.fm-title').textContent = title;
    modal.querySelector('.fm-client').textContent = client;
    caseLink.hidden = !btn.dataset.case;
    if (btn.dataset.case) caseLink.href = `/arbeiten/${btn.dataset.case}`;
    const file = provider === 'file';
    frame.classList.toggle('is-embed', !file);
    video.hidden = !file;
    embed.hidden = file;
    if (file) {
      video.src = play;
      video.poster = btn.querySelector('video')?.poster || '';
      video.muted = false;
    } else {
      const id = encodeURIComponent(play);
      const iframe = document.createElement('iframe');
      iframe.src = provider === 'youtube'
        ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`
        : `https://player.vimeo.com/video/${id}?dnt=1&autoplay=1&title=0&byline=0&portrait=0&color=d4ff3f`;
      iframe.allow = 'autoplay; fullscreen; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.title = title;
      embed.replaceChildren(iframe);
    }
    root.classList.add('film-open');
    modal.showModal();
    sync();
    if (!reduced.matches) animate(frame, { clipPath: [clipFrom(btn.getBoundingClientRect()), full] }, { duration: 0.75, ease });
    if (file) { video.play().catch(() => {}); wake(); }
    modal.querySelector('.fm-close').focus({ preventScroll: true });
  };

  const close = async () => {
    if (!modal.open || modal.classList.contains('is-closing')) return;
    video.pause();
    modal.classList.add('is-closing');
    if (!reduced.matches && origin) {
      await animate(frame, { clipPath: [full, clipFrom(origin.getBoundingClientRect())] }, { duration: 0.45, ease: [0.5, 0, 0.75, 0] });
    }
    modal.close();
  };

  modal.addEventListener('close', () => {
    modal.classList.remove('is-closing');
    root.classList.remove('film-open');
    video.removeAttribute('src');
    video.load();
    embed.replaceChildren();
    frame.style.clipPath = '';
    origin?.focus({ preventScroll: true });
    sync();
  });
  modal.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  modal.querySelector('.fm-close').addEventListener('click', close);

  stage.addEventListener('click', (e) => {
    const btn = e.target.closest('.film-hit');
    if (!btn) return;
    // a first tap on a closed panel (keyboard/touch on desktop widths) opens the panel
    const film = btn.closest('.film');
    if (wide.matches && film !== current) { activate(film); return; }
    open(btn);
  });

  // controls
  const togglePlay = () => (video.paused ? video.play() : video.pause());
  playBtn.addEventListener('click', togglePlay);
  video.addEventListener('click', togglePlay);
  video.addEventListener('play', () => { frame.classList.remove('is-paused'); playBtn.setAttribute('aria-label', 'Pause'); wake(); });
  video.addEventListener('pause', () => { frame.classList.add('is-paused'); frame.classList.remove('is-idle'); playBtn.setAttribute('aria-label', 'Abspielen'); });
  video.addEventListener('timeupdate', () => {
    const p = video.duration ? video.currentTime / video.duration : 0;
    range.value = String(Math.round(p * 1000));
    range.style.setProperty('--p', `${p * 100}%`);
    time.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
  });
  range.addEventListener('input', () => {
    if (video.duration) video.currentTime = (Number(range.value) / 1000) * video.duration;
    range.style.setProperty('--p', `${Number(range.value) / 10}%`);
  });
  muteBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    frame.classList.toggle('is-muted', video.muted);
    muteBtn.setAttribute('aria-label', video.muted ? 'Ton an' : 'Ton aus');
  });
  modal.querySelector('.fm-full').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else (frame.requestFullscreen?.() ?? video.webkitEnterFullscreen?.());
  });
  frame.addEventListener('pointermove', wake);
  modal.addEventListener('keydown', (e) => {
    if (e.key === ' ' && !frame.classList.contains('is-embed') && e.target.tagName !== 'BUTTON' && e.target !== range) {
      e.preventDefault();
      togglePlay();
    }
  });
}
