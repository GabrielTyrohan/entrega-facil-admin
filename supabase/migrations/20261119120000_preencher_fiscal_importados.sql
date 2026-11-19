-- =====================================================================
-- Preenchimento fiscal automático (opcional) dos produtos criados pela
-- Sincronização Fiscal (importar_produtos_fiscal_lote_seguro).
--
-- A importação cria os produtos com todos os campos fiscais nulos. Quando o
-- usuário marca "Preencher campos fiscais automaticamente", o front chama esta
-- função logo depois da gravação. Ela:
--   * copia da planilha de referência (snapshot guardado no item do lote):
--     NCM, CEST, CFOP, CSOSN (0500 -> 500), CST e alíquota de PIS/COFINS
--     (prefere os de saída);
--   * aplica a sugestão de IBS/CBS pelo NCM (tabela fiscal_ibscbs_ncm), igual à
--     sugestão inicial da fase 6d;
--   * só preenche campo vazio: nunca sobrescreve o que já foi informado;
--   * não valida: o produto continua pendente até alguém conferir e validar
--     na Revisão fiscal;
--   * ignora produto já validado ou que não veio de importação.
-- =====================================================================

create or replace function public.preencher_fiscal_importados(p_produto_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_admin uuid;
  v_preenchidos integer := 0;
  v_ids_preenchidos uuid[];
  v_usuario_tipo text;
  v_usuario_nome text;
begin
  if v_user is null then
    raise exception 'Autenticação obrigatória' using errcode = '42501';
  end if;
  if not coalesce(public.can_manage_produtos(), false) then
    raise exception 'Sem permissão para alterar a parte fiscal dos produtos' using errcode = '42501';
  end if;
  v_admin := public.get_user_admin_id();
  if v_admin is null then
    raise exception 'Usuário não vinculado a uma empresa' using errcode = '42501';
  end if;
  if p_produto_ids is null or array_length(p_produto_ids, 1) is null then
    raise exception 'Informe pelo menos 1 produto' using errcode = '22023';
  end if;
  if array_length(p_produto_ids, 1) > 2000 then
    raise exception 'No máximo 2000 produtos por vez' using errcode = '22023';
  end if;

  with ref as (
    select p.id,
           regexp_replace(coalesce(i.snapshot_referencia->>'ncm', ''), '\D', '', 'g')           as ncm,
           regexp_replace(coalesce(i.snapshot_referencia->>'cest', ''), '\D', '', 'g')          as cest,
           regexp_replace(coalesce(i.snapshot_referencia->>'cfop_descricao', ''), '\D', '', 'g') as cfop,
           regexp_replace(coalesce(i.snapshot_referencia->>'cst_icms', ''), '\D', '', 'g')      as csosn,
           coalesce(nullif(btrim(i.snapshot_referencia->>'cst_pis_saida'), ''),
                    nullif(btrim(i.snapshot_referencia->>'cst_pis'), ''))                       as cst_pis,
           coalesce(i.snapshot_referencia->>'aliquota_pis_saida',
                    i.snapshot_referencia->>'aliquota_pis')                                     as aliq_pis,
           coalesce(nullif(btrim(i.snapshot_referencia->>'cst_cofins_saida'), ''),
                    nullif(btrim(i.snapshot_referencia->>'cst_cofins'), ''))                    as cst_cofins,
           coalesce(i.snapshot_referencia->>'aliquota_cofins_saida',
                    i.snapshot_referencia->>'aliquota_cofins')                                  as aliq_cofins
      from public.produtos_cadastrado p
      join public.itens_importacao_produtos_fiscal i
        on i.produto_id = p.id and i.administrador_id = v_admin
     where p.id = any(p_produto_ids)
       and p.administrador_id = v_admin
       and p.importacao_id is not null
       and p.fiscal_status is distinct from 'validado'
  ),
  novo as (
    select r.id,
           -- NCM do produto (se já tiver) ou da referência, só com 8 dígitos
           coalesce(nullif(regexp_replace(coalesce(p.ncm, ''), '\D', '', 'g'), ''),
                    case when length(r.ncm) = 8 then r.ncm end)                               as ncm,
           case when length(r.cest) = 7 then r.cest end                                       as cest,
           case when length(r.cfop) = 4 then r.cfop end                                       as cfop,
           case when length(r.csosn) = 3 then r.csosn
                when length(r.csosn) = 4 and left(r.csosn, 1) = '0' then right(r.csosn, 3) end as csosn,
           r.cst_pis, r.cst_cofins,
           case when r.aliq_pis ~ '^-?\d+(\.\d+)?$' then r.aliq_pis::numeric end               as aliq_pis,
           case when r.aliq_cofins ~ '^-?\d+(\.\d+)?$' then r.aliq_cofins::numeric end         as aliq_cofins
      from ref r
      join public.produtos_cadastrado p on p.id = r.id
  ),
  com_ibscbs as (
    select n.*,
           case when length(coalesce(n.ncm, '')) = 8 then
             case when t.sugestao = 'verificar' then null else coalesce(t.cst, '000') end end      as cst_ibscbs,
           case when length(coalesce(n.ncm, '')) = 8 then
             case when t.sugestao = 'verificar' then null else coalesce(t.cclasstrib, '000001') end end as cclasstrib,
           case when length(coalesce(n.ncm, '')) = 8 then coalesce(t.sugestao, 'padrao') end      as sugestao
      from novo n
      left join public.fiscal_ibscbs_ncm t on t.ncm = n.ncm
  ),
  upd as (
    update public.produtos_cadastrado p set
      ncm             = coalesce(nullif(btrim(p.ncm), ''), c.ncm),
      cest            = coalesce(nullif(btrim(p.cest), ''), c.cest),
      cfop_padrao     = coalesce(nullif(btrim(p.cfop_padrao), ''), c.cfop),
      cst_icms        = coalesce(nullif(btrim(p.cst_icms), ''), c.csosn),
      cst_pis         = coalesce(nullif(btrim(p.cst_pis), ''), c.cst_pis),
      aliquota_pis    = case when nullif(btrim(p.cst_pis), '') is null and c.cst_pis is not null
                             then coalesce(p.aliquota_pis, c.aliq_pis) else p.aliquota_pis end,
      cst_cofins      = coalesce(nullif(btrim(p.cst_cofins), ''), c.cst_cofins),
      aliquota_cofins = case when nullif(btrim(p.cst_cofins), '') is null and c.cst_cofins is not null
                             then coalesce(p.aliquota_cofins, c.aliq_cofins) else p.aliquota_cofins end,
      cst_ibscbs      = case when p.cst_ibscbs is null and p.cclasstrib is null then c.cst_ibscbs else p.cst_ibscbs end,
      cclasstrib      = case when p.cst_ibscbs is null and p.cclasstrib is null then c.cclasstrib else p.cclasstrib end,
      ibscbs_sugestao = case when p.cst_ibscbs is null and p.cclasstrib is null and c.sugestao is not null
                             then c.sugestao else p.ibscbs_sugestao end,
      updated_at      = now()
    from com_ibscbs c
    where p.id = c.id
    returning p.id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids_preenchidos from upd;

  v_preenchidos := coalesce(array_length(v_ids_preenchidos, 1), 0);

  if v_preenchidos > 0 then
    if v_user = v_admin then
      v_usuario_tipo := 'admin';
      select coalesce(nullif(a.nome, ''), nullif(a.nome_empresa, ''), 'Administrador')
        into v_usuario_nome from public.administradores a where a.id = v_admin;
    else
      v_usuario_tipo := 'funcionario';
      select coalesce(nullif(f.nome, ''), 'Funcionário')
        into v_usuario_nome
        from public.funcionarios f
       where f.auth_user_id = v_user and f.administrador_id = v_admin
       limit 1;
    end if;

    insert into public.auditoria_acoes (
      administrador_id, usuario_id, usuario_tipo, usuario_nome, usuario_email,
      acao, entidade, entidade_id, dados_novos, observacao
    ) values (
      v_admin, v_user, v_usuario_tipo,
      coalesce(nullif(v_usuario_nome, ''), auth.jwt() ->> 'email', 'Usuário autenticado'),
      coalesce(auth.jwt() ->> 'email', 'nao-disponivel'),
      'preenchimento_fiscal_automatico', 'produtos_cadastrado', null,
      jsonb_build_object('total_preenchidos', v_preenchidos, 'produto_ids', to_jsonb(v_ids_preenchidos)),
      'Campos fiscais copiados da planilha de referência e sugestão IBS/CBS por NCM, a pedido do usuário. '
        || 'Produtos continuam pendentes de revisão fiscal.'
    );
  end if;

  return jsonb_build_object(
    'preenchidos', v_preenchidos,
    'ignorados', array_length(p_produto_ids, 1) - v_preenchidos
  );
end;
$$;

revoke all on function public.preencher_fiscal_importados(uuid[]) from public, anon;
grant execute on function public.preencher_fiscal_importados(uuid[]) to authenticated, service_role;
