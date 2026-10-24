import 'dotenv/config';

const applicationId = process.env.DISCORD_APPLICATION_ID;
const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const forceGlobal = process.argv.includes('--global');

if (!applicationId || !token) {
  console.error('Defina DISCORD_APPLICATION_ID e DISCORD_BOT_TOKEN no arquivo .env.');
  process.exit(1);
}

const commands = [
  {
    name: 'server',
    description: 'Mostra os dados e o status do servidor Clube das Winx',
    type: 1,
  },
  {
    name: 'status',
    description: 'Mostra jogadores online e como conectar ao servidor',
    type: 1,
  },
];

const scope = guildId && !forceGlobal ? `guilds/${guildId}/commands` : 'commands';
const url = `https://discord.com/api/v10/applications/${applicationId}/${scope}`;
const response = await fetch(url, {
  method: 'PUT',
  headers: {
    authorization: `Bot ${token}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify(commands),
});

const result = await response.json().catch(() => null);
if (!response.ok) {
  console.error(`Discord respondeu HTTP ${response.status}:`, result);
  process.exit(1);
}

console.log(`${result.length} comandos registrados no escopo ${guildId && !forceGlobal ? 'do servidor' : 'global'}:`);
for (const command of result) console.log(`/${command.name}`);
