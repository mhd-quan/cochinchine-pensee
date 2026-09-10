# The Cochinchine Pensées — Site

Vietnamese editorial publication in the Claremont Review of Books tradition.
Built with **Astro 7** + Cloudflare Workers (Static Assets) + MDX + Tailwind-free CSS.

## Quick start

```bash
npm ci
npm run dev          # http://localhost:4321
npm run build        # static output to ./dist
npm run preview      # preview built site
npm run check        # astro check (type-check)
npm test             # image delivery, reader lifecycle, SEO and search (run build first)
npm run lint         # biome check .
npm run format       # biome format --write .
npm run verify       # fresh build, Astro check, lint, then all tests
```

After switching release branches, run `npm ci` and `npm run verify`: ignored
`node_modules`, `.astro` and `dist` can still belong to the previous checkout.
Do not treat tests against an old `dist` directory as release validation.

For browser regression checks, start `npm run preview`, then run
`npm run test:browser` with Playwright available (or set `PERF_PLAYWRIGHT_MODULE`
to its module path). `CHROME_PATH` can select an installed Chromium executable;
the default is Google Chrome on macOS. The checks use a local preview only and
block third-party traffic. They cover mobile/desktop controls, Astro back
navigation, and discovery failure/retry/date rollover.

## Architecture

- **Output:** pure static (SSG) — no SSR
- **Deploy target:** Cloudflare Workers Static Assets via direct Git integration
- **Analytics:** Google Analytics 4, loaded once through the shared production layout
- **Content:** MDX files in `src/content/essays/`, validated by Zod schema in `src/content.config.ts`
- **Styling:** Vanilla CSS; shared tokens/reset in `globals.css`, prose loaded with `EssayLayout`
- **Fonts:** Self-hosted `@fontsource/*`, subset at build time (no Google CDN)
- **No frameworks:** zero React / Vue. View Customizer is vanilla TS in `<script>` block.

## Project layout

```
.
├── public/                  # static assets, favicon.png, robots.txt
├── src/
│   ├── content/             # MDX essays (one file per date-slug)
│   ├── content.config.ts    # Content Collections + Zod schema
│   ├── components/
│   │   ├── essay/           # DropCap, ViewCustomizer, ShareLinks, EssayCard
│   │   ├── nav/             # Header, Footer
│   │   └── seo/             # MetaTags
│   ├── layouts/             # BaseLayout, EssayLayout
│   ├── pages/               # routes
│   │   ├── index.astro      # homepage
│   │   ├── essays/
│   │   │   ├── index.astro  # archive
│   │   │   └── [...slug].astro  # essay view
│   │   ├── about.astro
│   │   ├── subscribe.astro  # Substack newsletter signup
│   │   ├── 404.astro
│   │   ├── rss.xml.ts
│   │   ├── feed.json.ts
│   │   └── robots.txt.ts
│   └── styles/              # tokens.css, reset.css, prose.css, globals.css
├── astro.config.mjs
├── biome.json
└── package.json
```

## Adding an essay

### Responsive cover images

`npm run build` and `npm run dev` prepare responsive covers automatically. The
pipeline reads published essay cover fields (`coverImage` or `cover_image`),
Markdown body images (including reference-style images), and book records. It
creates AVIF and WebP variants at 160, 240, 320, 400, 480, 640, 672, 800, 1200 and 1600px,
without enlarging smaller originals or changing their aspect ratio. Images use
`picture`, `srcset`, layout-specific `sizes`, and intrinsic dimensions. AVIF is
preferred where supported, with WebP fallback. Contained portraits advertise
their painted width rather than the surrounding 16:9 frame; book sizes follow
the shelf height and each jacket's aspect ratio. Device pixel ratio is left to
the browser. Both formats are encoded from original source bytes, never from
an already-compressed variant. A first build can take several minutes; cached
variants are reused on subsequent builds.

Original `/images/` URLs remain available for sharing and social metadata.
Remote HTTPS covers are downloaded during preparation and served locally as
optimized variants. Their source bytes are cached in `.cache/image-sources/`;
generated files in `public/images/responsive/` and the manifest in `.astro/`
are not committed. Variant URLs include a content/encoder hash, so replacing an
original produces new URLs. A failed download or decode stops the build instead
of publishing broken image references.
Cloudflare serves these fingerprinted variants with a one-year immutable browser
cache policy through `public/_headers`.

Run `npm run images` to prepare images separately, or `npm run images -- --refresh`
to refresh remote sources when an image changes at the same URL. Restart the dev
server after adding or replacing a cover. Existing sketches, transparency,
paper blending and book aspect ratios are preserved.

The first recent-essay cover on the homepage and each article hero load eagerly
with high fetch priority. Remaining covers and body images are lazy-loaded. No client-side image
processing or additional JavaScript is required.

### Font and loading preparation

The build subsets Source Serif 4, EB Garamond, Be Vietnam Pro, Playfair Display SC
and Bricolage Grotesque files with HarfBuzz through `subset-font`. It retains OpenType shaping features,
the characters found throughout `src/`, common Latin, Vietnamese, combining
marks and punctuation. NFC/NFD and case variants are included. Font family,
weights, styles and `font-display: swap` remain the same. Generated WOFF2/CSS
and a size inventory live in `.astro/`; no system Python installation is needed.
Restart development after adding content with new characters; every production
build collects the current content again.

The font build reads each font's actual character map and emits disjoint Unicode
ranges, assigning Vietnamese before Latin Extended. A Vietnamese title therefore
does not request a large Latin Extended file for characters such as Đ, ư and ỵ.
Critical wordmark and heading fonts are preloaded using the same hashed URLs as
the CSS; Vietnamese heading preloads are limited to relevant pages. Font parsing
libraries run only at build time. Tests verify preserved character coverage,
non-overlapping ranges, and preload/CSS URL agreement.

Styles are inlined with each page to remove the cold-load blocking stylesheet
request; compressed shared styles add about 7 KB to a page. Font files remain
external and cacheable. Hashed `/_astro/` assets have a one-year immutable cache
policy; HTML continues to revalidate. Links prefetch on hover/focus/touch rather
than simply entering the viewport. The home book shelf measures its controls
when near the viewport and batches scroll/resize updates in animation frames.

### Publishing content

1. Create `src/content/essays/YYYY-MM-DD-slug.mdx`
2. Fill frontmatter (see `src/content.config.ts` for valid schema)
3. Write content in markdown/MDX
4. The page appears automatically at `/essays/<slug>/`

Every essay must declare one primary topic and may declare one secondary topic.
The controlled vocabulary is: `Chính trị`, `Kinh tế`, `Căn tính`, `Xã hội`,
`Tư tưởng`, and `Hiện đại`. Language belongs in `lang`, while editorial
sequences belong in the separate series collection.

The optional `form` field controls the editorial lead above those topics:
`essay` (the default) renders “Luận về”, while `pensee` renders “Pensée về”
for shorter pieces whose thesis is deliberately less formal.

## Cloudflare Workers deployment

Cloudflare Workers Builds should use:

- **Build command:** `npm run build`
- **Production branch:** `main` (select in Cloudflare Workers Builds settings)
- **Deploy command:** `npx wrangler deploy`
- **Output directory:** `dist`

`wrangler.toml` exposes `dist/` as Worker static assets, serves the generated
`404.html` for missing routes, and keeps URLs aligned with Astro's
`trailingSlash: 'never'` setting.

## Newsletter

The shared footer, `/subscribe`, and the masthead banner link directly to the
publication's Substack subscribe page. Newsletter copy and links use the site's
own typography on both desktop and mobile. No Substack form or iframe is loaded.
The footer keeps the same navigation and direct newsletter link on every page.
Publication URLs are configured in `src/lib/newsletter.ts`.

## Footer and directory

The footer uses eight peer navigation links beside a direct Substack signup
link, followed by an editorial disclaimer and publication identity. Desktop
columns stack on mobile; no Substack iframe or social widget is loaded.

`/archives` indexes published writing by month, `/pensees` follows the existing
`form: pensee` metadata, and `/authors` groups published work by its byline.
`/authors/m-q-doan` and `/authors/adler` are permanent, server-rendered author
archives; `/masthead` holds the confirmed editorial roles. About has a short introduction
and reader note; its existing noindex setting remains until the full profile
is ready. The existing `/essays` catalogue and all article URLs are retained.

## Site search and series

Desktop search slides horizontally within the masthead/banner footprint or
compact reading bar. Mobile search sits at the top of the attached hamburger
menu; the logo and close toggle remain in the masthead. These lightweight native
forms submit to `/search?q=...` for shareable, progressively loaded results.
Opening the header search never loads the search engine or adds page height. The build indexes only published essay bodies with Pagefind; navigation
and reader controls are excluded. The index, worker and WASM load only after a
nonempty query. Use `npm run build` followed by `npm run preview` to exercise the
search index locally; `npm run dev` alone does not generate it.

Search supports Vietnamese with and without accents, including đ/d, and English.
Titles receive additional ranking weight. Unquoted queries require each complete
word; quotation marks preserve exact phrase search. Results are rendered with
text nodes and a restricted highlight element. New builds regenerate the index;
its entry points revalidate on deploy. No service, API key or client framework is
required.

The homepage presents all featured series in one native scroll-snap track.
Readers can swipe, use previous/next buttons, select a series or use arrow/Home/End
keys when the track is focused. The selected panel remains aligned on resize;
non-visible panels leave keyboard navigation. Reduced-motion settings disable
smooth scrolling. Without JavaScript, the horizontal content and links remain
available.

Between recent essays and the book shelf, the homepage presents one full quotation
from the published archive alongside its matching responsive cover, title and
reader link. Two source-verified excerpts are curated for each of 57 eligible essays;
the earliest Minh Tuệ essay remains published in the archives but is intentionally
excluded from this quotation rotation.
Every visitor sees the same selection for each calendar day in Vietnam. The next
eligible article appears on the next day, and its second excerpt appears on the next
pass through the archive. Reloads, tabs and browser history keep the day's selection;
an open page checks for a changed date when it regains focus or visibility, without
timed cycling. The adjacent author folio links to each static author archive and
their latest essay. The selected image alone enters the live DOM. Because the site
is statically generated, visitors without JavaScript see the selection for the build
date until the next deployment.

## Reader preferences and search identity

Reader theme, typeface, size and measure are restored only on `EssayLayout`
pages. Other routes always render in Paper without overwriting the saved reader
preferences. The early initializer also applies the destination's preferences
before Astro swaps the document and when the browser restores a page.

Reader options include Garamond, New York and **San Serif** (Bricolage Grotesque),
with Paper, Sepia, Sage and Night surfaces. Existing saved Source Serif selections
migrate to Garamond. Bricolage loads only after a reader chooses it, and no Apple
font files are distributed. On phones below 768px, Text width
is hidden and prose uses the available width with the usual page gutters.

The homepage wordmark is its H1. Homepage JSON-LD identifies the publication,
website and canonical homepage, with the Substack publication as a related
identity. Navigation pages use website Open Graph metadata; essays use article
metadata. Paginated archives retain self-canonicals and crawlable links to the
first archive page. The unfinished About page is `noindex, follow` and excluded
from the sitemap; remove that restriction and the sitemap exclusion together
when its content is ready. Shared header, menu and footer copy use
`data-nosnippet` so search descriptions can focus on page content. The technical
colophon has been removed. Archive, series, books and subscription descriptions
describe their actual content; article descriptions prefer an editorial excerpt
or dek, then the title, subtitle and author. Supply an `excerpt` in frontmatter
to give an article a deliberately written search summary.

After deploying SEO changes, use Search Console URL Inspection for the homepage
and request indexing, then submit or recheck `sitemap-index.xml`. Google chooses
result ordering; these signals do not guarantee a ranking or an indexing date.
Google can also select a query-specific snippet instead of the meta description.

## Deferred feature slots

- **Comments:** frontmatter `commentsEnabled: false` + route `/comments/[slug]` ready to wire to Giscus. Flip the boolean when ready.
- **OG images:** route `/og/[slug].png` reserved. Implement with Satori + resvg-js when needed.

## Design tokens

All colors, fonts, and spacing live in `src/styles/tokens.css`. No magic numbers elsewhere.

## License

Essays: © their respective authors. All rights reserved.
Code: no open-source license is currently included.

## Publication metadata and reader downloads

From v0.7.6, every published essay requires an editorial metadata review. Run
`npm run seo:review` after editing or adding an article, then follow
[the SEO publication workflow](docs/seo.md). This affects search metadata, not
visible essay text. `npm run build` also generates image-only reader PDFs;
[PDF maintenance and sharing notes](docs/reader-pdf.md) explain fonts, cache and
verification. Build with Node >=22.13 (Node 24 recommended), including development
dependencies required by the static export pipeline.
