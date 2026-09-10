import { fileURLToPath } from 'node:url';
import { validateEditorialSeo } from './seo-review.mjs';

export default function publicationIntegrity() {
  return {
    name: 'tcp-publication-integrity',
    hooks: {
      'astro:build:start': async () => { await validateEditorialSeo(); },
      'astro:build:done': async ({ dir, logger }) => {
        // Build-only imports: neither the renderer nor PDF dependencies reach readers.
        const { generateReaderPdfs } = await import('./reader-pdf.mjs');
        const report = await generateReaderPdfs(fileURLToPath(dir));
        logger.info(`Reader PDF: ${report.length} image-only downloads generated.`);
      },
    },
  };
}
