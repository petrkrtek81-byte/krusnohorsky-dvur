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
// šetření dat (Úspora dat v telefonu / 2G): průlety se nestahují, zůstanou plakáty a texty
const conn = navigator.connection || {};
const saveData = conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');
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

/* ---------- terasa: jemný parallax (jednou za snímek) ---------- */
const terasa = $('.terasa');
if (terasa && !reduce) {
  let tick = false;
  const pa = () => { tick = false; const r = terasa.getBoundingClientRect(); if (r.bottom < -200 || r.top > innerHeight + 200) return; terasa.style.setProperty('--py', String(Math.round((r.top + r.height / 2 - innerHeight / 2) * -0.12))); };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(pa); } }, { passive: true }); pa();
}

/* ---------- telefon: spodní lišta Rezervovat / Zavolat (objeví se po úvodu, schová se u kontaktu) ---------- */
const lista = $('.mobil-lista');
if (lista) {
  const uvod = $('#uvod'), kontakt = $('#kontakt');
  let t2 = false;
  const ml = () => {
    t2 = false;
    const za = uvod ? uvod.getBoundingClientRect().bottom < innerHeight * 0.6 : scrollY > 300;
    const u = kontakt ? kontakt.getBoundingClientRect().top < innerHeight * 0.8 : false;
    lista.classList.toggle('is-on', za && !u);
  };
  addEventListener('scroll', () => { if (!t2) { t2 = true; requestAnimationFrame(ml); } }, { passive: true }); ml();
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
    // ResizeObserver místo window resize: na telefonu se při schovávání adresního řádku nic nepřekresluje
    if ('ResizeObserver' in window) new ResizeObserver(() => this.resize()).observe(this.canvas);
    else addEventListener('resize', () => this.resize());
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
    for (let p = 0, n = this.kind === 'm' ? 4 : 6; p < n; p++) next(); // souběžná stahování (telefon 4, desktop 6)
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
    // snímky mají nejvýš 1280 px, větší plátno jen zbytečně žere paměť a výkon (hlavně v telefonu)
    const dpr = Math.min(devicePixelRatio || 1, this.kind === 'm' ? 2 : 1.5);
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (w === this.canvas.width && h === this.canvas.height) return; // nastavení stejné velikosti by plátno vymazalo
    this.canvas.width = w; this.canvas.height = h;
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
  if (saveData) { root.classList.add('setri-data'); seqs.forEach(q => q.caps.forEach(c => c.el.classList.add('is-on'))); return; }
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
    ST.config({ ignoreMobileResize: true }); // schovávání adresního řádku nepřepočítává scroll (žádné poskakování)
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
