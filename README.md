# WYDE Accountability Hubs — Interactive Map

Live map of the WYDE Stories of Impact, designed to be embedded as an
iframe on [kofiannanfoundation.org/wyde](https://www.kofiannanfoundation.org/wyde/)
(English) and the French equivalent.

Stories are fetched live from the Kofi Annan Foundation WordPress REST API.
Publish a story, assign it the `single-microsite-wyde` (or `-fr`) page
template plus a country term, and it appears in the map on the next page
load. No code changes required.

## Live URLs

- **English:** <https://neverything.github.io/kaf-wyde-map/>
- **French:**  <https://neverything.github.io/kaf-wyde-map/index_fr.html>
- **Repo:**    <https://github.com/neverything/kaf-wyde-map>

## Embedding

Drop this into a Custom HTML block on the WordPress page. The iframe
auto-resizes to its content via `postMessage` — the small `<script>` after
the iframe is what does the resize handshake.

### English (`/wyde/`)

```html
<iframe id="wyde-map"
        src="https://neverything.github.io/kaf-wyde-map/"
        title="WYDE Accountability Hubs map"
        style="width:100%;border:0;display:block;min-height:600px"
        loading="lazy"
        scrolling="no"></iframe>
<script>
(function () {
  var f = document.getElementById('wyde-map');
  window.addEventListener('message', function (ev) {
    if (ev.origin !== 'https://neverything.github.io') return;
    if (!ev.data || ev.data.type !== 'wyde-map:resize') return;
    f.style.height = ev.data.height + 'px';
  });
})();
</script>
```

### French (`/wyde-fr/` or equivalent)

Same snippet, but change the iframe `src` to:

```
https://neverything.github.io/kaf-wyde-map/index_fr.html
```

You can also keep the `id="wyde-map"` — the listener works for both.

### Notes

- The `ev.origin` check protects the parent page from any other site
  posting messages with a matching shape.
- `scrolling="no"` keeps a stray scrollbar from flashing while the iframe
  measures itself.
- "Read story" links break out of the iframe via `target="_top"`. If you
  ever add a `sandbox` attribute to the iframe, include
  `allow-top-navigation-by-user-activation` so navigation still works.
- Pushing to `main` redeploys via GitHub Pages within ~30 seconds.

## How posts are filtered

Posts are filtered by their assigned WordPress page template:

| Language | Template slug                |
| -------- | ---------------------------- |
| English  | `single-microsite-wyde`      |
| French   | `single-microsite-wyde-fr`   |

The map fetches posts in the WYDE microsite term (configured in `map.js`
as `micrositeTermId: 1436`) and then filters client-side by
`post.template`. Cached in `localStorage` for 10 minutes per language.

## Adding a new country

Stories appear on the map automatically as long as the country is in the
gazetteer. To add a new country, add one line to `COUNTRIES` in `map.js`:

```js
'CountryName': { iso: '000', lon: 0.0, lat: 0.0, fr: 'NomFrançais' },
```

- `iso` — 3-digit ISO 3166-1 numeric code (matches the world-atlas TopoJSON
  feature `id`). Lookup: <https://en.wikipedia.org/wiki/ISO_3166-1_numeric>.
- `lon` / `lat` — country centroid in decimal degrees, used to place the
  marker.
- `fr` — French country name as it appears in the FR `country` taxonomy.

Commit, push, the change is live in ~30 seconds.

If the browser console logs `Unknown countries: [...]`, that's the cue
that a country term in the API doesn't have a gazetteer entry.

## Adding a new language

To add a third locale (e.g. Portuguese):

1. Duplicate `index.html` → `index_pt.html`. Update `<html lang>`, the
   visible labels, and `window.PAGE_DEFAULTS` to
   `{ lang: 'pt', template: 'single-microsite-wyde-pt' }` (or whatever
   template slug WP uses).
2. In `map.js`, add a `pt` block to `CONFIG.labels` with the translated
   UI strings.
3. Optionally add `pt: 'PortugueseName'` to each entry in `COUNTRIES` and
   extend the lookup if the FR-only fallback isn't enough.

## Local development

It's a pure static site — no build step.

```bash
python3 -m http.server 8765
# open http://localhost:8765/index.html
```

## Files

| File              | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| `index.html`      | English shell — markup + `PAGE_DEFAULTS`           |
| `index_fr.html`   | French shell — markup + `PAGE_DEFAULTS`            |
| `map.js`          | Shared map logic, fetch, render, country gazetteer |
| `styles.css`      | Shared styles                                      |

## Runtime dependencies (loaded from CDN)

- [D3 v7](https://d3js.org/)
- [topojson-client v3](https://github.com/topojson/topojson-client)
- [world-atlas v2](https://github.com/topojson/world-atlas) — `countries-50m.json`

All three from `cdn.jsdelivr.net`, ~350 KB gzipped total.

## Troubleshooting

**"Could not load stories."** Browser console will show the cause. Most
likely a CORS error from a security plugin on the WP side, or the
`microsite` term ID has changed.

**Map renders but no countries highlight.** Check the console for
`Unknown countries: [...]`. Add them to `COUNTRIES`.

**Wrong number of stories.** Each post must have its template set to
exactly `single-microsite-wyde` (EN) or `single-microsite-wyde-fr` (FR).
Cross-tagged posts (FR title with EN template, etc.) will show up in the
wrong language.

**Hover card image doesn't load.** The post has no featured image, or its
URL is broken. The card hides the `<img>` gracefully via
`onerror="this.style.display='none'"`.

**Click on "Read story" does nothing or opens inside the iframe.** The
parent embed has a `sandbox` attribute without `allow-top-navigation` (or
its user-activation variant). Add it, or remove the sandbox.
