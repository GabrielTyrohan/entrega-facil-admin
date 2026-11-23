-- =====================================================================
-- Retenção de registros (Política de Privacidade)
--
-- auditoria_acoes ........... 5 anos   (quem alterou o quê, IP, user agent, cópia dos dados)
-- vendedor_sync_telemetria .. 12 meses (telemetria do app do vendedor)
-- logs_sistema já tem o job limpar-logs-antigos (30 dias); não muda aqui.
--
-- auditoria_acoes não tem trigger nem regra que bloqueie DELETE: a Fase 7 só
-- revogou insert/update/delete/truncate de anon e authenticated. Esta função
-- roda como dono da tabela (SECURITY DEFINER) e só pode ser chamada pelo
-- service_role e pelo pg_cron; os usuários continuam sem poder apagar nada.
-- =====================================================================

create or replace function public.limpar_retencao_registros()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auditoria integer;
  v_telemetria integer;
begin
  delete from public.auditoria_acoes
   where created_at < now() - interval '5 years';
  get diagnostics v_auditoria = row_count;

  delete from public.vendedor_sync_telemetria
   where created_at < now() - interval '12 months';
  get diagnostics v_telemetria = row_count;

  return jsonb_build_object(
    'auditoria_acoes', v_auditoria,
    'vendedor_sync_telemetria', v_telemetria
  );
end;
$$;

comment on function public.limpar_retencao_registros() is
  'Apaga auditoria com mais de 5 anos e telemetria do vendedor com mais de 12 meses. Rodada todo dia pelo pg_cron (limpar-retencao-registros).';

revoke all on function public.limpar_retencao_registros() from public, anon, authenticated;
grant execute on function public.limpar_retencao_registros() to service_role;

-- Job diário às 07:00 UTC (04:00 em Brasília). Idempotente.
do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'limpar-retencao-registros') then
    perform cron.unschedule('limpar-retencao-registros');
  end if;
  perform cron.schedule(
    'limpar-retencao-registros',
    '0 7 * * *',
    'select public.limpar_retencao_registros();'
  );
end $cron$;
