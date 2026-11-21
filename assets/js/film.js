/* Krušnohorský Dvůr – filmový web
   Průlety: sekvence snímků WebP (assets/seq/<název>/{d,m}/0001.webp) se kreslí na <canvas> podle scrollu.
   Desktop 1280×720 / 24 fps, mobil výřez 9:16 / 12 fps. Snímky se načítají od hrubých k jemným
   (nejdřív každý 16., pak 8., 4., …), takže scroll funguje hned a postupně se zjemňuje.
   Scroll řídí GSAP ScrollTrigger; když se knihovna nenačte, převezme to jednoduchý vlastní posluchač. */
(() => {
'use strict';
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => innerWidth < 768 || innerHeight > innerWidth * 1.15;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
root.classList.add('js');

/* ---------- hlavička a menu ---------- */
const top = $('.top');
const onScrollTop = () => top.classList.toggle('is-scrolled', scrollY > 40);
addEventListener('scroll', onScrollTop, { passive: true });
onScrollTop();

const menuBtn = $('.menu-btn');
const menu = $('#menu');
function setMenu(open) {
  root.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Zavřít menu' : 'Otevřít menu');
  const l = $('.menu-btn__label', menuBtn);
  if (l) l.textContent = open ? 'Zavřít' : 'Menu';
  menu.inert = !open;
  if (open) $('a', menu).focus({ preventScroll: true });
}
menu.inert = true;
menuBtn.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('menu-open')) { setMenu(false); menuBtn.focus(); } });

/* ---------- objevení obsahu při scrollu ---------- */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
$$('.reveal').forEach(el => io.observe(el));

/* ---------- karty rozcestníku: světlo za myší ---------- */
$$('.karta').forEach(k => k.addEventListener('pointermove', e => {
  const r = k.getBoundingClientRect();
  k.style.setProperty('--mx', `${e.clientX - r.left}px`);
  k.style.setProperty('--my', `${e.clientY - r.top}px`);
}));

/* ---------- terasa: jemný parallax ---------- */
const terasa = $('.terasa');
if (terasa && !reduce) {
  const pa = () => { const r = terasa.getBoundingClientRect(); terasa.style.setProperty('--py', String(Math.round((r.top + r.height / 2 - innerHeight / 2) * -0.12))); };
  addEventListener('scroll', pa, { passive: true }); pa();
}

/* ---------- průlety (sekvence snímků na canvasu) ---------- */
class Sequence {
  constructor(section, info) {
    this.section = section;
    this.canvas = $('canvas', section);
    this.ctx = this.canvas.getContext('2d');
    this.name = section.dataset.seq;
    this.kind = isMobile() ? 'm' : 'd';
    this.count = info[this.kind];
    this.frames = new Array(this.count);
    this.current = -1;
    this.target = 0;
    this.started = false;
    this.caps = $$('.cap', section).map(el => ({ el, a: +el.dataset.in, b: +(el.dataset.out || 1.01) }));
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  url(i) { return `assets/seq/${this.name}/${this.kind}/${String(i + 1).padStart(4, '0')}.webp`; }
  start() {
    if (this.started) return;
    this.started = true;
    const order = [], seen = new Set();
    for (const step of [this.count, 16, 8, 4, 2, 1]) for (let i = 0; i < this.count; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
    if (!seen.has(this.count - 1)) order.push(this.count - 1);
    let k = 0;
    const next = () => {
      if (k >= order.length) return;
      const i = order[k++];
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this.frames[i] = img;
        const cur = this.current < 0 ? Infinity : Math.abs(this.current - this.target);
        if (Math.abs(i - this.target) < cur) this.draw(this.target, true);
        next();
      };
      img.onerror = next;
      img.src = this.url(i);
    };
    for (let p = 0; p < 6; p++) next(); // 6 souběžných stahování
  }
  nearest(i) {
    if (this.frames[i]) return i;
    for (let d = 1; d < this.count; d++) {
      if (i - d >= 0 && this.frames[i - d]) return i - d;
      if (i + d < this.count && this.frames[i + d]) return i + d;
    }
    return -1;
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.draw(this.target, true);
  }
  draw(i, force) {
    const j = this.nearest(i);
    if (j < 0 || (j === this.current && !force)) return;
    const img = this.frames[j], cw = this.canvas.width, ch = this.canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    this.ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    this.current = j;
  }
  progress(p) {
    p = clamp(p, 0, 1);
    this.section.style.setProperty('--p', p.toFixed(4));
    this.target = Math.round(p * (this.count - 1));
    this.draw(this.target);
    for (const c of this.caps) c.el.classList.toggle('is-on', p >= c.a && p < c.b);
  }
}

async function initSequences() {
  const sections = $$('.fly[data-seq]');
  if (!sections.length) return;
  let manifest = {};
  try { manifest = await (await fetch('assets/seq/manifest.json', { cache: 'no-cache' })).json(); } catch { /* bez průletů zůstanou plakáty */ }
  const seqs = sections.filter(s => manifest[s.dataset.seq]).map(s => new Sequence(s, manifest[s.dataset.seq]));
  if (reduce) { seqs.forEach(q => { q.start(); q.target = Math.round(q.count * 0.6); q.caps.forEach(c => c.el.classList.add('is-on')); }); return; }

  // úvodní průlet hned, ostatní až s předstihem před příchodem (nebo při najetí na kartu rozcestníku)
  seqs.forEach((q, n) => {
    if (n === 0) q.start();
    else new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { q.start(); o.disconnect(); } }, { rootMargin: '150% 0px' }).observe(q.section);
  });
  $$('.karta[data-prefetch]').forEach(k => k.addEventListener('pointerenter', () => { const q = seqs.find(x => x.name === k.dataset.prefetch); if (q) q.start(); }, { once: true }));

  const g = window.gsap, ST = window.ScrollTrigger;
  if (g && ST) {
    g.registerPlugin(ST);
    seqs.forEach(q => ST.create({ trigger: q.section, start: 'top top', end: 'bottom bottom', scrub: 0.4, onUpdate: self => q.progress(self.progress) }));
    seqs.forEach(q => q.progress(0));
  } else {
    // záloha bez GSAP
    const update = () => seqs.forEach(q => {
      const r = q.section.getBoundingClientRect();
      q.progress(-r.top / Math.max(1, r.height - innerHeight));
    });
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
  }
}
initSequences();
})();
