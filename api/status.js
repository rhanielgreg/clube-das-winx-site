import { renderStatusCard } from '../lib/card.js';
import { getServerStatus } from '../lib/server-status.js';
import { STATUS_VALIDITY_MS } from '../public/status-view.js';

const commonHeaders = {
  'access-control-allow-origin': '*',
  'cache-control': 'no-store',
};

export default {
  async fetch(request) {
    if (request.method !== 'GET') {
      return Response.json({ error: 'Método não permitido.' }, { status: 405, headers: commonHeaders });
    }

    const url = new URL(request.url);
    const status = await getServerStatus({ force: url.searchParams.get('fresh') === '1' });

    if (url.searchParams.get('format') === 'image') {
      const image = await renderStatusCard(status);
      return new Response(image, {
        status: 200,
        headers: {
          ...commonHeaders,
          'content-type': 'image/png',
          'content-length': String(image.length),
          'content-disposition': 'inline; filename="clube-das-winx-status.png"',
        },
      });
    }

    const checked=Date.parse(status.checkedAt||'');
    return Response.json({...status,serverTime:new Date().toISOString(),validUntil:Number.isFinite(checked)?new Date(checked+STATUS_VALIDITY_MS).toISOString():null}, { headers: commonHeaders });
  },
};
