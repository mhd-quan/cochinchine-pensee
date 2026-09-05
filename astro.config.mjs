// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import fetchCovers from './scripts/fetch-covers.mjs';
import responsiveImages from './scripts/responsive-images.mjs';
import publicationFonts from './scripts/subset-fonts.mjs';
import searchIndex from './scripts/search-index.mjs';

// The Cochinchine Pensées — Astro 7 config
// Output: pure static. Deploy target: Cloudflare Workers (Static Assets).
// No SSR adapter needed — Cloudflare's direct Git integration handles the dist/ push.
// View Transitions enabled for page-to-page fade (out of the box in Astro 7).

export default defineConfig({
  site: 'https://cochinchinepensees.studio',
  output: 'static',
  trailingSlash: 'never',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  integrations: [
    fetchCovers(), // TEMP: one-shot cover download — remove once covers are committed
    responsiveImages(),
    publicationFonts(),
    searchIndex(),
    mdx(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/$/, '');
        return (
          !path.startsWith('/draft/') && !['/draft', '/about', '/search', '/404', '/404.html'].includes(path)
        );
      },
    }),
  ],
  build: {
    format: 'directory',
    // Avoid a blocking stylesheet round trip on a cold mobile visit.
    // The shared styles compress to ~7 KB; fonts remain independently cacheable.
    inlineStylesheets: 'always',
  },
  vite: {
    build: {
      cssMinify: 'lightningcss',
      // Fonts stay external even though critical styles ship with the HTML.
      assetsInlineLimit: (filePath) => {
        if (/\.woff2?$/.test(filePath)) return false;
        // Preserve Vite/Astro's default behavior for small scripts and icons.
        return undefined;
      },
    },
  },
});
