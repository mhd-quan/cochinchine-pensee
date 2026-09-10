/**
 * Stable URL segment for an author byline.
 *
 * The content byline remains the source of truth; this helper only gives it a
 * durable, accent-insensitive archive path.
 */
export function authorSlug(name) {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
}
