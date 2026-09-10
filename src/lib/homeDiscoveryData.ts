import type { CollectionEntry } from 'astro:content';
import { createHash } from 'node:crypto';
import quoteRecords from '../data/home-quotes.json';
import { getCoverTreatment } from './coverTreatment';
import {
  HOME_DISCOVERY_IMAGE_SIZES,
  HOME_DISCOVERY_MOBILE_MAX_WIDTH,
  responsiveImage,
  responsiveSource,
  responsiveWebpSource,
} from './responsiveImage';

/** Build immutable, per-article resources; the page carries only the rotation index. */
export function homeDiscoveryEntries(essays: CollectionEntry<'essays'>[]) {
  const published = new Map(
    essays.filter(({ data }) => !data.draft && !data.comingSoon).map((essay) => [essay.id, essay]),
  );
  return quoteRecords
    .filter(({ essayId }) => published.has(essayId))
    .map(({ essayId, quotes }) => {
      const essay = published.get(essayId)!;
      const cover = essay.data.coverImage;
      if (!cover) throw new Error(`Home discovery essay has no cover: ${essayId}`);
      const sizes = HOME_DISCOVERY_IMAGE_SIZES;
      const payload = {
        essayId,
        href: `/essays/${essayId}`,
        title: essay.data.title,
        author: essay.data.author,
        lang: essay.data.lang,
        coverTreatment: getCoverTreatment(essayId),
        quotes,
        image: {
          alt: essay.data.coverImageAlt ?? `Minh hoạ cho ${essay.data.title}`,
          mobileAvif: responsiveSource(cover, sizes, HOME_DISCOVERY_MOBILE_MAX_WIDTH),
          avif: responsiveSource(cover, sizes),
          mobileWebp: responsiveWebpSource(cover, sizes, HOME_DISCOVERY_MOBILE_MAX_WIDTH),
          fallback: responsiveImage(cover, sizes, 480),
        },
      };
      const body = JSON.stringify(payload);
      const hash = createHash('sha256').update(body).digest('hex').slice(0, 20);
      return { essayId, count: quotes.length, url: `/discovery/${hash}.json`, hash, body, payload };
    });
}
