import { getCollection } from 'astro:content';
import { homeDiscoveryEntries } from '../../lib/homeDiscoveryData';

export async function getStaticPaths() {
  return homeDiscoveryEntries(await getCollection('essays')).map(({ hash, body }) => ({
    params: { entry: hash },
    props: { body },
  }));
}

export function GET({ props }: { props: { body: string } }) {
  return new Response(props.body, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
