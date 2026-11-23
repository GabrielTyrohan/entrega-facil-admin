-- Download incremental de clientes para o app do vendedor.
--
-- get_clientes_vendedor(uuid) continua igual (lista completa dos ativos) para os APKs antigos.
-- A nova versão com p_updated_after devolve só os clientes que podem ter mudado depois da data:
--   * o próprio cliente mudou (updated_at, trigger atualiza_updated_at);
--   * uma entrega dele com este vendedor mudou, ou um pagamento dessa entrega
--     (o crédito de devolução é calculado a partir daí).
-- Volta também clientes desativados, com ativo = false, para o app saber que saíram.
-- Responsáveis não têm updated_at: o app faz um download completo pelo menos uma vez por dia.
--
-- Uso só pela Edge Function sync-vendedor-seguro (service_role), como a versão completa.

create index if not exists idx_clientes_vendedor_id on public.clientes (vendedor_id);
create index if not exists idx_entregas_vendedor_id on public.entregas (vendedor_id);
create index if not exists idx_pagamentos_entrega_id on public.pagamentos (entrega_id);

create or replace function public.get_clientes_vendedor(
  p_vendedor_id uuid,
  p_updated_after timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_updated_after is null then
    return public.get_clientes_vendedor(p_vendedor_id);
  end if;

  return (
    select coalesce(jsonb_agg(
      to_jsonb(c) || jsonb_build_object(
        'responsaveis', coalesce((
          select jsonb_agg(to_jsonb(r))
          from public.responsaveis r
          where r.cliente_id = c.id
        ), '[]'::jsonb),
        'credito_disponivel', coalesce((
          select round(sum(p.valor), 2)
          from public.entregas d
          join public.pagamentos p on p.entrega_id = d.id
          where d.cliente_id = c.id
            and d.vendedor_id = p_vendedor_id
            and d.status_entrega = 'devolução'
        ), 0)
      )
    ), '[]'::jsonb)
    from public.clientes c
    where c.vendedor_id = p_vendedor_id
      and (
        c.updated_at > p_updated_after
        or exists (
          select 1
          from public.entregas e
          where e.cliente_id = c.id
            and e.vendedor_id = p_vendedor_id
            and (
              e.updated_at > p_updated_after
              or exists (
                select 1 from public.pagamentos pg
                where pg.entrega_id = e.id
                  and greatest(pg.created_at, coalesce(pg.updated_at, pg.created_at)) > p_updated_after
              )
            )
        )
      )
  );
end;
$$;

revoke all on function public.get_clientes_vendedor(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.get_clientes_vendedor(uuid, timestamptz) to service_role;
