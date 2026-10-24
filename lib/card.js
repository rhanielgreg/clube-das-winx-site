import path from 'node:path';
import sharp from 'sharp';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const assetPath = path.join(process.cwd(), 'public', 'assets', 'winx-zomboid-banner.webp');
const regularFontPath = path.join(process.cwd(), 'public', 'fonts', 'Poppins-Regular.ttf');
const boldFontPath = path.join(process.cwd(), 'public', 'fonts', 'Poppins-Bold.ttf');

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function shorten(value, length) {
  const text = String(value ?? '');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function formatCheckedAt(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return 'agora';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function textLayer(text, {
  left,
  top,
  size,
  color = '#ffffff',
  bold = false,
  width = 0,
  align = 'left',
  spacing = 0,
}) {
  const attributes = [
    `foreground="${color}"`,
    `size="${Math.round(size * 1024)}"`,
    bold ? 'weight="bold"' : '',
    spacing ? `letter_spacing="${Math.round(spacing * 1024)}"` : '',
  ].filter(Boolean).join(' ');

  const textOptions = {
    text: `<span ${attributes}>${escapeXml(text)}</span>`,
    font: 'Poppins',
    fontfile: bold ? boldFontPath : regularFontPath,
    align,
    rgba: true,
    dpi: 72,
    wrap: 'none',
  };
  if (width > 0) textOptions.width = width;

  return {
    input: {
      text: textOptions,
    },
    left,
    top,
  };
}

function makeCardLayers(status) {
  const online = Boolean(status.online);
  const stateColor = online ? '#67f7aa' : '#aab0ba';
  const stateGlow = online ? '#25d77d' : '#65707c';
  const stateLabel = online ? 'ONLINE' : 'OFFLINE';
  const playerCount = `${status.players ?? 0} / ${status.maxPlayers ?? 0}`;
  const source = status.source === 'a2s'
    ? 'A2S / STEAM QUERY'
    : status.source === 'external-api'
      ? 'API EXTERNA'
      : 'SEM RESPOSTA';

  const shapes = Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#08070b" stop-opacity="0.96"/>
          <stop offset="0.43" stop-color="#08070b" stop-opacity="0.54"/>
          <stop offset="0.62" stop-color="#08070b" stop-opacity="0.46"/>
          <stop offset="1" stop-color="#08070b" stop-opacity="0.93"/>
        </linearGradient>
        <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#050408" stop-opacity="0"/>
          <stop offset="1" stop-color="#050408" stop-opacity="0.96"/>
        </linearGradient>
        <linearGradient id="pinkLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#ff2f9e"/>
          <stop offset="0.5" stop-color="#ffb5dc"/>
          <stop offset="1" stop-color="#a4135e"/>
        </linearGradient>
        <filter id="pinkGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="stateGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${stateGlow}" flood-opacity="0.85"/>
        </filter>
      </defs>

      <rect width="1200" height="630" fill="url(#shade)"/>
      <rect y="330" width="1200" height="300" fill="url(#bottom)"/>
      <rect x="1.5" y="1.5" width="1197" height="627" rx="28" fill="none" stroke="#ff4ca6" stroke-opacity="0.7" stroke-width="3"/>
      <rect x="34" y="30" width="265" height="36" rx="18" fill="#0b0910" fill-opacity="0.9" stroke="#ff4ca6" stroke-opacity="0.7"/>
      <rect x="42" y="135" width="530" height="4" rx="2" fill="url(#pinkLine)" filter="url(#pinkGlow)"/>

      <rect x="42" y="173" width="390" height="230" rx="22" fill="#09070c" fill-opacity="0.84" stroke="#ff4ca6" stroke-opacity="0.44"/>
      <circle cx="82" cy="215" r="9" fill="${stateColor}" filter="url(#stateGlow)"/>

      <rect x="668" y="173" width="490" height="230" rx="22" fill="#09070c" fill-opacity="0.86" stroke="#ff4ca6" stroke-opacity="0.44"/>

      <rect x="42" y="450" width="1116" height="116" rx="22" fill="#09070c" fill-opacity="0.91" stroke="#ff4ca6" stroke-opacity="0.5"/>
      <rect x="920" y="478" width="202" height="58" rx="29" fill="#ed2d91"/>
      <rect x="924" y="482" width="194" height="50" rx="25" fill="#7a124b" fill-opacity="0.48"/>
    </svg>
  `);

  return [
    { input: shapes, top: 0, left: 0 },
    textLayer('SERVER STATUS', { left: 55, top: 39, size: 16, color: '#ffc3e2', bold: true, spacing: 3 }),
    textLayer(shorten(status.name, 39), { left: 42, top: 88, size: 31, bold: true, width: 570 }),
    textLayer(stateLabel, { left: 103, top: 194, size: 27, color: stateColor, bold: true, spacing: 2 }),
    textLayer('JOGADORES', { left: 72, top: 266, size: 16, color: '#d6cbd2', bold: true, spacing: 2 }),
    textLayer(playerCount, { left: 70, top: 296, size: 65, bold: true, width: 320 }),
    textLayer(source, { left: 72, top: 371, size: 14, color: '#d487ad', bold: true }),
    textLayer('DADOS DE ACESSO', { left: 704, top: 198, size: 15, color: '#ff83bd', bold: true, spacing: 2, width: 410 }),
    textLayer('ENDEREÇO IP', { left: 704, top: 241, size: 13, color: '#9e8c98', bold: true }),
    textLayer(status.ip, { left: 704, top: 256, size: 25, bold: true, width: 410 }),
    textLayer('DDNS', { left: 704, top: 313, size: 13, color: '#9e8c98', bold: true }),
    textLayer(shorten(status.ddns, 34), { left: 704, top: 330, size: 22, bold: true, width: 420 }),
    textLayer(`Atualizado em ${formatCheckedAt(status.checkedAt)}`, { left: 704, top: 373, size: 13, color: '#a4939f' }),
    textLayer('CONECTAR PELA STEAM', { left: 72, top: 474, size: 14, color: '#ff83bd', bold: true, spacing: 2 }),
    textLayer(status.steamUrl, { left: 72, top: 500, size: 24, bold: true, width: 790 }),
    textLayer('JOGAR AGORA', { left: 957, top: 497, size: 16, bold: true, spacing: 0.6 }),
    textLayer('CLUBE DAS WINX  •  PROJECT ZOMBOID', { left: 42, top: 589, size: 12, color: '#bda8b5', bold: true, spacing: 2 }),
  ];
}

async function makeBackground() {
  try {
    return await sharp(assetPath)
      .resize(CARD_WIDTH, CARD_HEIGHT, { fit: 'cover', position: 'centre' })
      .modulate({ brightness: 0.66, saturation: 0.84 })
      .blur(0.3)
      .png()
      .toBuffer();
  } catch {
    return sharp({
      create: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        channels: 4,
        background: { r: 11, g: 7, b: 13, alpha: 1 },
      },
    }).png().toBuffer();
  }
}

export async function renderStatusCard(status) {
  const background = await makeBackground();
  return sharp(background)
    .composite(makeCardLayers(status))
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
}
