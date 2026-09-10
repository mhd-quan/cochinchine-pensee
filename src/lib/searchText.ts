/** Vietnamese title aliases keep đ searchable as d as well as preserving accents. */
export function foldSearchText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

// Pagefind folds combining accents, but Vietnamese đ is a separate letter.
// Store only the missing word aliases, not a second copy of every essay.
export function vietnameseSearchAliases(value: string): string {
  const words = value.match(/[\p{L}\p{M}]+/gu) ?? [];
  return [...new Set(words.filter((word) => /[đĐ]/.test(word)).map(foldSearchText))].join(' ');
}
