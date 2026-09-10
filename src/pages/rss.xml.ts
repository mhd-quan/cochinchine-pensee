import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const essays = await getCollection('essays', ({ data }) => !data.draft);
  const sorted = essays.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: 'The Cochinchine Pensées',
    description:
      'A Vietnamese editorial publication on politics, literature, and the Vietnamese intellectual tradition.',
    site: context.site ?? 'https://cochinchinepensees.studio',
    items: sorted.map((essay) => ({
      title: essay.data.title,
      pubDate: essay.data.date,
      description: essay.data.subtitle ?? essay.data.dek ?? '',
      link: `/essays/${essay.id}`,
      author: essay.data.author,
      categories: essay.data.topics,
    })),
    customData: '<language>vi</language>',
    stylesheet: '/rss-styles.xsl',
  });
}
