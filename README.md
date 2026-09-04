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
npm run lint         # biome check .
npm run format       # biome format --write .
```

## Architecture

- **Output:** pure static (SSG) — no SSR
- **Deploy target:** Cloudflare Workers Static Assets via direct Git integration
- **Analytics:** Google Analytics 4, loaded once through the shared production layout
- **Content:** MDX files in `src/content/essays/`, validated by Zod schema in `src/content.config.ts`
- **Styling:** Vanilla CSS via `@import tokens.css; reset.css; prose.css;` in `globals.css`
- **Fonts:** Self-hosted via `@fontsource/*` (no Google CDN)
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
│   │   ├── newsletter/      # Substack signup embed
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
creates WebP variants at 240, 400, 640, 800, 1200 and 1600px,
without enlarging smaller originals or changing their aspect ratio. Images use
`srcset`, layout-specific `sizes`, and intrinsic dimensions.

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

The Substack signup form is embedded in the shared footer and on `/subscribe`.
The masthead banner links directly to the publication's Substack subscribe page.
The footer embed loads lazily; `/subscribe` loads it immediately and omits the
duplicate footer form. Both locations include a direct Substack link. The banner
is a plain link beneath the wordmark and adds no JavaScript. The iframe reserves
extra height on small phones so the publication name and legal copy can wrap.
Publication URLs are configured in `src/lib/newsletter.ts`.

## Deferred feature slots

- **Comments:** frontmatter `commentsEnabled: false` + route `/comments/[slug]` ready to wire to Giscus. Flip the boolean when ready.
- **OG images:** route `/og/[slug].png` reserved. Implement with Satori + resvg-js when needed.

## Design tokens

All colors, fonts, and spacing live in `src/styles/tokens.css`. No magic numbers elsewhere.

## License

Essays: © their respective authors. All rights reserved.
Code: no open-source license is currently included.
