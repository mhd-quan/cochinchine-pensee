// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// The Cochinchine Pensée — Astro 7 config
// Output: pure static. Deploy target: Cloudflare Workers (Static Assets).
// No SSR adapter needed — Cloudflare's direct Git integration handles the dist/ push.
// View Transitions enabled for page-to-page fade (out of the box in Astro 7).

export default defineConfig({
  site: 'https://cochinchinepensees.studio',
  output: 'static',
  trailingSlash: 'never',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/draft/'),
    }),
  ],
  build: {
    format: 'directory',
  },
  vite: {
    build: {
      cssMinify: 'lightningcss',
    },
  },
});
