import type { APIRoute } from 'astro';
import { latestEdition, readEditions } from '../../../lib/diario/store';

export const GET: APIRoute = () => {
  const edition = latestEdition(readEditions());

  return new Response(JSON.stringify(edition), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
};
