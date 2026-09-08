import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';
import { authorSlug } from '../src/lib/authorArchive.mjs';

const root = new URL('../', import.meta.url);
const dist = new URL('../dist/', import.meta.url);

function publishedEssays() {
  return readdirSync(new URL('src/content/essays/', root))
    .filter((filename) => filename.endsWith('.mdx'))
    .map((filename) => {
      const source = readFileSync(new URL(`src/content/essays/${filename}`, root), 'utf8');
      const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      assert.ok(frontmatter, filename);
      return {
        id: filename.replace(/\.mdx$/, ''),
        data: parseYaml(frontmatter[1]),
      };
    })
    .filter(({ data }) => !data.draft && !data.comingSoon);
}

test('author overview and static archives link only to published work by that author', () => {
  const essays = publishedEssays();
  const authors = [...new Set(essays.map(({ data }) => data.author))];
  const overview = readFileSync(new URL('authors/index.html', dist), 'utf8');

  for (const author of authors) {
    const slug = authorSlug(author);
    const route = `/authors/${slug}`;
    assert.match(overview, new RegExp(`href="${route}"`), author);
    const archive = readFileSync(new URL(`authors/${slug}/index.html`, dist), 'utf8');
    assert.match(archive, new RegExp(`<h1\\b[^>]*>${author.replaceAll('.', '\\.')}</h1>`));
    assert.match(
      archive,
      new RegExp(`rel="canonical" href="https://cochinchinepensees\\.studio${route}"`),
    );

    const own = essays.filter(({ data }) => data.author === author);
    const others = essays.filter(({ data }) => data.author !== author);
    for (const essay of own)
      assert.match(archive, new RegExp(`href="/essays/${essay.id}"`), essay.id);
    for (const essay of others)
      assert.doesNotMatch(archive, new RegExp(`href="/essays/${essay.id}"`), essay.id);
  }
});
