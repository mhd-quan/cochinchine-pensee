/**
 * robots.txt — allow everything except /draft.
 */
export function GET() {
  const body = `User-agent: *
Allow: /
Disallow: /draft/

Sitemap: https://cochinchinepensees.studio/sitemap-index.xml
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
