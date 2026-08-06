/**
 * JSON Feed — https://www.jsonfeed.org/
 * Preferred by some Vietnamese aggregators.
 */
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const essays = await getCollection('essays', ({ data }) => !data.draft);
  const sorted = essays.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const siteUrl = context.site ?? new URL('https://cochinchinepensees.studio');

  return new Response(
    JSON.stringify({
      version: 'https://jsonfeed.org/version/1.1',
      title: 'The Cochinchine Pensées',
      home_page_url: siteUrl.toString(),
      feed_url: new URL('/feed.json', siteUrl).toString(),
      description:
        'A Vietnamese editorial publication on politics, literature, and the Vietnamese intellectual tradition.',
      language: 'vi',
      authors: [{ name: 'M. Q. Doan' }],
      items: sorted.map((essay) => ({
        id: `${siteUrl}essays/${essay.id}/`,
        url: `${siteUrl}essays/${essay.id}/`,
        title: essay.data.title,
        content_text: essay.data.excerpt ?? essay.data.subtitle ?? essay.data.dek ?? '',
        date_published: essay.data.date.toISOString(),
        authors: [{ name: essay.data.author }],
        tags: essay.data.tags,
      })),
    }),
    {
      headers: {
        'Content-Type': 'application/feed+json; charset=utf-8',
      },
    },
  );
}
