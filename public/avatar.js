import { UUID, escapeHtml } from './contracts.js';

// A origem é validada tanto na API quanto na apresentação. Sem hosts por sufixo.
export function trustedSteamAvatar(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && /^avatars(?:\.[a-z0-9-]+)?\.steamstatic\.com$/i.test(url.hostname)
      && /^\/[a-z0-9_/-]+\.(?:jpg|jpeg|png)$/i.test(url.pathname) && !url.search && !url.hash;
  } catch { return false; }
}

export function characterAvatar(row = {}) {
  const identified = typeof row.profile_id === 'string' && UUID.test(row.profile_id);
  const id = identified ? row.profile_id.toLowerCase() : '';
  let seed = 2166136261;
  for (const character of id) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  const palette = ['#ec8cad', '#cf80bd', '#e9ba84', '#a89cdb', '#cb8399', '#a5bbb4'];
  const accent = palette[seed % palette.length];
  const initials = identified ? String(row.character_name || '?').normalize('NFC').trim().split(/\s+/u)
    .filter(Boolean).slice(0, 2).map((part) => Array.from(part)[0]).join('').toLocaleUpperCase('pt-BR') : '?';
  const angle = seed % 60;
  // Monograma de registro, não foto ou prova de identidade de uma vida.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="24" fill="#18131e"/><circle cx="120" cy="116" r="94" fill="none" stroke="${accent}" stroke-opacity=".24"/><path d="M120 23 210 116 120 209 30 116Z" fill="none" stroke="${accent}" stroke-opacity=".3" transform="rotate(${angle} 120 116)"/><path d="M39 116 88 87 71 143ZM201 116 152 87 169 143Z" fill="${accent}" opacity=".12"/><text x="120" y="135" text-anchor="middle" fill="${accent}" font-family="Georgia,serif" font-size="58">${escapeHtml(initials)}</text><text x="120" y="196" text-anchor="middle" fill="${accent}" opacity=".65" font-family="monospace" font-size="12" letter-spacing="3">CLUBE DAS WINX</text></svg>`;
  const fallback = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const steam = identified && row.avatar_source === 'steam_configured' && trustedSteamAvatar(row.avatar_url);
  return { src: steam ? row.avatar_url : fallback, fallback,
    label: steam ? 'Avatar Steam' : 'Avatar do personagem' };
}
