// Conta até a próxima janela do cron comprovado; não presume coleta concluída.
export function collectionCountdown(sync,now) {
 const started=Date.parse(sync?.latest_attempt_at||'');
 if(sync?.collector_interval_seconds!==300||sync?.collector_cron_utc!=='*/5 * * * *'||!Number.isFinite(started)||!Number.isFinite(now))return 'Agenda de coleta indisponível';
 if(sync.latest_attempt_status==='failed')return 'Última tentativa de coleta falhou';
 if(sync.latest_attempt_status==='running')return now-started<240000?'Coleta em andamento':'Aguardando confirmação do coletor';
 if(sync.latest_attempt_status!=='success')return 'Aguardando confirmação do coletor';
 const expected=(Math.floor(started/300000)+1)*300000;
 const remaining=Math.ceil((expected-now)/1000);
 return remaining>0&&remaining<=300?`Próxima coleta prevista em ${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`:'Aguardando confirmação da próxima coleta';
}
