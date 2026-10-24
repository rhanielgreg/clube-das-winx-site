import { waitUntil } from '@vercel/functions';
import { renderStatusCard } from '../lib/card.js';
import { resolvePublicBaseUrl } from '../lib/config.js';
import {
  buildDiscordMessage,
  editOriginalInteraction,
  editOriginalInteractionError,
  verifyDiscordSignature,
} from '../lib/discord.js';
import { getServerStatus } from '../lib/server-status.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  },
});

async function completeCommand(interaction, baseUrl) {
  try {
    const status = await getServerStatus();
    const image = await renderStatusCard(status);
    await editOriginalInteraction({
      applicationId: interaction.application_id,
      token: interaction.token,
      payload: buildDiscordMessage(status, baseUrl),
      image,
    });
  } catch (error) {
    console.error('Falha ao concluir interação:', error);
    try {
      await editOriginalInteractionError({
        applicationId: interaction.application_id,
        token: interaction.token,
        message: 'Tente novamente em alguns segundos.',
      });
    } catch (editError) {
      console.error('Falha ao publicar erro da interação:', editError);
    }
  }
}

export default {
  async fetch(request) {
    if (request.method === 'GET') {
      return json({
        ok: true,
        service: 'Clube das Winx Server Status',
        endpoint: 'Discord Interactions HTTP',
      });
    }
    if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

    const rawBody = await request.text();
    const publicKey = process.env.DISCORD_PUBLIC_KEY;
    if (!publicKey) return json({ error: 'DISCORD_PUBLIC_KEY não configurada.' }, 503);

    const valid = await verifyDiscordSignature({
      body: rawBody,
      signature: request.headers.get('x-signature-ed25519'),
      timestamp: request.headers.get('x-signature-timestamp'),
      publicKey,
    });
    if (!valid) return json({ error: 'Assinatura inválida.' }, 401);

    let interaction;
    try {
      interaction = JSON.parse(rawBody);
    } catch {
      return json({ error: 'JSON inválido.' }, 400);
    }

    if (interaction.type === 1) return json({ type: 1 });

    const command = interaction.data?.name?.toLowerCase();
    if (interaction.type === 2 && ['server', 'status'].includes(command)) {
      const baseUrl = resolvePublicBaseUrl(request.url);
      waitUntil(completeCommand(interaction, baseUrl));
      return json({ type: 5 });
    }

    return json({
      type: 4,
      data: {
        content: 'Comando não reconhecido. Use `/server` ou `/status`.',
        flags: 64,
        allowed_mentions: { parse: [] },
      },
    });
  },
};
