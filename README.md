# kozhang-ajanlo

Statisztika-alapú témaajánló a **kozhang.hu** egyeztetéseihez — nem hivatalos, a Közhang nem készítette.

Egyetlen statikus oldal, ami saját JSON-adatcsomagból dolgozik: rendez, szűr, keres, és minden
kártya a kozhang.hu megfelelő oldalára visz.

## Miért van rá szükség

A kozhang.hu egy Vite+React SPA, és:

- nincs nyilvános tartalom-API (`ane.kozhang.app/api/v4.0/Content` → 401)
- nincs `robots.txt`-szerű tartalomtérkép, sitemap vagy RSS
- a tartalom a JavaScript bundle-ökbe van égetve
- a böngészőoldali lekérést a **CORS tiltja** (`kozhang.hu/assets/*.js` → `TypeError`)
- a résztvevő- és szavazatszámok is a bundle-ban vannak, build-időben rögzítve

Ezért az adatot **szerveroldalon** nyerjük ki a bundle-ökből, és saját JSON-t gyártunk belőle.

## Használat

```bash
node extract.mjs          # adatcsomag → public/data/recommendations.json
npm run check             # kinyerés + adatcsomag-ellenőrzés
npm run serve             # http://localhost:8787
npm start                 # kinyerés, majs szerver
```

Nincs függőség, csak Node 18+ (beépített `fetch`).

## Amit kinyer

| Adat | Mennyiség | Honnan |
|---|---|---|
| Egyeztetések | 16 (3 nyitott, 13 hamarosan) | `Lo=[{id:…}]` tömb |
| Fejezetek + kérdések | 12 fejezet, 62 kérdés | `chapters:[{steps:…}]` a nyitott témáknál |
| Tudástér-cikkek | 19 | `JSON.parse(\`…\`)` blokk |
| Téma-taxonómia | 12 fő téma × 10 altéma = 120 | `"education-1":"…"` párok |
| Videó-beszélők | 8 | `contentByDiscussion` cinema blokkok |
| Képek | 28 | `.jpg` → `.webp` átalakítással ellenőrizve |

## Az ajánlási pontszám

```
score = 0.20·népszerűség + 0.24·frissesség + 0.14·sürgősség
      + 0.14·a te témád + 0.10·a te vármegyéd + 0.06·kevés hang
      + 0.06·korábban megnézted + 0.06·tartalmi mélység
```

- **népszerűség** — `log10(résztvevők+1) / log10(40000)`, hogy a 32 457 és a 0 közötti
  nagy különbség ne nyomja el a többit
- **frissesség** — nyitott téma + hátralévő napok; a rövid határidő sürget
- **sürgősség** — kevés hátralévő nap → magasabb
- **a te témád** — a „Mi érdekel?” részben választott fő témák (a 12 témaszavazási kulcs)
  átfedése az egyeztetés témáival; a kategória → téma leképezés az `index.html` `CAT_TAXO` /
  `EXTRA_TAXO` táblájában van
- **a te vármegyéd** — helyi egyeztetés a választott vármegyében
- **kevés hang** — nyitott téma kevesebb mint 1000 résztvevővel; ellensúlyozza a népszerűséget,
  hogy a helyi témák ne essenek ki
- **korábban megnézted** — a böngésződ `localStorage`-jába tárolt kattintásaid
- **tartalmi mélység** — kérdések és háttércikkek száma

A témák, a vármegye és a kattintások csak a böngészőben tárolódnak, nem hagyják el a gépet.
Minden kártyán a **„Miért ajánljuk?”** sor a 3 legerősebb okot mutatja; a sorra mutatva látszik
a teljes pontszám-bontás. Az ajánló azt segít eldönteni, *miről* érdemes véleményt mondanod –
soha nem azt, hogy *mit*: a pontszámba nem számít bele, hogy egy téma melyik álláspont felé hajlik.

A **Napi ajánlás** a top 6-ból dátumhoz kötött (de determinisztikus) véletlenszerű 3-at választ,
így napközben stabil, de minden nap más.

## Frissítés

Az adat a kozhang.hu build-jéhez kötött (`version.json`), ezért az `extract.mjs` minden futásnál
újraolvassa a bundle-öket, és a `sourceBuild` mezőben jelzi, melyik buildből származik. Ha a
kozhang.hu frissül, egy újrafuttatás frissíti az adatcsomagot.

A `sourceBuild` jelenleg a fő bundle hash-e (`index-XXXXXXXX.js`), mert a Cloudflare a
`/version.json` mögé kihívást tesz.

## Jogszabályi megjegyzés

A tartalom és a témaadatok a **Közhang Nonprofit Kft.** (1089 Budapest, Visi Imre u. 12.,
`info@kozhang.hu`) tulajdona. A `robots.txt` hiánya nem jelent engedélyt. Ez az oldal csak
nyilvánosan elérhető adatokat rendez újra, és minden kártya a forráshoz visz. Ha a Közhang
kérte a eltávolítását, tedd meg — és érdemes előbb egyeztetni: `info@kozhang.hu`.

## Fájlok

```
extract.mjs              adatnyerés a bundle-ökből
public/index.html        az oldal (egyetlen fájl, inline CSS/JS)
public/data/recommendations.json   generált adatcsomag
```
