import manifest from '../../.astro/responsive-images.json';

interface ResponsiveImage {
  width: number;
  height: number;
  variants: { src: string; width: number }[];
  avifVariants: { src: string; width: number }[];
}

const images: Record<string, ResponsiveImage> = manifest;

// Describe the painted width, not the empty space around a contained portrait.
export function containedImageSizes(source: string, sizes: string, frameRatio = 16 / 9) {
  const image = images[source];
  const scale = Math.min(1, image.width / image.height / frameRatio);
  if (scale === 1) return sizes;
  return sizes
    .split(', ')
    .map((entry) => {
      const match = entry.match(/^(\(min-width: \d+px\)\s+)?(.*)$/);
      if (!match) throw new Error(`Invalid image size: ${entry}`);
      const [, media = '', length] = match;
      return `${media}calc(${length} * ${scale.toFixed(5)})`;
    })
    .join(', ');
}

export function bookImageSizes(source: string) {
  const { width, height } = images[source];
  // Matches BookCard's height clamp and shelf padding. Browser handles DPR.
  const jacket = `calc((clamp(11.5rem, 9.5rem + 7vw, 15rem) - 0.5rem) * ${(width / height).toFixed(5)})`;
  return `(min-width: 640px) ${jacket}, min(calc((100vw - 3.75rem) / 2), ${jacket})`;
}

function limitedVariants(
  variants: ResponsiveImage['variants'],
  maximumWidth = Number.POSITIVE_INFINITY,
) {
  const limited = variants.filter(({ width }) => width <= maximumWidth);
  return limited.length > 0 ? limited : variants.slice(0, 1);
}

function responsiveSrcset(
  variants: ResponsiveImage['variants'],
  maximumWidth = Number.POSITIVE_INFINITY,
) {
  return limitedVariants(variants, maximumWidth)
    .map((variant) => `${variant.src} ${variant.width}w`)
    .join(', ');
}

export function responsiveSource(
  source: string,
  sizes: string,
  maximumWidth = Number.POSITIVE_INFINITY,
) {
  return {
    type: 'image/avif',
    srcset: responsiveSrcset(images[source].avifVariants, maximumWidth),
    sizes,
  };
}

export function responsiveWebpSource(
  source: string,
  sizes: string,
  maximumWidth = Number.POSITIVE_INFINITY,
) {
  return {
    type: 'image/webp',
    srcset: responsiveSrcset(images[source].variants, maximumWidth),
    sizes,
  };
}

// Match the actual container gutters and grid breakpoints. CSS still owns the
// layout; these values only help browsers choose the right download size.
export const CARD_IMAGE_SIZES =
  '(min-width: 1280px) 384px, (min-width: 1024px) calc((100vw - 8rem) / 3), ' +
  '(min-width: 768px) calc((100vw - 6rem) / 2), ' +
  '(min-width: 640px) calc((100vw - 4.5rem) / 2), calc(100vw - 2.5rem)';

export const SERIES_IMAGE_SIZES =
  '(min-width: 1280px) 384px, (min-width: 768px) calc((100vw - 8rem) / 3), ' +
  'calc(100vw - 2.5rem)';

export const ARCHIVE_IMAGE_SIZES =
  '(min-width: 1200px) 331px, (min-width: 1184px) 536px, ' + 'calc((100vw - 7rem) / 2)';

export const HERO_IMAGE_SIZES =
  '(min-width: 1216px) 624px, (min-width: 900px) calc((100vw - 8rem) * 0.57), ' +
  'calc(100vw - 2.5rem)';

export const HOME_DISCOVERY_IMAGE_SIZES =
  '(min-width: 1280px) 440px, (min-width: 896px) calc((100vw - 8rem) * 0.38), ' +
  'calc(100vw - 2.5rem)';

export const HOME_DISCOVERY_MOBILE_MAX_WIDTH = 672;

export function responsiveImage(source: string, sizes: string, fallbackWidth = 800) {
  const image = images[source];
  if (!image) throw new Error(`Image missing from responsive pipeline: ${source}`);
  const fallback =
    image.variants.find((variant) => variant.width >= fallbackWidth) ??
    image.variants[image.variants.length - 1];
  return {
    src: fallback.src,
    srcset: image.variants.map((variant) => `${variant.src} ${variant.width}w`).join(', '),
    sizes,
    width: image.width,
    height: image.height,
  };
}

// Metadata reuses the largest generated image; no additional browser request.
export function metadataImage(source: string) {
  const image = images[source];
  if (!image) throw new Error(`Missing metadata image: ${source}`);
  const variant = image.variants.at(-1)!;
  return { url: new URL(variant.src, 'https://cochinchinepensees.studio').href };
}
