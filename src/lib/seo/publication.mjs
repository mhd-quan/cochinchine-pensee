import profiles from '../../../editorial/essay-seo.json' with { type: 'json' };
import { createHash } from 'node:crypto';
import { authorSlug } from '../authorArchive.mjs';

export const SITE = 'https://cochinchinepensees.studio';
export const PUBLICATION = 'The Cochinchine Pensées';

export function canonicalUrl(path) {
  const url = new URL(path, SITE);
  if (url.origin !== SITE) throw new Error(`Unexpected canonical origin: ${url.origin}`);
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';
  return url.href;
}

export function sourceHash(source) {
  return createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');
}

// Called during static generation only. Editorial research never reaches the client.
export function essaySeo(id, data) {
  const profile = profiles[id];
  if (!profile) throw new Error(`Missing editorial SEO profile: ${id}. See docs/seo.md.`);
  const url = canonicalUrl(`/essays/${id}`);
  const published = new Date(data.date).toISOString();
  const modified = profile.contentModifiedAt;
  if (modified && (!Number.isFinite(Date.parse(modified)) || Date.parse(modified) < Date.parse(published))) {
    throw new Error(`Invalid contentModifiedAt: ${id}`);
  }
  return {
    url,
    description: profile.description,
    published,
    modified,
    authorUrl: canonicalUrl(`/authors/${authorSlug(data.author)}`),
  };
}

export function sitemapEntry(item) {
  const url = canonicalUrl(item.url);
  const id = new URL(url).pathname.match(/^\/essays\/(.+)$/)?.[1];
  const profile = id && profiles[id];
  // Metadata changes count as significant page updates, not rewrites of the essay.
  // These stored editorial dates never advance merely because a build runs.
  const lastmod = profile && [profile.metadataUpdatedAt, profile.contentModifiedAt]
    .filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  return { ...item, url, ...(lastmod ? { lastmod } : {}) };
}

export function articleGraph({ title, author, lang, image, seo }) {
  const publisherId = `${SITE}/#publisher`;
  const websiteId = `${SITE}/#website`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': publisherId, name: PUBLICATION, url: `${SITE}/` },
      { '@type': 'WebSite', '@id': websiteId, name: PUBLICATION, url: `${SITE}/`, publisher: { '@id': publisherId } },
      { '@type': 'Person', '@id': `${seo.authorUrl}#person`, name: author, url: seo.authorUrl },
      {
        '@type': 'WebPage', '@id': `${seo.url}#webpage`, url: seo.url,
        name: title, description: seo.description, inLanguage: lang,
        isPartOf: { '@id': websiteId }, mainEntity: { '@id': `${seo.url}#article` },
      },
      {
        '@type': 'Article', '@id': `${seo.url}#article`, url: seo.url,
        headline: title, description: seo.description, inLanguage: lang,
        datePublished: seo.published,
        ...(seo.modified ? { dateModified: seo.modified } : {}),
        ...(image ? { image: [image] } : {}),
        author: { '@id': `${seo.authorUrl}#person`, '@type': 'Person', name: author, url: seo.authorUrl },
        publisher: { '@id': publisherId }, mainEntityOfPage: { '@id': `${seo.url}#webpage` },
        isAccessibleForFree: true,
      },
    ],
  };
}

export function serializeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
