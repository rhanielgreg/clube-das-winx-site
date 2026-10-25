import assert from 'node:assert/strict';
import test from 'node:test';
import { characterAvatar, trustedSteamAvatar } from '../public/avatar.js';
import { getSteamAvatar } from '../lib/steam-avatar.js';
import { hasNumber } from '../public/contracts.js';
import { memorialHighlights } from '../public/presentation.js';

const first = '20000000-0000-4000-8000-000000000001';
const second = '20000000-0000-4000-8000-000000000002';
const season = '10000000-0000-4000-8000-000000000001';
test('monogramas distinguem registros homônimos, são estáveis e escapam conteúdo', () => {
  const row = {profile_id:first,character_name:'Mesmo nome'};
  assert.deepEqual(characterAvatar(row),characterAvatar({...row}));
  assert.notEqual(characterAvatar(row).src,characterAvatar({...row,profile_id:second}).src);
  const hostile = characterAvatar({profile_id:first,character_name:'<x >y'});
  const svg = decodeURIComponent(hostile.src.split(',')[1]);
  assert.ok(svg.includes('&lt;&gt;'));
  assert.ok(!svg.includes('<x'));
  assert.ok(decodeURIComponent(characterAvatar({}).src).includes('SEM ID'));
});

test('imagem Steam exige associação configurada e host exato; falhas têm fallback próprio', () => {
  const url='https://avatars.akamai.steamstatic.com/abcdef_full.jpg';
  const row={profile_id:first,character_name:'A',avatar_url:url};
  assert.ok(characterAvatar(row).src.startsWith('data:'));
  assert.equal(characterAvatar({...row,avatar_source:'steam_configured'}).src,url);
  for (const bad of ['https://avatars.evilsteamstatic.com/a.jpg','https://avatars.steamstatic.com.evil.invalid/a.jpg',
    'https://user:pass@avatars.steamstatic.com/a.jpg','https://avatars.steamstatic.com:8443/a.jpg','http://avatars.steamstatic.com/a.jpg']) {
    assert.equal(trustedSteamAvatar(bad),false);
    assert.ok(characterAvatar({...row,avatar_source:'steam_configured',avatar_url:bad}).src.startsWith('data:'));
  }
});

test('Steam: UUID explícito precede nome; apenas perfil permitido é consultado e XML é validado', async () => {
  const requested=[];
  const env={STEAM_PROFILE_MAP_JSON:JSON.stringify({[first]:'https://steamcommunity.com/profiles/76561198000000001',
    'Nome igual':'https://steamcommunity.com/id/nao-usar'})};
  const avatar=await getSteamAvatar('Nome igual',{profileId:first,env,fetchImpl:async (url,options)=>{
    requested.push(url); assert.equal(options.redirect,'error');
    return new Response('<avatarFull><![CDATA[https://avatars.steamstatic.com/abc_full.jpg]]></avatarFull>');
  }});
  assert.deepEqual(requested,['https://steamcommunity.com/profiles/76561198000000001/?xml=1']);
  assert.equal(avatar,'https://avatars.steamstatic.com/abc_full.jpg');
  assert.equal(await getSteamAvatar('A',{env:{STEAM_PROFILE_MAP_JSON:'{"A":"https://steamcommunity.com/id/bad-avatar"}'},
    fetchImpl:async()=>new Response('<avatarFull>https://avatars.evilsteamstatic.com/a.jpg</avatarFull>')}),null);
  const unexpected=async()=>{throw new Error('não deve consultar rede');};
  assert.equal(await getSteamAvatar('__proto__',{env:{},fetchImpl:unexpected}),null);
  assert.equal(await getSteamAvatar('Nome sem associação',{env:{},fetchImpl:unexpected}),null);
});

test('memorial compara somente mortos identificados na mesma temporada e preserva empates', () => {
  const row=(id,kills,extras={})=>({profile_id:id,season_id:season,alive:false,kills_total:kills,...extras});
  assert.deepEqual([...memorialHighlights([row(first,100)])],[]);
  assert.deepEqual([...memorialHighlights([row(first,100),row(second,'100')])],[first,second]);
  assert.deepEqual([...memorialHighlights([row(first,100),row(second,200,{season_id:'outra'})])],[]);
  assert.deepEqual([...memorialHighlights([row(first,100),row(second,500,{alive:true})])],[]);
  assert.deepEqual([...memorialHighlights([row(first,null),row(second,true)])],[]);
  assert.deepEqual([...memorialHighlights([row(first,100),row(second,200)])],[second]);
  for (const value of [true,false,[],{},' ',null,undefined]) assert.equal(hasNumber(value),false);
  assert.equal(hasNumber('0'),true);
});
