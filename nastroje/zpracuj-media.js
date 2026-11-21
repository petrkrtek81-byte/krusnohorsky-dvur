// node nastroje/zpracuj-media.js – z vygenerovaných podkladů (assets/generated/raw) připraví web:
//  1) fotky: jednotný barevný grade (teplá světla, tmavé modrozelené stíny, jemná vinětace),
//     WebP pro desktop (1920 px) a mobil (960 px) do assets/generated/
//  2) videa (průlety): stejný grade, rozsekání na snímky WebP pro canvas podle scrollu
//     desktop 1280×720 při 24 fps, mobil 9:16 výřez 450×800 při 12 fps → assets/seq/<název>/{d,m}/0001.webp
//  3) assets/seq/manifest.json – počty snímků pro skript webu
// Potřebuje ffmpeg s libwebp. Spouštět po každé výměně podkladů.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'assets/generated/raw');
const OUT_IMG = path.join(ROOT, 'assets/generated');
const OUT_SEQ = path.join(ROOT, 'assets/seq');

// stejný „look“ pro všechny záběry, ať to působí jako jedno natáčení
const GRADE = [
  'colorbalance=rs=-0.01:bs=0.02:rh=0.03:gh=0.01:bh=-0.02',
  'eq=contrast=1.03:saturation=1.0:gamma=0.99',
  'vignette=angle=PI/6',
].join(',');

// průlety: [soubor videa, název sekvence, začátek s, konec s, náhrada z fotek když video chybí]
// Náhrada = „kamera“ složená z fotek: každý záběr se plynule přibližuje k bodu (cx, cy = poměr šířky/výšky)
// a prolíná se do dalšího. Všechny fotky jsou ze stejného chatu Gemini podle skutečných fotek hotelu (léto, bez sněhu).
// záběr: [fotka, zoom od, zoom do, cx, cy, délka s]
const SEQUENCES = [
  // přílet: západ slunce nad hřištěm → nájezd na terasu s nápisem RESTAURACE → nájezd ke vchodu (schody, prosklené dveře)
  ['v1-prilet-k-vchodu.mp4', 'prilet', 0, 10.02, [
    ['01-exterier.jpg', 1, 2.4, 0.66, 0.62, 5.5],
    ['02-vchod.jpg', 1, 1.75, 0.33, 0.52, 4.5],
  ]],
  // pokoje: vstupní chodba → doleva na schodiště → nahoru chodbou s červeným kobercem → pokoj
  ['v2-hala-pokoj.mp4', 'pokoje', 0, 10.02, [
    ['03-hala.jpg', 1, 1.6, 0.12, 0.55, 3.4],
    ['03b-schodiste.jpg', 1, 1.5, 0.5, 0.3, 3],
    ['03c-chodba-pokoje.jpg', 1, 1.8, 0.5, 0.45, 3],
    ['04-pokoj-exklusiv.jpg', 1.18, 1.02, 0.5, 0.5, 3],
  ]],
  // restaurace: vstupní chodba → doprava k baru → restaurace s krbem
  ['v3-hala-restaurace.mp4', 'restaurace', 0, 10.02, [
    ['03-hala.jpg', 1, 1.6, 0.82, 0.5, 3.4],
    ['03d-bar.jpg', 1, 1.5, 0.15, 0.5, 3],
    ['08-restaurace.jpg', 1.18, 1.02, 0.5, 0.55, 3.4],
  ]],
];

// úpravy videí z Veo: [název sekvence] → { strihy: [[a, b]] – rychlé prolnutí/střih mezi a a b s nahradí plynulým
// prolnutím 1 s; mobil: [[t, x]] – kam míří výřez 9:16 v čase t (s, po úpravě), mezi body plynule }
const VIDEO = {
  prilet: { strihy: [[5.7, 6.1]], mobil: [[0, 0.7], [4.7, 0.7], [5.7, 0.52]] },
  // chodba → doleva na schody → nahoru chodbou s kobercem; na konci prolnutí do Exklusivního pokoje
  pokoje: { dofotit: ['04-pokoj-exklusiv.jpg', 1.15, 1.0, 0.5, 0.5, 2.6], mobil: [[0, 0.3], [1.5, 0.5]] },
  // chodba → doprava podél baru → restaurace ke krbu
  restaurace: { mobil: [[0, 0.75], [1.6, 0.5]] },
};

// náhrada průletu z fotek (24 fps, 1920×1080 – z toho ostrý výřez 9:16 pro mobil): plynulý nájezd (ease-in-out) + prolínání 1 s
const FPS = 24, XF = 1;

// úprava videa: rychlé střihy (strihy) → plynulé prolnutí XF s; volitelně na konci prolnutí do fotky
// s pomalým nájezdem (dofotit: [fotka, zoom od, zoom do, cx, cy, délka s]); vrací délku výsledku
function upravVideo(src, from, to, { strihy = [], dofotit } = {}, out) {
  const bounds = [from, ...strihy.flat(), to], parts = [], ins = [];
  for (let i = 0; i < bounds.length; i += 2) {
    ins.push('-ss', String(bounds[i]), '-to', String(bounds[i + 1]), '-i', src);
    parts.push(`[${i / 2}:v]fps=${FPS},scale=1280:720,setsar=1,settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p[p${i / 2}]`);
  }
  let segs = bounds.length / 2;
  if (dofotit) {
    const [f, z0, z1, cx, cy, dur] = dofotit, n = Math.round(dur * FPS);
    ins.push('-i', path.join(RAW, f));
    parts.push(`[${segs}:v]scale=5120:2880:force_original_aspect_ratio=increase,crop=5120:2880,setsar=1,` +
      `zoompan=z='(${z0}+(${z1 - z0})*(0.5-0.5*cos(PI*on/${n - 1})))':x='(iw-iw/zoom)*${cx}':y='(ih-ih/zoom)*${cy}':d=${n}:s=1280x720:fps=${FPS},settb=AVTB,format=yuv420p[p${segs}]`);
    bounds.push(0, dur); segs++;
  }
  let last = 'p0', t = bounds[1] - bounds[0];
  for (let k = 1; k < segs; k++) {
    parts.push(`[${last}][p${k}]xfade=transition=fade:duration=${XF}:offset=${(t - XF).toFixed(3)}[y${k}]`);
    last = `y${k}`; t += bounds[2 * k + 1] - bounds[2 * k] - XF;
  }
  ff([...ins, '-filter_complex', parts.join(';'), '-map', `[${last}]`, '-an', '-t', t.toFixed(3), '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', out]);
  return t;
}

// výřez pro mobil podle bodů [[t, x]] – výraz pro ffmpeg crop (lineárně mezi body)
function mobileKeys(keys) {
  let e = String(keys[0][1]);
  for (let i = 1; i < keys.length; i++) {
    const [t0, x0] = keys[i - 1], [t1, x1] = keys[i];
    if (x1 !== x0) e += `+(${(x1 - x0).toFixed(3)})*clip((t-${t0})/${Math.max(0.01, t1 - t0)},0,1)`;
  }
  return e;
}
function fallbackVideo(shots, out) {
  const ins = [], parts = [];
  shots.forEach(([f, z0, z1, cx, cy, dur], i) => {
    const n = Math.round(dur * FPS);
    ins.push('-i', path.join(RAW, f)); // jedna fotka → zoompan z ní udělá n snímků
    const z = `(${z0}+(${z1 - z0})*(0.5-0.5*cos(PI*on/${n - 1})))`;
    // vstup zvětšený na 5120 px, ať je pohyb kamery plynulý (zoompan zaokrouhluje na celé pixely)
    parts.push(`[${i}:v]scale=5120:2880:force_original_aspect_ratio=increase,crop=5120:2880,setsar=1,` +
      `zoompan=z='${z}':x='(iw-iw/zoom)*${cx}':y='(ih-ih/zoom)*${cy}':d=${n}:s=1920x1080:fps=${FPS},format=yuv420p[s${i}]`);
  });
  let last = 's0', t = shots[0][5];
  for (let i = 1; i < shots.length; i++) {
    parts.push(`[${last}][s${i}]xfade=transition=fade:duration=${XF}:offset=${(t - XF).toFixed(3)}[x${i}]`);
    last = `x${i}`; t += shots[i][5] - XF;
  }
  ff([...ins, '-filter_complex', parts.join(';'), '-map', `[${last}]`, '-t', t.toFixed(3), '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', out]);
  return t;
}

// mobilní výřez 9:16 sleduje bod, ke kterému kamera najíždí (cx každého záběru),
// při prolínání se plynule přesune k dalšímu – jinak by na mobilu hotel / vchod / schody utekly z obrazu
function mobileCenter(shots) {
  let e = String(shots[0][3]), s = shots[0][5];
  for (let i = 1; i < shots.length; i++) {
    const d = shots[i][3] - shots[i - 1][3];
    if (d) e += `+(${d.toFixed(3)})*clip((t-${(s - XF).toFixed(3)})/${XF},0,1)`;
    s += shots[i][5] - XF;
  }
  return e;
}

const ff = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const rm = d => fs.rmSync(d, { recursive: true, force: true });

// 1) fotky (JEN_PRULETY=1 je přeskočí)
for (const f of process.env.JEN_PRULETY ? [] : fs.readdirSync(RAW).filter(f => /\.(jpe?g|png)$/i.test(f))) {
  const base = f.replace(/\.[^.]+$/, '');
  for (const [suffix, w, q] of [['', 1920, 74], ['-m', 960, 70]]) {
    const out = path.join(OUT_IMG, `${base}${suffix}.webp`);
    ff(['-i', path.join(RAW, f), '-vf', `${GRADE},scale=${w}:-2:flags=lanczos`, '-c:v', 'libwebp', '-quality', String(q), '-compression_level', '6', out]);
  }
  console.log('fotka', base);
}

// 2) průlety → snímky
const manifest = {};
const nahrady = new Set(); // sekvence složené z fotek (video se nepovedlo)
for (const [file, name, from0, to0, photos] of SEQUENCES) {
  let src = path.join(RAW, file), from = from0, to = to0, mx = '0.5';
  if (!fs.existsSync(src)) {
    mx = mobileCenter(photos);
    src = path.join(RAW, `nahrada-${name}.mp4`);
    console.log('chybí video', file, '– sekvence', name, 'vznikne z fotek', photos.map(x => x[0]).join(' + '));
    to = fallbackVideo(photos, src); from = 0;
    nahrady.add(name);
  } else if (VIDEO[name]) {
    const v = VIDEO[name];
    if (v.strihy || v.dofotit) { const out = path.join(RAW, `upraveno-${name}.mp4`); to = upravVideo(src, from, to, v, out); src = out; from = 0; }
    if (v.mobil) mx = mobileKeys(v.mobil);
    console.log('video', file, '→ sekvence', name, `(${to.toFixed(1)} s)`);
  }
  const dirD = path.join(OUT_SEQ, name, 'd'), dirM = path.join(OUT_SEQ, name, 'm');
  rm(path.join(OUT_SEQ, name)); fs.mkdirSync(dirD, { recursive: true }); fs.mkdirSync(dirM, { recursive: true });
  const cut = ['-ss', String(from), '-to', String(to), '-i', src, '-an'];
  ff([...cut, '-vf', `fps=24,${GRADE},scale=1280:720:flags=lanczos`, '-c:v', 'libwebp', '-quality', '58', '-compression_level', '6', path.join(dirD, '%04d.webp')]);
  ff([...cut, '-vf', `fps=12,${GRADE},crop=ih*9/16:ih:x='clip((${mx})*iw-ow/2,0,iw-ow)':y=0,scale=450:800:flags=lanczos`, '-c:v', 'libwebp', '-quality', '55', '-compression_level', '6', path.join(dirM, '%04d.webp')]);
  const size = d => fs.readdirSync(d).reduce((a, x) => a + fs.statSync(path.join(d, x)).size, 0);
  manifest[name] = { d: fs.readdirSync(dirD).length, m: fs.readdirSync(dirM).length, ...(nahrady.has(name) ? { zFotek: true } : {}) };
  console.log('sekvence', name, manifest[name], `desktop ${(size(dirD) / 1e6).toFixed(1)} MB, mobil ${(size(dirM) / 1e6).toFixed(1)} MB`);
}
fs.writeFileSync(path.join(OUT_SEQ, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log('hotovo', manifest);
