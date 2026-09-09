# v0.8.1 · Publication icons

The reference is [Nucleo Micro Bold](https://nucleoapp.com/micro-bold-icons):
20-unit grid and 16-unit live area. The publication adapts its 2-unit reference
stroke to a finer 1.5-unit stroke, as requested for the editorial design. These 17 SVGs
are drawn for this publication; they are not extracted Nucleo assets.
Rounded joins soften the geometry against the existing editorial type and
paper surfaces. The four-point fleuron echoes a small printer’s ornament.

| Selection | Use |
| --- | --- |
| Search, menu, close | Masthead, compact reading bar, search and reader sheet |
| Copy, check, mail, download | Article sharing, confirmation and PDF export |
| Arrow left/right, return to top | Article links and return control |
| Arrow up-right | External newsletter destination |
| Chevron left/right | Book/series carousels and archive pagination, retaining the angle-bracket silhouette |
| Reading, standard/wide measure | Reading preferences; actual font and theme samples remain text |
| Fleuron | Article ending and optional `hr.asterism` section breaks |

Facebook and X retain their existing official monochrome artwork. They do
not adopt the utility icons’ stroke or distort their brand proportions.

## Integration

Sources: `src/assets/icons/*.svg`. Use `Icon.astro` with a typed `name` and
`size={16|20|24}` (20 by default). All sources use `currentColor`. Utility
controls use 20px; the mobile Aa pairs a sans-serif capital with a serif italic lowercase in a 24px box; arrows alongside labels and the fleuron use 16px. The
existing touch targets remain at least 44px. SVGs reserve their dimensions,
are hidden from assistive technology, and do not accept keyboard focus;
the surrounding button/link supplies the accessible name.

Astro imports trusted local SVG markup at build time and emits only the
icons used on each page. No icon font, third-party request, hydration,
client-side icon package or sprite lookup is needed. SVG sources contain
only geometry and presentation attributes (3,788 bytes total), without editor metadata or
embedded raster images. The CSS asterism uses the same fleuron as a mask.
Menu bars morph reversibly into a cross with the panel’s shared opening (240ms)
and closing (180ms) durations and easing. Copy/check states cross-fade without changing their layout box;
reduced-motion preferences disable those animations.

The SVG specimen at `docs/icons.svg` shows every glyph at 16, 20 and 24px,
plus its appearance on the four reader surfaces. It is a review artifact,
not a production page or downloaded asset.
