import { verifyKey } from 'discord-interactions';

const DISCORD_API = 'https://discord.com/api/v10';

export async function verifyDiscordSignature({ body, signature, timestamp, publicKey }) {
  if (!signature || !timestamp || !publicKey) return false;
  try {
    return await verifyKey(body, signature, timestamp, publicKey);
  } catch {
    return false;
  }
}

export function buildDiscordMessage(status, baseUrl) {
  const state = status.online ? '🟢 ONLINE' : '⚫ OFFLINE';
  const connectUrl = `${baseUrl}/api/connect`;
  return {
    content: [
      `**${status.name}** — ${state}`,
      `Jogadores: **${status.players} / ${status.maxPlayers}**`,
      `IP: \`${status.ip}\` • DDNS: \`${status.ddns}\``,
      `Steam: \`${status.steamUrl}\``,
    ].join('\n'),
    allowed_mentions: { parse: [] },
    attachments: [
      {
        id: '0',
        filename: 'clube-das-winx-status.png',
        description: `Status ${status.online ? 'online' : 'offline'} do servidor Clube das Winx`,
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: 'Conectar pela Steam',
            emoji: { name: '🎮' },
            url: connectUrl,
          },
          {
            type: 2,
            style: 5,
            label: 'Ver status',
            emoji: { name: '📡' },
            url: `${baseUrl}/api/status`,
          },
        ],
      },
    ],
  };
}

async function ensureDiscordOk(response) {
  if (response.ok) return;
  const details = (await response.text()).slice(0, 1000);
  throw new Error(`Discord respondeu HTTP ${response.status}: ${details}`);
}

export async function editOriginalInteraction({ applicationId, token, payload, image }) {
  const form = new FormData();
  form.append('payload_json', JSON.stringify(payload));
  form.append(
    'files[0]',
    new Blob([image], { type: 'image/png' }),
    'clube-das-winx-status.png',
  );

  const response = await fetch(
    `${DISCORD_API}/webhooks/${applicationId}/${token}/messages/@original`,
    { method: 'PATCH', body: form },
  );
  await ensureDiscordOk(response);
}

export async function editOriginalInteractionError({ applicationId, token, message }) {
  const response = await fetch(
    `${DISCORD_API}/webhooks/${applicationId}/${token}/messages/@original`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: `Não consegui montar o status agora. ${message}`,
        allowed_mentions: { parse: [] },
        attachments: [],
        components: [],
      }),
    },
  );
  await ensureDiscordOk(response);
}
