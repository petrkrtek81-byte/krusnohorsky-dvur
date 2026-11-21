# Krušnohorský Dvůr – filmový web (návrh)

Statický web (HTML/CSS/JS, bez backendu) se „scroll fly-through“ efektem: při scrollu se na `<canvas>` vykreslují snímky průletu kamery – přílet nad golfovým hřištěm ke vchodu, průlet chodbou po schodech do pokoje a doprava přes bar do restaurace ke krbu.

- `index.html` – úvod (obří nápis + přílet), Dvůr ze všech stran, rozcestník Pokoje / Restaurace, pokoje, restaurace, terasa, kontakt
- `cenik.html` – ceník (balíčky, ceny pokojů, storno, služby)
- `assets/css/film.css`, `assets/js/film.js` – styly a skript (GSAP + ScrollTrigger z cdnjs; bez nich funguje záložní posluchač scrollu)
- `assets/seq/<průlet>/{d,m}/0001.webp` – snímky průletů: desktop 1280×720 při 24 fps, mobil výřez 9:16 (450×800) při 12 fps; načítají se postupně od hrubých k jemným
- `nastroje/zpracuj-media.js` – z `assets/generated/raw` udělá jednotný barevný grade, WebP fotky (1920 + 960 px) a snímky průletů; když video chybí, složí průlet z fotek (plynulý nájezd kamery + prolnutí)
- Telefon: plakát i snímky průletu jsou výřez 9:16 podle cíle kamery, výška sekcí v `svh` (neposkakuje při schovávání adresního řádku), plátno se nepřekresluje při změně adresního řádku, při Úspoře dat / 2G se průlety nestahují, spodní lišta Rezervovat / Zavolat
- `nastroje/server.js` – náhled: `node nastroje/server.js . 5580` → http://localhost:5580

Web je návrh: `noindex` + `robots.txt` Disallow.

## Vygenerované soubory (Google Gemini – Nano Banana a Veo)

Verze z 21. 11. 2026 (léto, zlatá hodinka, bez sněhu). Všechny vznikly v jednom chatu Gemini podle tří koláží skutečných fotek hotelu (`podklady/reference/kolaz-exterier.jpg`, `kolaz-vchod.jpg` – fotky z Mapy.com, `kolaz-interier.jpg`). Skutečné uspořádání podle majitele: vchod je z boku u terasy s nápisem RESTAURACE (červené schody, prosklené dveře v kamenné zdi), uvnitř vpravo bar a restaurace, vlevo schodiště nahoru k pokojům. Originály v `assets/generated/raw/`, upravené WebP v `assets/generated/`. Při výměně za skutečné fotky stačí nahradit soubor v `raw/` (stejný název) a spustit `node nastroje/zpracuj-media.js`.

Průlety jsou skutečná videa z Veo (Gemini, 21. 11. 2026, každé 10 s, 1280×720) vygenerovaná ze stejných fotek: `v1-prilet-k-vchodu.mp4` (dron od západu slunce ke vchodu – rychlé prolnutí Veo v 5,7 s je v `zpracuj-media.js` nahrazeno plynulým), `v2-hala-pokoj.mp4` (chodba → doleva po schodech → chodba s kobercem; na konci prolnutí do fotky pokoje), `v3-hala-restaurace.mp4` (chodba → doprava podél baru → krb). Úpravy videí a mobilní výřez (sleduje cíl kamery) jsou v objektu `VIDEO` ve skriptu. Když video chybí, skript složí průlet z fotek. Původní zimní verze je v tagu `zaloha-2026-11-21-zimni-verze`.

| Soubor | Co je na něm | Kde na webu |
|---|---|---|
| `01-exterier.jpg` | dron při západu slunce nad hřištěm, rybník, vysílač, hotel | úvod (plakát + začátek příletu) |
| `02-vchod.jpg` | roh u terasy RESTAURACE, schody ke vchodu | konec příletu |
| `02b-vchod-detail.jpg` | vchod zblízka (kamenná zeď, červené schody) | Dvůr ze všech stran |
| `03-hala.jpg` | vstupní chodba: vlevo schodiště, vpravo bar | plakát a začátek průletů Pokoje i Restaurace |
| `03b-schodiste.jpg` | schodiště nahoru | průlet Pokoje |
| `03c-chodba-pokoje.jpg` | podkrovní chodba s červeným kobercem | průlet Pokoje |
| `03d-bar.jpg` | bar s kravskou kůží, průhled do restaurace | průlet Restaurace |
| `04-pokoj-exklusiv.jpg` | Exklusivní pokoj | rozcestník, pokoje, konec průletu |
| `05-pokoj-komfort.jpg` | Komfortní pokoj se štítovým oknem | pokoje |
| `06-pokoj-standard.jpg` | Standardní pokoj | pokoje |
| `07-pokoj-rodinny.jpg` | Rodinný pokoj | pokoje |
| `08-restaurace.jpg` | restaurace s krbem v kamenném sloupu | rozcestník, restaurace, konec průletu |
| `09-jidlo-kachna.jpg` | kachní stehno s knedlíky a zelím | restaurace |
| `10-jidlo-steak.jpg` | hovězí steak s bramborami | restaurace |
| `11-jidlo-dezert.jpg` | borůvkové knedlíky | restaurace |
| `12-hoste-pripitek.jpg` | přátelé si připíjejí u krbu | restaurace |
| `13-hoste-vecere.jpg` | pár při večeři u okna | restaurace, ceník |
| `14-terasa.jpg` | terasa s výhledem na hřiště | terasa |
| `15-exterier-louka.jpg` | hotel z louky nad parkovištěm | Dvůr ze všech stran |
| `16-exterier-bok.jpg` | hotel s dřevěným štítem | Dvůr ze všech stran |
| `17-exterier-rybnik.jpg` | hotel přes rybník na hřišti | Dvůr ze všech stran |

Skutečné (převzaté z webu hotelu): logo, jídelní lístek `assets/img/jidelni-listek-2026.jpg`, všechny texty o pokojích, restauraci, balíčcích, storno a kontakty.

## Doplnit od klienta (TODO)

- **Ceny pokojů za noc** (1 690 / 1 990 / 2 490 / 2 890 Kč, přistýlka 450 Kč) jsou orientační – na webu hotelu nejsou (sezónní ceny v Previo). V kódu označeno `TODO`.
- **Skutečné fotky a videa** místo vygenerovaných (viz tabulka), hlavně vstupní chodba a průlety; ověřit uspořádání (vchod z boku, vpravo bar/restaurace, vlevo schody k pokojům).
- Romantický balíček: sekt vs. 2 h sauny (web hotelu uvádí obojí).
- Cena sauny (teď „na recepci“), dárkové poukazy.
