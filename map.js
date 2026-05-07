// ============================================================
// WYDE map — shared logic
// ============================================================
// Each HTML page (index.html / index_fr.html) defines its own
// `window.PAGE_DEFAULTS = { lang, template }` BEFORE loading
// this script. A ?lang= query param can override the default
// for testing.
// ============================================================

const CONFIG = {
  apiBase: 'https://www.kofiannanfoundation.org/wp-json/wp/v2',
  postType: 'posts',

  // Taxonomy slug used by the REST API to narrow the result set
  // before we filter client-side by `template`.
  micrositeTaxonomy: 'microsite',
  micrositeTermId: 1436,

  countryTaxonomy: 'country',
  perPage: 100,

  labels: {
    en: {
      countries: 'countries', stories: 'stories',
      hint: 'Hover or tap a marker',
      indexTitle: 'Index by country', indexHint: 'Click to view stories',
      readMore: 'Read story',
      stories_from: (n) => `${n} stories`,
      loading: 'Loading stories…',
      error: 'Could not load stories. Please try again.',
      story_count: (n) => `${n} ${n === 1 ? 'story' : 'stories'}`
    },
    fr: {
      countries: 'pays', stories: 'récits',
      hint: 'Survolez ou touchez un marqueur',
      indexTitle: 'Index par pays', indexHint: 'Cliquez pour voir les récits',
      readMore: 'Lire l’article',
      stories_from: (n) => `${n} récits`,
      loading: 'Chargement des récits…',
      error: 'Impossible de charger les récits. Veuillez réessayer.',
      story_count: (n) => `${n} ${n === 1 ? 'récit' : 'récits'}`
    }
  }
};

// ============================================================
// COUNTRY GAZETTEER
// Maps country names (as they appear in the WP "country" taxonomy)
// to ISO codes and lon/lat centroids. Add new entries here when
// new countries appear on the WYDE site.
// ============================================================
const COUNTRIES = {
  'Benin':                    { iso: '204', lon:  2.3, lat:   9.3, fr: 'Bénin' },
  'Burkina Faso':             { iso: '854', lon: -1.5, lat:  12.2, fr: 'Burkina Faso' },
  'Cameroon':                 { iso: '120', lon: 12.4, lat:   7.4, fr: 'Cameroun' },
  'Chad':                     { iso: '148', lon: 18.7, lat:  15.5, fr: 'Tchad' },
  "Côte d'Ivoire":            { iso: '384', lon: -5.5, lat:   7.5, fr: 'Côte d’Ivoire' },
  'DR Congo':                 { iso: '180', lon: 23.4, lat:  -2.9, fr: 'RD Congo' },
  'Ghana':                    { iso: '288', lon: -1.0, lat:   7.9, fr: 'Ghana' },
  'Guinea':                   { iso: '324', lon:-10.9, lat:   9.9, fr: 'Guinée' },
  'Kenya':                    { iso: '404', lon: 37.9, lat:   0.0, fr: 'Kenya' },
  'Madagascar':               { iso: '450', lon: 46.9, lat: -18.8, fr: 'Madagascar' },
  'Malawi':                   { iso: '454', lon: 34.3, lat: -13.3, fr: 'Malawi' },
  'Mali':                     { iso: '466', lon: -3.9, lat:  17.6, fr: 'Mali' },
  'Niger':                    { iso: '562', lon:  8.1, lat:  17.6, fr: 'Niger' },
  'Nigeria':                  { iso: '566', lon:  8.7, lat:   9.1, fr: 'Nigéria' },
  'Rwanda':                   { iso: '646', lon: 29.9, lat:  -1.9, fr: 'Rwanda' },
  'Senegal':                  { iso: '686', lon:-14.5, lat:  14.5, fr: 'Sénégal' },
  'Somalia':                  { iso: '706', lon: 46.2, lat:   5.2, fr: 'Somalie' },
  'Sudan':                    { iso: '729', lon: 30.0, lat:  16.0, fr: 'Soudan' },
  'Tanzania':                 { iso: '834', lon: 34.9, lat:  -6.4, fr: 'Tanzanie' },
  'The Gambia':               { iso: '270', lon:-15.4, lat:  13.5, fr: 'Gambie' },
  'Togo':                     { iso: '768', lon:  0.8, lat:   8.6, fr: 'Togo' },
  'Uganda':                   { iso: '800', lon: 32.3, lat:   1.4, fr: 'Ouganda' },
  'Zimbabwe':                 { iso: '716', lon: 29.8, lat: -19.0, fr: 'Zimbabwe' },
};

const FR_TO_EN = Object.fromEntries(
  Object.entries(COUNTRIES).map(([en, v]) => [v.fr.toLowerCase(), en])
);

// ============================================================
// LANGUAGE
// ============================================================
const PAGE_DEFAULTS = window.PAGE_DEFAULTS || { lang: 'en', template: 'single-microsite-wyde' };

const params = new URLSearchParams(location.search);
const langParam = params.get('lang');
const LANG = (langParam === 'fr' || langParam === 'en') ? langParam : PAGE_DEFAULTS.lang;
const TEMPLATE = (LANG === 'fr')
  ? 'single-microsite-wyde-fr'
  : 'single-microsite-wyde';
document.documentElement.lang = LANG;
const T = CONFIG.labels[LANG];

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
setText('label-countries', T.countries);
setText('label-stories', T.stories);
setText('label-hint', T.hint);
setText('label-index', T.indexTitle);
setText('label-index-hint', T.indexHint);
setText('status', T.loading);

// ============================================================
// FETCH STORIES FROM WORDPRESS
// ============================================================
// Cache the filtered post list in localStorage for 10 minutes,
// keyed by template so EN and FR have separate caches. The schema
// version (v1) lets us invalidate everyone if we change the
// shape of what we store.
const CACHE_KEY = `wyde-map:v1:${TEMPLATE}`;
const CACHE_TTL_MS = 10 * 60 * 1000;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, posts } = JSON.parse(raw);
    if (!Array.isArray(posts) || Date.now() - ts > CACHE_TTL_MS) return null;
    return posts;
  } catch { return null; }
}

function writeCache(posts) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), posts }));
  } catch {}
}

async function fetchStories() {
  const cached = readCache();
  if (cached) return cached;

  const url = new URL(`${CONFIG.apiBase}/${CONFIG.postType}`);
  url.searchParams.set('per_page', CONFIG.perPage);
  url.searchParams.set('_embed', '1');
  url.searchParams.set('_fields', 'id,link,title,excerpt,template,_links,_embedded');

  if (CONFIG.micrositeTermId) {
    url.searchParams.set(CONFIG.micrositeTaxonomy, CONFIG.micrositeTermId);
  }

  const all = [];
  let page = 1;
  while (true) {
    url.searchParams.set('page', page);
    const res = await fetch(url.toString());
    if (!res.ok) {
      if (res.status === 400 && page > 1) break;
      throw new Error(`API ${res.status}`);
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < CONFIG.perPage) break;
    page++;
    if (page > 20) break;
  }
  const filtered = all.filter(p => p.template === TEMPLATE);
  writeCache(filtered);
  return filtered;
}

function extractCountry(post) {
  const groups = (post._embedded && post._embedded['wp:term']) || [];
  for (const group of groups) {
    for (const term of group) {
      if (term.taxonomy === CONFIG.countryTaxonomy && term.name) {
        const name = term.name.trim();
        if (COUNTRIES[name]) return name;
        const en = FR_TO_EN[name.toLowerCase()];
        if (en) return en;
        return name;
      }
    }
  }
  return null;
}

function extractImage(post) {
  const media = post._embedded && post._embedded['wp:featuredmedia'];
  if (media && media[0]) {
    const m = media[0];
    if (m.media_details && m.media_details.sizes) {
      const sizes = m.media_details.sizes;
      return (sizes.medium_large || sizes.large || sizes.medium || sizes.full || {}).source_url
          || m.source_url;
    }
    return m.source_url;
  }
  return null;
}

function decodeHtml(s) {
  if (!s) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = s;
  return txt.value;
}

function stripHtml(s) {
  if (!s) return '';
  return decodeHtml(s).replace(/<[^>]+>/g, '').trim();
}

// ============================================================
// GROUP BY COUNTRY
// ============================================================
function groupByCountry(posts) {
  const map = new Map();
  const unknown = [];
  for (const post of posts) {
    const country = extractCountry(post);
    if (!country) continue;
    if (!COUNTRIES[country]) {
      unknown.push(country);
      continue;
    }
    if (!map.has(country)) map.set(country, []);
    map.get(country).push({
      title: stripHtml(post.title && post.title.rendered),
      url: post.link,
      excerpt: stripHtml(post.excerpt && post.excerpt.rendered),
      image: extractImage(post),
    });
  }
  if (unknown.length) {
    console.warn('Unknown countries (add to gazetteer):', [...new Set(unknown)]);
  }

  return [...map.entries()].map(([country, articles]) => ({
    country,
    displayName: LANG === 'fr' ? COUNTRIES[country].fr : country,
    iso: COUNTRIES[country].iso,
    lon: COUNTRIES[country].lon,
    lat: COUNTRIES[country].lat,
    articles,
  })).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

// ============================================================
// RENDER MAP
// ============================================================
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
const D3_URL = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
const TOPOJSON_URL = 'https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

async function init() {
  let posts;
  try {
    posts = await fetchStories();
  } catch (err) {
    console.error(err);
    showError(T.error);
    return;
  }

  const data = groupByCountry(posts);

  if (data.length === 0) {
    showError(LANG === 'fr' ? 'Aucun récit trouvé.' : 'No stories found.');
    return;
  }

  document.getElementById('stat-countries').textContent = data.length;
  document.getElementById('stat-stories').textContent =
    data.reduce((acc, d) => acc + d.articles.length, 0);

  await Promise.all([loadScript(D3_URL), loadScript(TOPOJSON_URL)]);
  const world = await fetch(TOPO_URL).then(r => r.json());

  renderMap(data, world);
  renderChips(data);
  notifyParentResize();
}

function showError(msg) {
  const status = document.getElementById('status');
  status.textContent = msg;
  status.className = 'status error';
}

const host = document.getElementById('host');
const chips = document.getElementById('chips');

function renderChips(data) {
  chips.innerHTML = '';
  data.forEach((d, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'country-row';
    b.setAttribute('data-iso', d.iso);
    b.setAttribute('aria-label', `${d.displayName}, ${T.story_count(d.articles.length)}`);
    b.innerHTML = `
      <span class="num">${String(i + 1).padStart(2, '0')}</span>
      <span class="name">${escapeHtml(d.displayName)}</span>
      <span class="count">${T.story_count(d.articles.length)}</span>
    `;
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const m = document.querySelector(`circle.marker[data-iso="${d.iso}"]`);
      if (m) {
        m.scrollIntoView({behavior: 'smooth', block: 'center'});
        const r = m.getBoundingClientRect();
        showCardAt(d.iso, r.left + r.width/2, r.top + r.height/2);
      }
    });
    b.addEventListener('mouseenter', () => highlight(d.iso, true));
    b.addEventListener('mouseleave', () => highlight(d.iso, false));
    li.appendChild(b);
    chips.appendChild(li);
  });
}

function highlight(iso, on) {
  document.querySelectorAll(`[data-iso="${iso}"]`).forEach(el => {
    el.classList.toggle('hl', on);
  });
}

let showCardAt = () => {};

function renderMap(data, world) {
  const byIso = Object.fromEntries(data.map(d => [d.iso, d]));
  const targetIsos = new Set(data.map(d => d.iso));

  const countries = topojson.feature(world, world.objects.countries);

  const W = 720, H = 600;
  const projection = d3.geoMercator()
    .center([18, 2])
    .scale(580)
    .translate([W/2, H/2]);
  const path = d3.geoPath(projection);

  host.innerHTML = '';
  const svg = d3.select(host).append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('xmlns', 'http://www.w3.org/2000/svg');

  const card = d3.select(host).append('div').attr('class', 'card');
  const g = svg.append('g');

  // Pinned state — once a country is clicked, the card stays visible
  // until the user clicks outside it (or onto another country, which
  // re-pins). Hover still previews when nothing is pinned.
  let pinned = false;
  let hideTimer = null;

  g.selectAll('path.c')
    .data(countries.features)
    .join('path')
      .attr('class', d => targetIsos.has(d.id) ? 'country-active' : 'country-base')
      .attr('data-iso', d => d.id)
      .attr('d', path)
      .on('mouseenter', function(e, d) { if (!pinned && targetIsos.has(d.id)) showCard(d.id, e); })
      .on('mousemove', function(e, d) { if (!pinned && targetIsos.has(d.id)) positionCard(e); })
      .on('mouseleave', function() { if (!pinned) scheduleHide(); })
      .on('click', function(e, d) {
        if (targetIsos.has(d.id)) { e.stopPropagation(); openCard(d.id, e); }
      });

  const markers = g.selectAll('g.m')
    .data(data)
    .join('g')
      .attr('class', 'm')
      .attr('transform', d => `translate(${projection([d.lon, d.lat]).join(',')})`);

  markers.append('circle')
    .attr('class', d => 'marker ' + (d.articles.length > 1 ? 'multi' : 'single'))
    .attr('data-iso', d => d.iso)
    .attr('r', d => d.articles.length > 1 ? 11 : 5.5)
    .on('mouseenter', function(e, d) { if (!pinned) showCard(d.iso, e); })
    .on('mousemove', function(e, d) { if (!pinned) positionCard(e); })
    .on('mouseleave', function() { if (!pinned) scheduleHide(); })
    .on('click', function(e, d) { e.stopPropagation(); openCard(d.iso, e); });

  markers.filter(d => d.articles.length > 1)
    .append('text')
    .attr('class', 'marker-label')
    .attr('y', 3.5)
    .text(d => d.articles.length);

  // Click anywhere outside the card (and outside an active country)
  // unpins and dismisses.
  document.addEventListener('click', function(ev) {
    if (!pinned) return;
    if (ev.target.closest('.card')) return;
    if (ev.target.closest('[data-iso]')) return;
    closeCard();
  });

  function openCard(iso, ev) {
    pinned = true;
    showCard(iso, ev);
  }

  function closeCard() {
    pinned = false;
    clearTimeout(hideTimer);
    card.classed('show', false);
    document.querySelectorAll('.hl').forEach(e => e.classList.remove('hl'));
  }

  function showCard(iso, ev) {
    clearTimeout(hideTimer);
    const item = byIso[iso];
    if (!item) return;
    // Clear any previously-highlighted country before highlighting
    // the new one — otherwise a quick hop between countries leaves
    // the prior one stuck in its hover state (the scheduleHide
    // timer that would have cleared it gets cancelled above).
    document.querySelectorAll('.hl').forEach(e => {
      if (e.getAttribute('data-iso') !== iso) e.classList.remove('hl');
    });
    highlight(iso, true);
    const a = item.articles[0];
    const multi = item.articles.length > 1;
    let bodyHtml;
    if (multi) {
      const items = item.articles.map(x =>
        `<li><a href="${escapeAttr(x.url)}" target="_top">${escapeHtml(truncate(x.title, 80))}</a></li>`
      ).join('');
      bodyHtml = `
        <div class="card-eyebrow">${escapeHtml(item.displayName)}</div>
        <div class="card-multi">
          <div class="card-multi-label">${T.stories_from(item.articles.length)}</div>
          <ol>${items}</ol>
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="card-eyebrow">${escapeHtml(item.displayName)}</div>
        <h3 class="card-title">${escapeHtml(a.title)}</h3>
        <p class="card-excerpt">${escapeHtml(a.excerpt || '')}</p>
        <a class="card-link" href="${escapeAttr(a.url)}" target="_top">
          ${T.readMore} <span class="arrow" aria-hidden="true">→</span>
        </a>
      `;
    }
    const imageHtml = (!multi && a.image)
      ? `<div class="card-image" style="background-image:url('${escapeAttr(a.image)}')"></div>`
      : '';
    card.html(`
      ${imageHtml}
      <div class="card-body">${bodyHtml}</div>
    `);
    card.classed('show', true);
    card.on('mouseenter', () => clearTimeout(hideTimer));
    card.on('mouseleave', () => { if (!pinned) scheduleHide(); });
    positionCard(ev);
  }

  showCardAt = (iso, clientX, clientY) => { pinned = true; showCard(iso, { clientX, clientY }); };

  function positionCard(ev) {
    const hostRect = host.getBoundingClientRect();
    const cardEl = card.node();
    const cw = cardEl.offsetWidth || 280;
    const ch = cardEl.offsetHeight || 280;
    let x = ev.clientX - hostRect.left + 14;
    let y = ev.clientY - hostRect.top + 14;
    if (x + cw > hostRect.width - 8) x = ev.clientX - hostRect.left - cw - 14;
    if (y + ch > hostRect.height - 8) y = Math.max(8, hostRect.height - ch - 8);
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    card.style('left', x + 'px').style('top', y + 'px');
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      card.classed('show', false);
      document.querySelectorAll('.hl').forEach(e => e.classList.remove('hl'));
    }, 250);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

// Navigate the top window. We synthesise an <a target="_top"> click so
// the browser uses its native top-frame navigation path — this is the
// only approach that works reliably when the map is embedded as a
// cross-origin iframe (where `window.top.location.assign(url)` throws
// and `window.open(url, '_top')` may open a popup window named "_top").
function openStory(url) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_top';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ============================================================
// IFRAME RESIZE — let the parent page size the iframe to content
// ============================================================
function notifyParentResize() {
  if (window.parent === window) return;
  const send = () => {
    const h = Math.ceil(document.documentElement.scrollHeight);
    window.parent.postMessage({ type: 'wyde-map:resize', height: h }, '*');
  };
  send();
  window.addEventListener('resize', send);
  if (window.ResizeObserver) {
    new ResizeObserver(send).observe(document.body);
  }
}

init();
