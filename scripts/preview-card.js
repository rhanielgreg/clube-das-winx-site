import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderStatusCard } from '../lib/card.js';

const output = path.join(process.cwd(), 'public', 'card-preview.png');
const image = await renderStatusCard({
  name: 'Clube das Winx | Project Zomboid',
  online: true,
  players: 7,
  maxPlayers: 32,
  ip: '169.155.127.74:9045',
  ddns: 'clubedaswinx.modded.fun:9045',
  steamUrl: 'steam://connect/169.155.127.74:9045',
  source: 'a2s',
  checkedAt: new Date().toISOString(),
});
await writeFile(output, image);
console.log(output);
