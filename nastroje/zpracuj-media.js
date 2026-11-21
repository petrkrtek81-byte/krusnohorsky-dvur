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
  'colorbalance=rs=-0.03:gs=0:bs=0.04:rm=0.01:bm=-0.01:rh=0.05:gh=0.01:bh=-0.04',
  'eq=contrast=1.04:saturation=0.96:gamma=0.98',
  'vignette=angle=PI/5',
].join(',');

// průlety: [soubor, název sekvence, začátek s, konec s, náhrada z fotek když video chybí]
// (Gemini videa v jednom chatu skládá za sebe: v2 = přílet + hala → pokoj (10,2–20 s), v3 = vše + hala → restaurace (20,4–30 s))
const SEQUENCES = [
  ['v1-prilet-k-vchodu.mp4', 'prilet', 0, 10, ['01-exterier-soumrak.jpg', '02-vchod.jpg']],
  ['v2-hala-pokoj.mp4', 'pokoje', 10.25, 20, ['03-hala.jpg', '04-pokoj-exklusiv.jpg']],
  ['v3-hala-restaurace.mp4', 'restaurace', 20.4, 30, ['03-hala.jpg', '08-restaurace.jpg']],
];

// náhrada průletu z fotek: pomalý zoom do první fotky, prolnutí do druhé a další zoom (8 s, 24 fps)
function fallbackVideo(photos, out) {
  const z = (i, n) => `[${i}:v]scale=2560:-2,zoompan=z='1+0.0016*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=1280x720:fps=24,setsar=1[v${i}]`;
  ff(['-loop', '1', '-t', '5', '-i', path.join(RAW, photos[0]), '-loop', '1', '-t', '5', '-i', path.join(RAW, photos[1]),
    '-filter_complex', `${z(0, 120)};${z(1, 120)};[v0][v1]xfade=transition=fade:duration=1.2:offset=3.8,format=yuv420p[v]`,
    '-map', '[v]', '-t', '8', '-c:v', 'libx264', '-crf', '18', out]);
}

const ff = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const rm = d => fs.rmSync(d, { recursive: true, force: true });

// 1) fotky
for (const f of fs.readdirSync(RAW).filter(f => /\.(jpe?g|png)$/i.test(f))) {
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
  let src = path.join(RAW, file), from = from0, to = to0;
  if (!fs.existsSync(src)) {
    src = path.join(RAW, `nahrada-${name}.mp4`);
    console.log('chybí video', file, '– sekvence', name, 'vznikne z fotek', photos.join(' + '));
    fallbackVideo(photos, src); from = 0; to = 8;
    nahrady.add(name);
  }
  const dirD = path.join(OUT_SEQ, name, 'd'), dirM = path.join(OUT_SEQ, name, 'm');
  rm(path.join(OUT_SEQ, name)); fs.mkdirSync(dirD, { recursive: true }); fs.mkdirSync(dirM, { recursive: true });
  const cut = ['-ss', String(from), '-to', String(to), '-i', src, '-an'];
  ff([...cut, '-vf', `fps=24,${GRADE},scale=1280:720:flags=lanczos`, '-c:v', 'libwebp', '-quality', '58', '-compression_level', '6', path.join(dirD, '%04d.webp')]);
  ff([...cut, '-vf', `fps=12,${GRADE},crop=ih*9/16:ih,scale=450:800:flags=lanczos`, '-c:v', 'libwebp', '-quality', '55', '-compression_level', '6', path.join(dirM, '%04d.webp')]);
  const size = d => fs.readdirSync(d).reduce((a, x) => a + fs.statSync(path.join(d, x)).size, 0);
  manifest[name] = { d: fs.readdirSync(dirD).length, m: fs.readdirSync(dirM).length, ...(nahrady.has(name) ? { zFotek: true } : {}) };
  console.log('sekvence', name, manifest[name], `desktop ${(size(dirD) / 1e6).toFixed(1)} MB, mobil ${(size(dirM) / 1e6).toFixed(1)} MB`);
}
fs.writeFileSync(path.join(OUT_SEQ, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log('hotovo', manifest);
