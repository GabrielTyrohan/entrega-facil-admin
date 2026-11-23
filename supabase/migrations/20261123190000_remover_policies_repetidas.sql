-- Remove policies permissivas repetidas (resto do item 4 do teste de consumo).
--
-- Em policies permissivas, o acesso é o OU de todas. Estas 11 são iguais a outra policy da mesma
-- tabela, ou já estão contidas nela, para o mesmo comando e papel. Tirá-las não muda quem pode
-- ver ou gravar o quê; só evita avaliar a mesma condição duas vezes.
--
-- * is_super_admin() é exatamente `exists (desenvolvedores where user_id = auth.uid() and ativo)`,
--   então as policies com esse EXISTS são iguais à superadmin_all (ALL, public, using e check
--   is_super_admin()).
-- * Sem WITH CHECK, o Postgres usa o USING como check: a policy de UPDATE com só USING
--   is_super_admin() é igual à superadmin_all.
--
-- Ficam as policies "da empresa" + superadmin_all de cada tabela (são regras diferentes).

do $$
declare
  v_tabela text;
begin
  -- Trava: só segue se a superadmin_all continuar igual em todas as tabelas mexidas.
  foreach v_tabela in array array['administradores','clientes','entregas','itens_entrega',
    'cestas_base','cestas_base_itens','suporte_solicitacoes','vendedores'] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = v_tabela and policyname = 'superadmin_all'
        and permissive = 'PERMISSIVE' and cmd = 'ALL' and roles = '{public}'
        and qual = '( SELECT is_super_admin() AS is_super_admin)'
        and with_check = '( SELECT is_super_admin() AS is_super_admin)'
    ) then
      raise exception 'superadmin_all diferente do esperado em %; nada foi removido', v_tabela;
    end if;
  end loop;
end $$;

-- Igual a "Admin acessa próprio perfil" (ALL, authenticated, id = auth.uid()).
drop policy if exists admins on public.administradores;

-- Contidas na superadmin_all.
drop policy if exists "Super admin pode deletar todos administradores" on public.administradores;
drop policy if exists "Super admin pode editar todos administradores" on public.administradores;
drop policy if exists "Super admin pode ver todos administradores" on public.administradores;
drop policy if exists "Super admin pode gerenciar todos os clientes" on public.clientes;
drop policy if exists "Super admin pode ver todo suporte" on public.suporte_solicitacoes;
drop policy if exists "Super admin pode ver todos vendedores" on public.vendedores;
drop policy if exists superadmin_crud_entregas on public.entregas;
drop policy if exists superadmin_crud_itens_entrega on public.itens_entrega;
drop policy if exists superadmin_read_cestas_base on public.cestas_base;
drop policy if exists superadmin_read_cestas_base_itens on public.cestas_base_itens;
