-- Empresa (administrador_id) em entregas e pagamentos, para o desktop filtrar o Realtime.
--
-- Sem filtro, cada mudança de qualquer empresa é conferida (RLS) contra as telas abertas de
-- todas as empresas. Com `filter: administrador_id=eq.<id>`, o Realtime descarta antes as que
-- não são da empresa. As outras tabelas publicadas já têm a coluna.
--
-- O valor vem sempre do banco (trigger): entregas pelo vendedor, pagamentos pela entrega.
-- O preenchimento das linhas antigas desliga os triggers só nesta transação, para não mexer em
-- updated_at / sincronizado (o app compara updated_at com as alterações locais pendentes).

alter table public.entregas add column if not exists administrador_id uuid;
alter table public.pagamentos add column if not exists administrador_id uuid;

create or replace function public.fn_entrega_set_administrador_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.vendedor_id is distinct from old.vendedor_id or new.administrador_id is null then
    select v.administrador_id into new.administrador_id
    from public.vendedores v
    where v.id = new.vendedor_id;
  end if;
  return new;
end;
$$;

create or replace function public.fn_pagamento_set_administrador_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.entrega_id is distinct from old.entrega_id or new.administrador_id is null then
    select e.administrador_id into new.administrador_id
    from public.entregas e
    where e.id = new.entrega_id;
  end if;
  return new;
end;
$$;

revoke all on function public.fn_entrega_set_administrador_id() from public, anon, authenticated;
revoke all on function public.fn_pagamento_set_administrador_id() from public, anon, authenticated;

drop trigger if exists trg_entrega_set_administrador_id on public.entregas;
create trigger trg_entrega_set_administrador_id
  before insert or update on public.entregas
  for each row execute function public.fn_entrega_set_administrador_id();

drop trigger if exists trg_pagamento_set_administrador_id on public.pagamentos;
create trigger trg_pagamento_set_administrador_id
  before insert or update on public.pagamentos
  for each row execute function public.fn_pagamento_set_administrador_id();

-- Linhas antigas, sem disparar os triggers de updated_at, sincronizado, status e auditoria.
alter table public.entregas disable trigger user;
update public.entregas e
set administrador_id = v.administrador_id
from public.vendedores v
where v.id = e.vendedor_id
  and e.administrador_id is distinct from v.administrador_id;
alter table public.entregas enable trigger user;

alter table public.pagamentos disable trigger user;
update public.pagamentos p
set administrador_id = e.administrador_id
from public.entregas e
where e.id = p.entrega_id
  and p.administrador_id is distinct from e.administrador_id;
alter table public.pagamentos enable trigger user;

create index if not exists idx_entregas_administrador_id on public.entregas (administrador_id);
create index if not exists idx_pagamentos_administrador_id on public.pagamentos (administrador_id);
