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
    coverImage: z.string().url(),
    coverImageAlt: z.string().optional(),
    publisher: z.string().optional(),
    year: z.number().int().optional(),
    reviewEssayId: z.string(), // matches essay.id (slug)
    blurb: z.string().optional(),
  }),
});

/**
 * Subjects collection — curated topic clusters for the homepage.
 * Trios of categories like Capitalism, Rising Era, etc.
 */
const subjects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/subjects' }),
  schema: z.object({
    name: z.string(), // "Capitalism"
    nameVi: z.string().optional(), // "Chủ nghĩa tư bản"
    slug: z.string(), // "tu-ban"
    description: z.string(),
    blurb: z.string().optional(),
    essayIds: z.array(z.string()).default([]), // ordered essay slug list
    featured: z.boolean().default(false),
  }),
});

export const collections = { essays, books, subjects };
