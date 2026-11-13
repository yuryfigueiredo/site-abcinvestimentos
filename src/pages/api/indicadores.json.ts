import type { APIRoute } from 'astro';
import { getIndicators } from '../../lib/indicators';

export const GET: APIRoute = async () => {
  const payload = await getIndicators();

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=21600, stale-while-revalidate=86400',
    },
  });
};