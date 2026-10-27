// Consistent application backup into an existing protected directory, never Git.
// No scheduler, cloud storage, environment dump or automatic deletion is created.
import {readFile,writeFile,rename,unlink,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {parseRecovery,rehearseRecovery} from './rehearse-recovery.js';
const project='nykhcytysswjdynjosib';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function protectedBackupDirectory(directory) {
 if(!directory||!path.isAbsolute(directory))throw new Error('An existing absolute private backup directory is required');
 const resolved=await realpath(directory);
 const relative=path.relative(root,resolved);
 if(!relative||!relative.startsWith('..')&&!path.isAbsolute(relative))throw new Error('Backup destination must be outside the repository');
 if(!(await stat(resolved)).isDirectory())throw new Error('Backup destination is not a directory');
 try {
  const inside=execFileSync('git',['-C',resolved,'rev-parse','--is-inside-work-tree'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();
  if(inside==='true')throw new Error('Backup destination is inside a Git worktree');
 }catch(error){if(error.status!==128)throw error;}
 if(process.platform==='win32') {
  const script=`$ErrorActionPreference='Stop';$taskAcl=Get-Acl -LiteralPath $env:WINX_BACKUP_DIRECTORY; [pscustomobject]@{user=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value;rules=@($taskAcl.Access|ForEach-Object{[pscustomobject]@{sid=$_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value;allow=($_.AccessControlType -eq 'Allow')}})}|ConvertTo-Json -Depth 4 -Compress`;
  const childEnv={...process.env,WINX_BACKUP_DIRECTORY:resolved};
  // Windows PowerShell must load its own security module, not the parent's PS7 path.
  delete childEnv.PSModulePath;
  const acl=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],env:childEnv}));
  if(!acl.user||!Array.isArray(acl.rules)||!acl.rules.length||acl.rules.some(r=>!r.sid||typeof r.allow!=='boolean'))throw new Error('Could not verify backup directory ACL');
  const allowed=new Set([acl.user,'S-1-5-18','S-1-5-32-544']);
  if(acl.rules.some(r=>r.allow&&!allowed.has(r.sid)))throw new Error('Backup directory permits other identities; provision a private ACL first');
 } else if((await stat(resolved)).mode&0o077) throw new Error('Backup directory permissions must exclude group/others');
 return resolved;
}
export async function backupApplication({directory,env=process.env,fetchImpl=fetch,
 verify=rehearseRecovery,checkDirectory=protectedBackupDirectory}={}) {
 const destination=await checkDirectory(directory);
 const url=env.SUPABASE_URL?.trim().replace(/\/$/,'');
 const key=env.SUPABASE_SERVICE_ROLE_KEY?.trim();
 if(url!==`https://${project}.supabase.co`||!key||key.startsWith('sb_publishable_'))throw new Error('Correct project and backend-only service credential required');
 const response=await fetchImpl(url+'/rest/v1/rpc/get_service_recovery_export_v1',{
  method:'POST',headers:{apikey:key,...(!key.startsWith('sb_')?{Authorization:'Bearer '+key}:{}),'content-type':'application/json'},
  body:'{}',signal:AbortSignal.timeout(60000),redirect:'error'});
 if(!response.ok)throw new Error('Private export RPC returned HTTP '+response.status);
 if(!response.body)throw new Error('Empty backup response');
 let size=0;const chunks=[];
 for await(const chunk of response.body){size+=chunk.length;if(size>64*1024*1024)throw new Error('Backup exceeds reviewed 64 MiB limit');chunks.push(chunk);}
 const raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(typeof raw!=='string')throw new Error('Lossless backup text contract required');
 const backup=parseRecovery(raw);
 if(backup.schema!=='public'||!Number.isFinite(Date.parse(backup.exported_at)))throw new Error('Unverified backup export');
 const recovery=await verify(backup); // Never marks a backup verified on download alone.
 if(!recovery.exact_rows||!recovery.metadata_and_named_grants)throw new Error('Recovery proof incomplete');
 const digest=createHash('sha256').update(raw).digest('hex');
 const name='winx-public-'+new Date().toISOString().replaceAll(/[:.]/g,'-')+'-'+randomUUID()+'.json';
 const target=path.join(destination,name),temporary=target+'.partial';
 try {
  await writeFile(temporary,raw,{flag:'wx',mode:0o600});
  if(createHash('sha256').update(await readFile(temporary)).digest('hex')!==digest)throw new Error('Backup file checksum mismatch');
  await rename(temporary,target);
 } finally {await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 const manifest={file:name,sha256:digest,exported_at:backup.exported_at,verified_at:new Date().toISOString(),
  scope:'public application only',recovery,retention_recommendation:{daily:7,weekly:4,monthly:12,automatic_deletion:false},
  periodic:false};
 await writeFile(target+'.manifest.json',JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});
 return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 try {const result=await backupApplication({directory:process.argv[2]});console.log(JSON.stringify({file:result.file,sha256:result.sha256,verified:true,periodic:false}));}
 catch(error){console.error('Backup failed:',error.message);process.exitCode=1;}
}
