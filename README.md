# Krušnohorský Dvůr – filmový web (návrh)

Statický web (HTML/CSS/JS, bez backendu) se „scroll fly-through“ efektem: při scrollu se na `<canvas>` vykreslují snímky průletu kamery – přílet k budově za soumraku, průlet halou do pokoje a do restaurace ke krbu.

- `index.html` – úvod (obří nápis + přílet), rozcestník Pokoje / Restaurace, pokoje, restaurace, terasa, kontakt
- `cenik.html` – ceník (balíčky, ceny pokojů, storno, služby)
- `assets/css/film.css`, `assets/js/film.js` – styly a skript (GSAP + ScrollTrigger z cdnjs; bez nich funguje záložní posluchač scrollu)
- `assets/seq/<průlet>/{d,m}/0001.webp` – snímky průletů: desktop 1280×720 při 24 fps, mobil výřez 9:16 (450×800) při 12 fps; načítají se postupně od hrubých k jemným
- `nastroje/zpracuj-media.js` – z `assets/generated/raw` udělá jednotný barevný grade, WebP fotky (1920 + 960 px) a snímky průletů; když video chybí, složí průlet z fotek (zoom + prolnutí)
- `nastroje/server.js` – náhled: `node nastroje/server.js . 5580` → http://localhost:5580

Web je návrh: `noindex` + `robots.txt` Disallow.

## Vygenerované soubory (Google Gemini – Nano Banana / Veo)

Všechny vznikly v Gemini podle koláže 16 skutečných fotek hotelu (web krusnohorskydvur.cz), se stejným stylovým blokem v každém promptu (teplé zlaté světlo, tmavé modrozelené stíny, soumrak, filmový grade, 35mm objektiv) a jsou dodatečně barevně sjednocené (`zpracuj-media.js`). Originály jsou v `assets/generated/raw/`, upravené WebP v `assets/generated/`. Při výměně za skutečné fotky stačí nahradit soubor v `raw/` (stejný název) a spustit `node nastroje/zpracuj-media.js`.

| Soubor | Co je na něm | Kde na webu |
|---|---|---|
| `01-exterier-soumrak.jpg` | hotel za soumraku z dronu | úvod (plakát před průletem) |
| `02-vchod.jpg` | vchod v dlouhé fasádě | (rezerva, konec příletu) |
| `03-hala.jpg` | recepce, schodiště, průhled do restaurace | plakát průletu Pokoje |
| `04-pokoj-exklusiv.jpg` | Exklusivní pokoj večer | rozcestník, pokoje |
| `05-pokoj-komfort.jpg` | Komfortní pokoj večer | pokoje |
| `06-pokoj-standard.jpg` | Standardní pokoj večer | pokoje |
| `07-pokoj-rodinny.jpg` | Rodinný pokoj večer | pokoje |
| `08-restaurace.jpg` | restaurace s krbem večer | rozcestník, restaurace |
| `09-jidlo-kachna.jpg` | konfitované kachní stehno (z lístku 2026) | restaurace |
| `10-jidlo-steak.jpg` | steak z pravé svíčkové (z lístku 2026) | restaurace |
| `11-jidlo-dezert.jpg` | borůvkové knedlíky (z lístku 2026) | restaurace |
| `12-hoste-pripitek.jpg` | přátelé si připíjejí u krbu | restaurace |
| `13-hoste-vecere.jpg` | pár při večeři u okna | restaurace, ceník |
| `14-terasa.jpg` | terasa s výhledem při západu slunce | terasa |
| `v1-prilet-k-vchodu.mp4` | Veo: dron přilétá k vchodu (10 s) | průlet úvod |
| `v2-hala-pokoj.mp4` | Veo: přílet + hala → schodiště → pokoj (20 s, použito 10–20 s) | průlet Pokoje |
| `v3-hala-restaurace.mp4` | Veo: celý průlet + hala → restaurace ke krbu (30 s, použito 20–30 s) | průlet Restaurace |

Skutečné (převzaté z webu hotelu): logo, jídelní lístek `assets/img/jidelni-listek-2026.jpg`, všechny texty o pokojích, restauraci, balíčcích, storno a kontakty.

## Doplnit od klienta (TODO)

- **Ceny pokojů za noc** (1 690 / 1 990 / 2 490 / 2 890 Kč, přistýlka 450 Kč) jsou orientační – na webu hotelu nejsou (sezónní ceny v Previo). V kódu označeno `TODO`.
- **Skutečné fotky a videa** místo vygenerovaných (viz tabulka), hlavně hala/recepce a průlety.
- Romantický balíček: sekt vs. 2 h sauny (web hotelu uvádí obojí).
- Cena sauny (teď „na recepci“), dárkové poukazy.
