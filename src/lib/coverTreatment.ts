export type CoverTreatment = 'paper' | 'plate';

/**
 * Full-frame scenes need a soft edge treatment; the remaining engravings can
 * have their light paper tone optically merged into the page.
 */
const PLATE_COVERS = new Set([
  '2026-01-06-cong-ly-cua-ke-manh',
  '2026-01-18-khi-le-nghi-tan-lui',
  '2026-03-21-nghi-le-cua-nen-cong-hoa',
]);

export function getCoverTreatment(essayId: string): CoverTreatment {
  return PLATE_COVERS.has(essayId) ? 'plate' : 'paper';
}
