import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Essay schema — enforced for every MDX file in src/content/essays/.
 *
 * All essays are bodies of long-form Vietnamese prose. The schema keeps
 * frontmatter honest: required title, optional subtitle, date, dek, tags.
 *
 * Snake-case aliases accepted from imported Substack frontmatter:
 *   cover_image → coverImage
 *   url         → originalUrl
 *
 * Deferred feature slots:
 *   - commentsEnabled: defaults to false; flip to true when activating Giscus.
 *   - newsletterEnabled: defaults to false; flip when activating Buttondown.
 */

const essays = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/essays' }),
  schema: z
    .object({
      title: z.string(),
      subtitle: z.string().optional(),
      dek: z.string().optional(),
      date: z.coerce.date(),
      series: z.string().optional(),
      tags: z.array(z.string()).default([]),
      author: z.string().default('M. Q. Doan'),
      lang: z.enum(['vi']).default('vi'),
      draft: z.boolean().default(false),
      // Announced but not yet published. Always paired with draft: true —
      // draft hides the text, comingSoon shows the slot in its series.
      comingSoon: z.boolean().default(false),
      coverImage: z.string().optional(),
      cover_image: z.string().optional(),
      coverImageAlt: z.string().optional(),
      excerpt: z.string().optional(),

      // Optional features — currently off
      dropcap: z.boolean().default(false),
      commentsEnabled: z.boolean().default(false),

      // Cross-publication traceability
      originalUrl: z.string().url().optional(),
      url: z.string().url().optional(),
      publicationHistory: z.string().optional(),
    })
    .transform((data) => ({
      ...data,
      coverImage: data.coverImage ?? data.cover_image,
      originalUrl: data.originalUrl ?? data.url,
    })),
});

/**
 * Books collection — for the /books/ review section.
 * A book has its own metadata (title, author, cover) plus a 1:1 link to the
 * essay that reviewed it (reviewEssayId).
 */
const books = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/books' }),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    coverImage: z.string().optional(), // relative path or URL; may be blank until a cover is added
    coverImageAlt: z.string().optional(),
    coverWidth: z.number().int().optional(), // intrinsic px, for CLS-free natural-ratio rendering
    coverHeight: z.number().int().optional(),
    publisher: z.string().optional(),
    year: z.number().int().optional(),
    reviewEssayId: z.string(), // matches essay.id (slug)
    blurb: z.string().optional(),
  }),
});

/**
 * Series collection — the named sequences an essay belongs to.
 * Each series is a fixed, ordered run of essays (currently trios):
 * Chủ nghĩa dân tộc, Kỷ nguyên vươn mình, Thế hệ Kiệt sức, Chủ nghĩa tư bản.
 *
 * A series carries no editorial preface: the name and its essays stand alone.
 * Publication state lives on the essay, not the series: an essay marked
 * `draft` + `comingSoon` holds a slot here without exposing its text.
 */
const series = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/series' }),
  schema: z.object({
    name: z.string(), // "Capitalism"
    nameVi: z.string().optional(), // "Chủ nghĩa tư bản"
    slug: z.string(), // "tu-ban"
    description: z.string(),
    essayIds: z.array(z.string()).default([]), // ordered essay slug list
    featured: z.boolean().default(false),
  }),
});

export const collections = { essays, books, series };
