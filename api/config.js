// Configuração pública de autenticação. Nunca retorna uma chave de serviço.
export default function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  let isPublic = key.startsWith('sb_publishable_');
  if (!isPublic && key.split('.').length === 3) {
    try { isPublic = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* configuração inválida */ }
  }
  const configuration_issues=[];
  if(!url)configuration_issues.push('SUPABASE_URL');
  if(!isPublic)configuration_issues.push('SUPABASE_PUBLISHABLE_KEY_OR_ANON_KEY');
  if(!process.env.ADMIN_EMAIL?.trim())configuration_issues.push('ADMIN_EMAIL');
  // Somente nomes de configuração: nunca valores, e-mails ou chaves secretas.
  if(configuration_issues.length)return res.status(200).json({admin_enabled:false,configuration_issues});
  return res.status(200).json({ admin_enabled: true, supabase_url: url, supabase_public_key: key });
}
