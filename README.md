# WYDE Accountability Hubs — Interactive Map

Live map for the WYDE Stories of Impact, built to be embedded as an iframe
into [kofiannanfoundation.org/wyde](https://www.kofiannanfoundation.org/wyde/)
and [kofiannanfoundation.org/wyde-fr](https://www.kofiannanfoundation.org/wyde-fr/).

Stories are fetched live from the WordPress REST API — publish a new story,
tag it with the WYDE microsite and a country, and it appears on the map within
the next page load. No code changes needed.

## Quick start (host on GitHub Pages)

1. Create a new public GitHub repo (e.g. `wyde-map`).
2. Upload `index.html` to the repo root.
3. In the repo settings → **Pages** → set source to `main` branch, root.
4. Wait ~1 minute. Your map is now at `https://YOUR-USERNAME.github.io/wyde-map/`.
5. Configure the API connection (one-time, see below).
6. Embed in WordPress (see below).

## Configuration (one-time, takes ~5 minutes)

Open `index.html` and find the `CONFIG` block near the top of the `<script>`.
You'll need to fill in the `micrositeTermId` for both languages. Here's how:

### Step 1 — confirm taxonomy slugs

Visit this URL in your browser:

```
https://www.kofiannanfoundation.org/wp-json/wp/v2/taxonomies
```

You'll see a JSON list of all taxonomies. Look for two entries:

- The **microsite** taxonomy. The key (e.g. `microsite`) goes into
  `CONFIG.micrositeTaxonomy`.
- The **country** taxonomy. The key (likely `country`) goes into
  `CONFIG.countryTaxonomy`.

The defaults in `CONFIG` are guesses based on the public URLs — they're
probably right, but verify.

### Step 2 — find the WYDE microsite term IDs

Visit:

```
https://www.kofiannanfoundation.org/wp-json/wp/v2/microsite?slug=wyde
```

(replacing `microsite` with whatever you found in step 1, if different).

You'll get back something like:

```json
[{ "id": 123, "name": "WYDE", "slug": "wyde", ... }]
```

Take the `id` value (e.g. `123`) and put it in `CONFIG.micrositeTermId.en`.

If there's a separate French term (e.g. slug `wyde-fr`), repeat with that
slug and put the resulting ID in `CONFIG.micrositeTermId.fr`. If French
posts share the same WYDE term as English, just use the same ID for both.

> **If FR/EN can't be filtered separately by microsite term**, you'll need
> a different filter — most likely Polylang or WPML language filtering. Look
> for a `lang` query parameter on the API. Open an issue and we can wire that
> up.

### Step 3 — test

Open `https://YOUR-USERNAME.github.io/wyde-map/?lang=en` and check the
browser console (F12). You should see no errors and a map with countries.

If you see `Unknown countries: [...]` warnings, add those entries to the
`COUNTRIES` gazetteer at the top of the script — one line per country, with
ISO code and lon/lat centroid.

## Embedding in WordPress

Add this to the `/wyde/` page (English version) using a Custom HTML block:

```html
<iframe
  src="https://YOUR-USERNAME.github.io/wyde-map/?lang=en"
  style="width:100%; border:0; min-height:700px;"
  title="WYDE Stories of Impact map"
  loading="lazy"
  id="wyde-map-iframe"></iframe>
<script>
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'wyde-map:resize') {
    var f = document.getElementById('wyde-map-iframe');
    if (f) f.style.height = (e.data.height + 8) + 'px';
  }
});
</script>
```

For the French version (`/wyde-fr/`) use the same snippet but with `?lang=fr`
in the iframe `src`.

The small `<script>` after the iframe is what makes the iframe auto-resize
to fit its content. Without it, the iframe will be a fixed 700px tall and
might cut off content or have empty space at the bottom.

## Adding new countries

When the WYDE site publishes a story for a new country, two things may need
to happen:

1. **Most countries are already listed** in the `COUNTRIES` gazetteer in
   `index.html`. If the country name in the WP `country` taxonomy matches
   exactly (e.g. `Cameroon`), it just works.

2. **For genuinely new countries**, add a single line to the `COUNTRIES`
   object:

   ```js
   'CountryName': { iso: '000', lon: 0.0, lat: 0.0, fr: 'NomFrançais' },
   ```

   - `iso`: 3-digit numeric ISO 3166-1 code (lookup at
     <https://en.wikipedia.org/wiki/ISO_3166-1_numeric>) — must match the
     `id` field used in the world-atlas TopoJSON.
   - `lon`/`lat`: country centroid in decimal degrees.
   - `fr`: French name as it should appear to users.

   Commit, push to GitHub, and the change is live within a minute.

## Adding new languages

The map is structured around two languages out of the box. To add a third
(e.g. Portuguese for Mozambique etc.):

1. Add a `pt` key to `CONFIG.labels` with translated strings.
2. Add a `pt` key to `CONFIG.micrositeTermId` if there's a separate term.
3. Optionally add `pt: 'PortugueseName'` to each entry in `COUNTRIES`.
4. Use `?lang=pt` in the iframe URL.

## How the map looks up countries

For each post returned by the API, the code walks the embedded
`wp:term` arrays and finds the term whose taxonomy matches
`CONFIG.countryTaxonomy`. It then looks up that term name in the
`COUNTRIES` gazetteer.

If the WP country term is in French (e.g. `Tchad`), the code falls back to
a French-to-English lookup so the same gazetteer works for both languages —
you only need to define each country once.

## Files

- `index.html` — the entire map (single file, no build step).
- `README.md` — this file.

That's it. No npm, no build, no framework. Just edit and push.

## Dependencies (loaded at runtime from CDN)

- [D3 v7](https://d3js.org/)
- [topojson-client v3](https://github.com/topojson/topojson-client)
- [world-atlas v2](https://github.com/topojson/world-atlas) (countries-50m)

All three load from `cdn.jsdelivr.net`. Total payload: ~350 KB gzipped.

## Troubleshooting

**Map shows "Could not load stories"** — Open the browser console. The most
likely cause is a CORS error or wrong taxonomy slug. The WP REST API allows
CORS by default, but some security plugins block it. If blocked, you'll need
to either whitelist the GitHub Pages origin server-side, or fall back to a
static JSON file in the repo.

**Stories load but no countries highlight** — The `country` taxonomy slug in
`CONFIG.countryTaxonomy` doesn't match what the API uses. Check
`/wp-json/wp/v2/taxonomies` again.

**Some countries are missing from the map** — Check the browser console for
`Unknown countries:` warnings. Add them to the `COUNTRIES` gazetteer.

**Hover card image doesn't load** — The post has no featured image set in
WordPress, or the image URL is broken. The card hides the image element
gracefully (`onerror="this.style.display='none'"`).

**FR map shows English country names** — The FR posts are tagged with
English country terms. Either (a) the WP site uses one set of country terms
across both languages (current behaviour: the map translates them via the
gazetteer), or (b) FR posts use FR country terms (also handled). No action
needed in either case.
