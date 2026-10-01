#!/usr/bin/env node
/**
 * build.mjs — statikus generálás a GitHub Pages-hez
 *
 *   node build.mjs          (vagy: npm run build)
 *
 * Bemenet:
 *   public/data/recommendations.json   extract.mjs adatcsomagja
 *   content/kiemelt.json               kézzel szerkesztett KIEMELT felhívások (opcionális)
 *
 * Kimenet (git-eltől független, CI-ben készül, .gitignore-ban):
 *   public/kategoria/<kategória>/index.html   7 db témaajánló aloldal
 *   public/sitemap.xml, public/robots.txt
 *
 * Hibák (ismeretlen discussionId/stepId, rossz domain) → exit 1, hogy a
 * CI deploy-ja NE fusson le hibás/holt linkű oldalakkal.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(HERE, "public");
const OUT = path.join(PUB, "kategoria");
const SITE = "https://madcsaba.github.io/kozhang_ajanlo";

const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => n == null ? "—" : new Intl.NumberFormat("hu-HU").format(n);
const pickHu = (v) => typeof v === "string" ? v : (v?.hu || v?.en || "");

let DATA;
try {
  DATA = JSON.parse(fs.readFileSync(path.join(PUB, "data/recommendations.json"), "utf8"));
} catch (e) {
  fail(`nem olvasható az adatcsomag (futtasd: node extract.mjs) — ${e.message}`);
}

/**
 * Kategória-sablonok: címke + az irányított bevezető szöveg.
 * EZ A HELY, AHOL A SAJÁT SZÖVEGEID ÁLLNAK — kategóriánként egy-egy.
 */
const CATS = {
  "public-media": {
    label: "Közmédia",
    intro: "A közmédia jövője mindannyiunk ügye. Itt gyűjtjük a közmédiával kapcsolatos egyeztetéseket, a nyitott kérdéseket és a műsorötleteket — szólj hozzá te is, mert egyetlen szavazaton is múlhat, mi kerül képernyőre 2030-ban.",
  },
  "culture": {
    label: "Kultúra",
    intro: "A kultúra, a közös emlékezet és a társadalmi együttélés kérdései szinte mindig szerepelnek a Közhang egyeztetéseiben. Ha neked is van véleményed arról, milyen kulturális témákat érdemes felvenni a napirendre, itt találod a kapcsolódó alkalmakat.",
  },
  "transport": {
    label: "Közlekedés",
    intro: "KRESZ, vasúti közlekedés, kerékpáros nyomvonalak, helyi forgalmi rendek — a közlekedési döntések mindennapjainkat érintik, mégis kevesen szólalnak meg bennük. Válassz témát, és szavazz, hogy merre menjünk.",
  },
  "digital": {
    label: "Digitális",
    intro: "Digitális közigazgatás, közös platformok, adat és nyitottság — a digitális témák gyorsan dőlnek el, mert kevés résztvevő dönt róluk. Érdemes bele szólni, amíg nyitott az ajtó.",
  },
  "economy": {
    label: "Gazdaság",
    intro: "A gazdaság jövője, a helyi vállalkozások és a mezőgazdaság kérdései hosszú távon formálják a környezetedet. Itt találod a nyitott és hamarosan nyíló gazdasági egyeztetéseket — a véleményed még időben számít.",
  },
  "municipality": {
    label: "Önkormányzat",
    intro: "Legyen szó tisztább utcákról, lakhatásról vagy egy tó vízminőségéről: az önkormányzati döntések a te környékedet érintik a legközelebbről. Ezek az egyeztetések gyakran helyi kérdésekről szólnak, ahol egyetlen visszajelzés is irányt mutathat.",
  },
  "climate": {
    label: "Klíma és környezet",
    intro: "Vizek minősége, tópartok, környezetvédelem — a klíma- és természetvédelmi témák most dőlnek el, amikor még van rá idő. Ha fontos neked a környezeted, itt szavazhatsz a megőrzéséről.",
  },
};

// ————————————————————————————————————————————————————————— súgók

const card = (d) => {
  const label = CATS[d.category]?.label ?? d.category;
  const img = d.hero || d.photo;
  const statusLabel = d.status === "open" ? "Nyitott" : "Hamarosan";
  const place = d.locality ? (d.locality.label?.hu || d.locality.town) : "Országos";
  const bits = [];
  if (d.status === "open") bits.push(`<span><b>${fmt(d.participants)}</b> résztvevő</span>`);
  else if (d.participants) bits.push(`<span><b>${fmt(d.participants)}</b> érdeklődő</span>`);
  if (d.daysLeft != null) bits.push(`<span><b>${d.daysLeft}</b> nap hátra</span>`);
  if (d.stepCount) bits.push(`<span><b>${d.stepCount}</b> kérdés</span>`);
  if (d.knowledgeCount) bits.push(`<span><b>${d.knowledgeCount}</b> cikk</span>`);
  const rate = d.status === "open" && d.completionRate > 0
    ? `<div class="meter" title="Befejezési arány: ${d.completionRate}%"><i style="width:${d.completionRate}%"></i></div>` : "";
  const cta = d.status === "open" ? "Részvétel →" : "Megnézem →";
  return `<article class="card">
    <div class="thumb">
      <div class="fallback">${esc(pickHu(d.title).slice(0, 2))}</div>
      ${img ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
      <span class="badge ${d.status}">${statusLabel}</span>
      <span class="cat" style="--cc:var(--c-${d.category}, var(--c-default))">${esc(label)}</span>
    </div>
    <div class="body">
      <h3><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(pickHu(d.title))}</a></h3>
      <p class="desc">${esc(pickHu(d.description))}</p>
      <div class="meta"><span>📍 ${esc(place)}</span>${bits.join("")}</div>
      ${rate}
      <div class="acts">
        <a class="btn primary" href="${esc(d.url)}" target="_blank" rel="noopener">${cta}</a>
        <span class="mini">${d.questions.length ? `${d.questions.length} kérdés a lépéseken` : "hamarosan részletek"}</span>
      </div>
    </div>
  </article>`;
};

const kitem = (k) => {
  const d = k.date ? new Date(k.date + "T00:00:00") : null;
  const dateTxt = d && !isNaN(d) ? d.toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" }) : "";
  const title = pickHu(k.title);
  const lead = pickHu(k.lead);
  const src = pickHu(k.source);
  const excerpt = lead.slice(0, 150) + (lead.length > 150 ? "…" : "");
  const cats = (k.categories || []).map(c => `<span class="tag-s">${esc(CATS[c]?.label ?? c)}</span>`).join("");
  return `<article class="kitem">
    <div class="d">${esc(dateTxt)}</div>
    <h4><a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(title)}</a></h4>
    <p>${esc(excerpt)}</p>
    <div class="tags">${src ? `<span class="tag-s">Forrás: ${esc(src)}</span>` : ""}${cats}</div>
  </article>`;
};

// ——————————————————————————————————————————— kiemelt felhívások (content/kiemelt.json)

function loadPromo() {
  const f = path.join(HERE, "content", "kiemelt.json");
  if (!fs.existsSync(f)) return [];
  let list;
  try { list = JSON.parse(fs.readFileSync(f, "utf8")); }
  catch (e) { fail(`content/kiemelt.json nem értelmezhető — ${e.message}`); }
  if (!Array.isArray(list)) fail("content/kiemelt.json: tömböt várunk");

  return list.map((item, i) => {
    const where = `kiemelt.json[${i}]`;
    if (!item.discussionId) fail(`${where}: hiányzik a discussionId`);
    const d = DATA.discussions.find(x => x.id === item.discussionId);
    if (!d) fail(`${where}: ismeretlen discussionId „${item.discussionId}”`);

    let url = item.url || null;
    let how = "az egyeztetés főoldala";
    if (!url && item.stepId) {
      const q = (d.questions || []).find(q => q.id === item.stepId);
      if (!q) fail(`${where}: ismeretlen stepId „${item.stepId}” a(z) ${d.id} egyeztetésben`);
      url = q.url; how = `közvetlen lépés: ${pickHu(q.title)}`;
    } else if (!url && item.useIdeas) {
      if (!d.ideasUrl) fail(`${where}: a(z) ${d.id} egyeztetésnek nincs ideasUrl-je`);
      url = d.ideasUrl; how = "az ötletek listája";
    }
    if (!url) { url = d.url; }
    if (!/^https:\/\/kozhang\.hu\//.test(url)) fail(`${where}: csak kozhang.hu URL engedélyezett (kapott: ${url})`);
    if (!CATS[d.category]) fail(`${where}: a(z) ${d.category} kategóriához nincs sablon (CATS)`);
    return { ...item, discussion: d, url, target: how };
  });
}

const promoHtml = (p) => {
  const d = p.discussion;
  const label = CATS[d.category].label;
  return `<section id="kiemelt">
  <div class="promo" style="--pc:var(--c-${d.category})">
    <span class="tag">★ ${esc(p.label || "Kiemelt felhívás")}</span>
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.pitch)}</p>
    ${p.preferred ? `<p class="pref"><b>Ajánlott választás:</b> ${esc(p.preferred)}</p>` : ""}
    <div class="acts">
      <a class="btn primary" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.cta || "Irány a szavazás")} →</a>
      <a class="btn ghost" href="${esc(d.url)}" target="_blank" rel="noopener">A teljes egyeztetés</a>
    </div>
    <p class="discl">Kiemelt szervezői ajánlás (irányított) – a döntés a tiéd. Cél: ${esc(p.target)}. Adat: kozhang.hu</p>
  </div>
</section>`;
};

// —————————————————————————————————————————————————————— aloldal-sablon

function page(catKey, discs, knos, promos) {
  const { label, intro } = CATS[catKey];
  const open = discs.filter(d => d.status === "open").length;
  const questions = discs.reduce((n, d) => n + (d.questions?.length || 0), 0);
  const desc = `${intro} ${discs.length} egyeztetés, ${questions} kérdés – a kozhang.hu nyilvános adataiból.`;
  const gen = new Date(DATA.generatedAt || Date.now());
  const genTxt = isNaN(gen) ? "" : gen.toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" });

  const others = Object.keys(CATS)
    .filter(k => k !== catKey)
    .map(k => `<a class="chip" href="../${k}/">${esc(CATS[k].label)}</a>`).join("");

  const stats = `<div class="stats">
    <div class="stat"><div class="n">${discs.length}</div><div class="l">egyeztetés</div></div>
    <div class="stat"><div class="n">${open}</div><div class="l">most nyitott</div></div>
    <div class="stat"><div class="n">${questions || "—"}</div><div class="l">kérdés</div></div>
    <div class="stat"><div class="n">${knos.length || "—"}</div><div class="l">Tudástér-cikk</div></div>
  </div>`;

  const cards = [...discs]
    .sort((a, b) => (a.status === b.status ? (b.participants || 0) - (a.participants || 0) : a.status === "open" ? -1 : 1))
    .map(card).join("");

  return `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(label)} – miben érdemes részt venned? | Közhang témaajánló</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/kategoria/${catKey}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Közhang témaajánló">
<meta property="og:title" content="${esc(label)} – miben érdemes részt venned?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}/kategoria/${catKey}/">
<meta name="twitter:card" content="summary">
<link rel="icon" href="https://kozhang.hu/favicon.svg">
<link rel="stylesheet" href="../../assets/site.css">
</head>
<body>
<div class="wrap">

<header class="top">
  <nav class="crumbs"><a href="../../index.html">Főoldal</a> <span>›</span> <span>Kategória</span> <span>›</span> <b>${esc(label)}</b></nav>
  <span class="eyebrow">● kategória-ajánló · ${discs.length} egyeztetés</span>
  <h1>${esc(label)} – miben érdemes részt venned?</h1>
  <p class="sub">${esc(intro)}</p>
  <p class="srcnote">Forrás: <b>kozhang.hu</b> · adatfrissítés: ${esc(genTxt)} · az oldal nem hivatalos, nem a Közhang terméke.</p>
</header>

${stats}
${promos.map(promoHtml).join("\n")}

<section id="egyeztetesek">
  <div class="sec-head">
    <h2>Kapcsolódó egyeztetések</h2>
    <span class="hint">${discs.filter(d => d.status === "open").length} nyitott · ${discs.filter(d => d.status !== "open").length} hamarosan</span>
  </div>
  <div class="grid">${cards}</div>
</section>

${knos.length ? `<section id="tudaster">
  <div class="sec-head">
    <h2>Tudástér – háttéranyagok</h2>
    <span class="hint">${knos.length} cikk</span>
  </div>
  <div class="klist">${knos.map(kitem).join("")}</div>
</section>` : ""}

<section id="tovabbi">
  <div class="sec-head">
    <h2>További témák</h2>
    <span class="hint">Minden kategóriának saját aloldala van</span>
  </div>
  <div class="chips">${others}</div>
  <a class="backlink" href="../../index.html">← Minden téma és szűrő a főoldalon</a>
</section>

<footer>
  <p>
    <b>Forrás:</b> kozhang.hu – adatnyerés a nyilvános JavaScript bundle-ökből, mert a
    Közhang felületén nincs nyilvános tartalom-API és a böngészőoldali lekérdezést a CORS tiltja.
    Az oldal nem hivatalos, nem a Közhang terméke.
  </p>
  <p>
    A tartalom és a témaadatok a <a href="https://kozhang.hu" target="_blank" rel="noopener">Közhang Nonprofit Kft.</a>
    tulajdona. Kérdés: <a href="mailto:info@kozhang.hu">info@kozhang.hu</a>. Közvetlen részvétel:
    <a href="https://kozhang.hu/egyeztetesek" target="_blank" rel="noopener">kozhang.hu/egyeztetesek</a>.
  </p>
</footer>

</div>
</body>
</html>
`;
}

// ——————————————————————————————————————————————————————————— fő

const promo = loadPromo();
fs.rmSync(OUT, { recursive: true, force: true });

let pageCount = 0;
for (const key of Object.keys(CATS)) {
  const discs = DATA.discussions.filter(d => d.category === key);
  if (!discs.length) { console.error(`·  „${key}” üres – kihagyva`); continue; }
  const knos = DATA.knowledge.filter(k => (k.categories || []).includes(key));
  const promos = promo.filter(p => p.discussion.category === key);

  const dir = path.join(OUT, key);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), page(key, discs, knos, promos));
  pageCount++;
  console.log(`✓  kategoria/${key}/index.html  — ${discs.length} egyeztetés, ${knos.length} cikk, ${promos.length} kiemelt`);
}

// sitemap + robots
const lastmod = (() => {
  const d = new Date(DATA.generatedAt || Date.now());
  return isNaN(d) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
})();
const urls = [`${SITE}/`, ...Object.keys(CATS).map(k => `${SITE}/kategoria/${k}/`)];
fs.writeFileSync(path.join(PUB, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${u}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n") + `\n</urlset>\n`);
fs.writeFileSync(path.join(PUB, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`✓  sitemap.xml + robots.txt  — ${urls.length} URL, lastmod ${lastmod}`);
console.log(`Kész: ${pageCount} kategóriaaloldal.`);
