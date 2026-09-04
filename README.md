# The Cochinchine Pensées — Site

Vietnamese editorial publication in the Claremont Review of Books tradition.
Built with **Astro 7** + Cloudflare Workers (Static Assets) + MDX + Tailwind-free CSS.

## Quick start

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # static output to ./dist
npm run preview      # preview built site
npm run check        # astro check (type-check)
npm test             # image delivery, reader lifecycle and SEO (run build first)
npm run lint         # biome check .
npm run format       # biome format --write .
```

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
creates AVIF and WebP variants at 160, 240, 320, 400, 480, 640, 800, 1200 and 1600px,
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

The build subsets the existing Source Serif 4, EB Garamond and Be Vietnam Pro
files with HarfBuzz through `subset-font`. It retains OpenType shaping features,
the characters found throughout `src/`, common Latin, Vietnamese, combining
marks and punctuation. NFC/NFD and case variants are included. Font family,
weights, styles and `font-display: swap` remain the same. Generated WOFF2/CSS
and a size inventory live in `.astro/`; no system Python installation is needed.
Restart development after adding content with new characters; every production
build collects the current content again.

Small route styles are inlined while the shared stylesheet and fonts stay
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
`/masthead` holds the confirmed editorial roles. About has a short introduction
and reader note; its existing noindex setting remains until the full profile
is ready. The existing `/essays` catalogue and all article URLs are retained.

## Reader preferences and search identity

Reader theme, typeface, size and measure are restored only on `EssayLayout`
pages. Other routes always render in Paper without overwriting the saved reader
preferences. The early initializer also applies the destination's preferences
before Astro swaps the document and when the browser restores a page.

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
