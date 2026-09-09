import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { sourceHash } from '../src/lib/seo/publication.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function validateEditorialSeo({ reportOnly = false } = {}) {
  const profiles = JSON.parse(await fs.readFile(path.join(root, 'editorial/essay-seo.json'), 'utf8'));
  const errors = [], descriptions = new Set(), published = new Set();
  for (const file of await fs.readdir(path.join(root, 'src/content/essays'))) {
    if (!file.endsWith('.mdx')) continue;
    const id = file.replace(/\.mdx$/, '');
    const source = await fs.readFile(path.join(root, 'src/content/essays', file), 'utf8');
    const data = parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
    if (data.draft) continue;
    published.add(id);
    const profile = profiles[id];
    const hash = sourceHash(source);
    if (!profile || profile.reviewedSourceHash !== hash) errors.push(`${id}: review required; reviewedSourceHash = ${hash}`);
    if (!profile) continue;
    const description = profile.description;
    if (typeof description !== 'string' || description.trim() !== description || description.length < 60 || description.length > 300 || /[<>\n]/.test(description)) errors.push(`${id}: write a concise, plain-text description (60–300 characters).`);
    if (descriptions.has(description)) errors.push(`${id}: duplicate description.`);
    descriptions.add(description);
    for (const field of ['metadataUpdatedAt', 'contentModifiedAt']) {
      if (field === 'contentModifiedAt' && !profile[field]) continue;
      const timestamp = Date.parse(profile[field]);
      if (!Number.isFinite(timestamp) || timestamp > Date.now() || timestamp < Date.parse(data.date)) errors.push(`${id}: invalid ${field}.`);
    }
    if (!profile.focusQuery?.trim()) errors.push(`${id}: missing internal query hypothesis.`);
  }
  for (const id of Object.keys(profiles)) if (!published.has(id)) errors.push(`${id}: profile has no published essay.`);
  if (errors.length && !reportOnly) throw new Error(`Editorial SEO review failed:\n${errors.join('\n')}\nSee docs/seo.md.`);
  return { count: published.size, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateEditorialSeo({ reportOnly: true });
  console.log(result.errors.length ? result.errors.join('\n') : `SEO: ${result.count} published essays reviewed.`);
  process.exitCode = result.errors.length ? 1 : 0;
}
