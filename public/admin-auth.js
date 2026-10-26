export const AUTH_UNAVAILABLE='Autenticação não configurada neste ambiente. O responsável precisa concluir a configuração administrativa.';

export function requireAdminAuth(client) {
  if(!client?.auth)throw new Error(AUTH_UNAVAILABLE);
  return client.auth;
}

export async function createAdminAuthClient(config,loadSdk) {
  if(config?.admin_enabled!==true)return null;
  if(typeof config.supabase_url!=='string'||!config.supabase_url.trim()||typeof config.supabase_public_key!=='string'||!config.supabase_public_key.trim())throw new Error(AUTH_UNAVAILABLE);
  const sdk=await loadSdk();
  if(typeof sdk?.createClient!=='function')throw new Error('SDK de autenticação indisponível. Tente novamente mais tarde.');
  const client=sdk.createClient(config.supabase_url,config.supabase_public_key,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
  });
  requireAdminAuth(client);
  return client;
}
