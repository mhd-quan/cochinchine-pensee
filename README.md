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
│   │   ├── nav/             # Header, Footer
│   │   └── seo/             # MetaTags
│   ├── layouts/             # BaseLayout, EssayLayout
│   ├── pages/               # routes
│   │   ├── index.astro      # homepage
│   │   ├── essays/
│   │   │   ├── index.astro  # archive
│   │   │   └── [...slug].astro  # essay view
│   │   ├── about.astro
│   │   ├── subscribe.astro  # deferred feature slot
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

1. Create `src/content/essays/YYYY-MM-DD-slug.mdx`
2. Fill frontmatter (see `src/content.config.ts` for valid schema)
3. Write content in markdown/MDX
4. The page appears automatically at `/essays/<slug>/`

Every essay must declare one primary topic and may declare one secondary topic.
The controlled vocabulary is: `Chính trị`, `Kinh tế`, `Căn tính`, `Xã hội`,
`Tư tưởng`, and `Hiện đại`. Language belongs in `lang`, while editorial
sequences belong in the separate series collection.

## Cloudflare Workers deployment

Cloudflare Workers Builds should use:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Output directory:** `dist`

`wrangler.toml` exposes `dist/` as Worker static assets, serves the generated
`404.html` for missing routes, and keeps URLs aligned with Astro's
`trailingSlash: 'never'` setting.

## Deferred feature slots

- **Comments:** frontmatter `commentsEnabled: false` + route `/comments/[slug]` ready to wire to Giscus. Flip the boolean when ready.
- **Newsletter:** `/subscribe` page is a placeholder. Replace form action with Buttondown embed when ready.
- **OG images:** route `/og/[slug].png` reserved. Implement with Satori + resvg-js when needed.

## Design tokens

All colors, fonts, and spacing live in `src/styles/tokens.css`. No magic numbers elsewhere.

## License

Essays: © their respective authors. All rights reserved.
Code: no open-source license is currently included.
