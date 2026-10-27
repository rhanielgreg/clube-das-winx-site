export const AUTH_UNAVAILABLE='Autenticação não configurada neste ambiente. O responsável precisa concluir a configuração administrativa.';

export function requireAdminAuth(client) {
  if(!client?.auth)throw new Error(AUTH_UNAVAILABLE);
  return client.auth;
}

export function adminAuthStorageKey(url) { return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`; }

export async function createAdminAuthClient(config,loadSdk,{onRecoveryResponse,fetchImpl=fetch}={}) {
  if(config?.admin_enabled!==true)return null;
  if(typeof config.supabase_url!=='string'||!config.supabase_url.trim()||typeof config.supabase_public_key!=='string'||!config.supabase_public_key.trim())throw new Error(AUTH_UNAVAILABLE);
  const sdk=await loadSdk();
  if(typeof sdk?.createClient!=='function')throw new Error('SDK de autenticação indisponível. Tente novamente mais tarde.');
  const client=sdk.createClient(config.supabase_url,config.supabase_public_key,{
    // O retorno foi capturado/limpo antes do SDK e será consumido exatamente uma vez.
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,debug:false},
    ...(onRecoveryResponse ? {global:{fetch:async(input,options)=>{
      const response=await fetchImpl(input,options);
      const url=typeof input==='string'?input:input?.url || String(input);
      if(url.split('?')[0]===config.supabase_url.replace(/\/$/,'')+'/auth/v1/recover')
        onRecoveryResponse(response);
      return response;
    }}} : {}),
  });
  requireAdminAuth(client);
  return client;
}
