/**
 * titleCaps — split a headline into CRB-style caps-and-small-caps runs.
 *
 * The look: every letter is a capital, but the letters the author actually
 * capitalised stay full height while the rest drop to small-cap height.
 * "Kinh cầu cho Kẻ tỉnh táo" → K INH C ẦU CHO K Ẻ TỈNH TÁO.
 *
 * We cannot use `font-variant-caps: small-caps` for this: the Fontsource
 * EB Garamond subsets carry no `smcp` feature (the Vietnamese subset has no
 * GSUB features at all), so the property is silently inert. Splitting into
 * spans and scaling the lowercase runs works in any face, diacritics included.
 *
 * Uncased characters (spaces, apostrophes, digits, combining marks) join the
 * run in progress so a headline yields a handful of spans, not one per letter.
 */

export interface TitleCapsSegment {
  text: string;
  /** Originally lowercase — render as a reduced-size capital. */
  small: boolean;
}

function isLowercaseLetter(char: string): boolean {
  return char !== char.toUpperCase() && char === char.toLowerCase();
}

function isUppercaseLetter(char: string): boolean {
  return char !== char.toLowerCase() && char === char.toUpperCase();
}

export function titleCaps(title: string): TitleCapsSegment[] {
  const segments: TitleCapsSegment[] = [];

  for (const char of title) {
    let small: boolean;
    if (isLowercaseLetter(char)) {
      small = true;
    } else if (isUppercaseLetter(char)) {
      small = false;
    } else {
      small = segments.at(-1)?.small ?? false;
    }

    const current = segments.at(-1);
    if (current && current.small === small) {
      current.text += char;
    } else {
      segments.push({ text: char, small });
    }
  }

  return segments.map(({ text, small }) => ({ text: text.toUpperCase(), small }));
}
