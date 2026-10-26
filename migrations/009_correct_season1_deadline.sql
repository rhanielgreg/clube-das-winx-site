-- Missão 11: decisão oficial substitui o prazo de novembro pelo de outubro.
-- Correção de dados independente da 008; não altera esquema, funções ou encerramento.
-- Antes de aplicar: preservar a linha e preparar reversão condicional do único campo.
begin;
set local lock_timeout='3s';
set local statement_timeout='10s';
do $$
declare
  target public.ranking_seasons%rowtype;
  after_row jsonb;
  other_seasons jsonb;
  affected integer;
begin
  select * into target from public.ranking_seasons
    where id='4ec32a87-fb16-4838-af57-f4cf85425a60' for update;
  if not found or target.name<>'Temporada 1' or target.slug<>'temporada-1'
    or target.status<>'active' or target.ended_at is not null or target.closed_at is not null
    or target.started_at is distinct from '2026-10-20T01:05:18.930285Z'::timestamptz then
    raise exception 'season identity/state/start differs from verified production; no change';
  end if;
  if target.scheduled_end_at='2026-10-31 23:59:00 America/Sao_Paulo'::timestamptz then
    return; -- Reexecução não altera linhas, início ou resultados.
  end if;
  if target.scheduled_end_at is distinct from '2026-12-01T02:59:00Z'::timestamptz then
    raise exception 'prior deadline differs from captured value; no change';
  end if;
  select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') into other_seasons
    from public.ranking_seasons s where id<>target.id;
  update public.ranking_seasons
    set scheduled_end_at='2026-10-31 23:59:00 America/Sao_Paulo'::timestamptz
    where id=target.id and scheduled_end_at=target.scheduled_end_at;
  get diagnostics affected=row_count;
  select to_jsonb(s) into after_row from public.ranking_seasons s where id=target.id;
  if affected<>1 or (after_row-'scheduled_end_at') is distinct from (to_jsonb(target)-'scheduled_end_at')
    or other_seasons is distinct from (select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from public.ranking_seasons s where id<>target.id) then
    raise exception 'correction changed unexpected fields/rows; transaction reverted';
  end if;
end $$;
commit;
