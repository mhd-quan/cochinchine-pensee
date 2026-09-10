import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createIndex, close } from 'pagefind';

export default function searchIndex() {
  return {
    name: 'tcp-search-index',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const path = fileURLToPath(dir);
        // Keep Vietnamese and English essays in the same searchable collection.
        const { index, errors } = await createIndex({ forceLanguage: 'vi' });
        try {
          if (errors.length || !index)
            throw new Error(errors.join('\n') || 'Cannot create search index');
          const result = await index.addDirectory({ path });
          if (result.errors.length) throw new Error(result.errors.join('\n'));
          if (!result.page_count) throw new Error('Search index contains no published articles');
          const written = await index.writeFiles({ outputPath: `${path}/pagefind` });
          if (written.errors.length) throw new Error(written.errors.join('\n'));
          const entry = JSON.parse(await readFile(`${path}/pagefind/pagefind-entry.json`, 'utf8'));
          const count = Object.values(entry.languages).reduce(
            (total, language) => total + language.page_count,
            0,
          );
          logger.info(`Search: ${count} published articles indexed; loaded only on demand.`);
        } finally {
          await close();
        }
      },
    },
  };
}
