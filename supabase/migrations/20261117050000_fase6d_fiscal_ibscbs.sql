-- =====================================================================
-- Fase 6d — Fiscal: reforma tributária (IBS/CBS) e revisão em lote
--
-- * Produto ganha CST IBS/CBS e cClassTrib (com a origem da sugestão).
-- * Regras ficam em TABELA, não no código:
--     fiscal_ibscbs_vigencia  — a partir de quando o grupo é exigido por CRT
--                               (Simples/MEI: 04/01/2027; regime normal: 2026)
--     fiscal_ibscbs_aliquotas — alíquotas de referência por ano (só 2026
--                               cadastrado; 2027+ entra quando for publicado)
--     fiscal_ibscbs_ncm       — sugestão por NCM (Cesta Básica Nacional,
--                               Anexo I LC 214/2025 → CST 200 / 200003)
--   ATENÇÃO: códigos de sugestão vieram de fontes não oficiais e precisam
--   ser conferidos na tabela oficial (SVRS) e pelo contador. Nada é
--   validado automaticamente.
-- * atualizar_fiscal_lote: edita e (opcionalmente) valida vários produtos.
-- * ibscbs_item_payload: monta o bloco "ibscbs" do item da NF-e quando
--   exigido (a Edge Function emitir-nfe-contora chama).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Campos no produto
-- ---------------------------------------------------------------------
alter table public.produtos_cadastrado add column if not exists cst_ibscbs text;
alter table public.produtos_cadastrado add column if not exists cclasstrib text;
-- De onde veio o preenchimento: cesta_basica | padrao | verificar | manual
alter table public.produtos_cadastrado add column if not exists ibscbs_sugestao text;

alter table public.produtos_cadastrado drop constraint if exists produtos_cadastrado_cst_ibscbs_check;
alter table public.produtos_cadastrado add constraint produtos_cadastrado_cst_ibscbs_check
  check (cst_ibscbs is null or cst_ibscbs in ('000', '200', '410', '510', '515', '550'));
alter table public.produtos_cadastrado drop constraint if exists produtos_cadastrado_cclasstrib_check;
alter table public.produtos_cadastrado add constraint produtos_cadastrado_cclasstrib_check
  check (cclasstrib is null or cclasstrib ~ '^\d{6}$');


-- ---------------------------------------------------------------------
-- 2. Regras em tabela
-- ---------------------------------------------------------------------
create table if not exists public.fiscal_ibscbs_vigencia (
  crt smallint primary key,            -- 1 Simples, 2 Simples excesso, 3 Normal, 4 MEI
  exigido_a_partir date not null,
  fonte text,
  updated_at timestamptz not null default now()
);

insert into public.fiscal_ibscbs_vigencia (crt, exigido_a_partir, fonte) values
  (1, '2027-01-04', 'NT 2025.002 (regra do grupo IBS/CBS para CRT 1 em produção a partir de 04/01/2027); LC 214/2025 art. 348'),
  (2, '2026-01-01', 'NT 2025.002 — conferir com o contador'),
  (3, '2026-01-01', 'NT 2025.002 — regime normal'),
  (4, '2027-01-04', 'NT 2025.002 (CRT 4 junto com o Simples)')
on conflict (crt) do nothing;

create table if not exists public.fiscal_ibscbs_aliquotas (
  ano smallint primary key,
  ibs_uf numeric(7,4) not null,
  ibs_mun numeric(7,4) not null,
  cbs numeric(7,4) not null,
  fonte text,
  updated_at timestamptz not null default now()
);

insert into public.fiscal_ibscbs_aliquotas (ano, ibs_uf, ibs_mun, cbs, fonte) values
  (2026, 0.1, 0, 0.9, 'LC 214/2025 — ano de teste (IBS 0,1% estadual, CBS 0,9%)')
on conflict (ano) do nothing;

create table if not exists public.fiscal_ibscbs_ncm (
  ncm text primary key check (ncm ~ '^\d{8}$'),
  cst text check (cst is null or cst in ('000', '200', '410', '510', '515', '550')),
  cclasstrib text check (cclasstrib is null or cclasstrib ~ '^\d{6}$'),
  reducao_percentual numeric(5,2) not null default 0 check (reducao_percentual between 0 and 100),
  sugestao text not null,              -- cesta_basica | verificar
  descricao text,
  base_legal text,
  fonte text
);

alter table public.fiscal_ibscbs_vigencia enable row level security;
alter table public.fiscal_ibscbs_aliquotas enable row level security;
alter table public.fiscal_ibscbs_ncm enable row level security;

drop policy if exists fiscal_ibscbs_vigencia_leitura on public.fiscal_ibscbs_vigencia;
create policy fiscal_ibscbs_vigencia_leitura on public.fiscal_ibscbs_vigencia for select to authenticated using (true);
drop policy if exists fiscal_ibscbs_aliquotas_leitura on public.fiscal_ibscbs_aliquotas;
create policy fiscal_ibscbs_aliquotas_leitura on public.fiscal_ibscbs_aliquotas for select to authenticated using (true);
drop policy if exists fiscal_ibscbs_ncm_leitura on public.fiscal_ibscbs_ncm;
create policy fiscal_ibscbs_ncm_leitura on public.fiscal_ibscbs_ncm for select to authenticated using (true);

-- Cesta Básica Nacional (Anexo I da LC 214/2025): redução de 100% (alíquota zero)
insert into public.fiscal_ibscbs_ncm (ncm, cst, cclasstrib, reducao_percentual, sugestao, descricao, base_legal, fonte)
select n, '200', '200003', 100, 'cesta_basica', 'Cesta Básica Nacional de Alimentos',
       'LC 214/2025, art. 125 e Anexo I', 'buscadorncm.com.br/reforma/cesta-basica (não oficial — conferir)'
from unnest(array[
  -- arroz
  '10062010','10062020','10063011','10063019','10063021','10063029','10064000',
  -- leite e leite em pó
  '04011010','04011090','04012010','04012090','04014010','04015010',
  '04021010','04021090','04022110','04022120','04022910','04022920',
  -- fórmulas infantis
  '19011010','19011090',
  -- manteiga e margarina
  '04051000','15171000',
  -- feijões
  '07133319','07133329','07133399','07133590',
  -- café
  '09011110','09011190','09011200','09012100','09012200','09019000','21011110','21011190','21011200',
  -- óleo de babaçu, mandioca/tapioca, milho
  '15132120','11062000','19030000','11022000','11031300','11041900','11042300',
  -- trigo, açúcar, massas, aveia
  '11010010','17011400','17019900','19021100','19021900','11041200','11042200','11029000',
  -- pão francês (pré-mistura)
  '19012010','19012090',
  -- carnes bovina, suína, ovina/caprina
  '02011000','02012010','02012020','02012090','02013000','02021000','02022010','02022020','02022090','02023000',
  '02031100','02031200','02031900','02032100','02032200','02032900',
  '02041000','02042100','02042200','02042300','02043000','02044100','02044200','02044300','02045000',
  -- miudezas
  '02061000','02062100','02062200','02062910','02062990','02063000','02064100','02064900','02068000','02069000',
  -- aves
  '02071100','02071210','02071220','02071300','02071411','02071412','02071413','02071419','02071421','02071422',
  '02071423','02071424','02071429','02071431','02071432','02071433','02071434','02071439','02072400','02072500',
  '02072600','02072700','02074100','02074200','02074400','02074500','02075100','02075200','02075400','02075500',
  '02076000',
  -- toucinho e salgados/defumados
  '02091011','02091019','02091021','02091029','02099000',
  '02101100','02101200','02101900','02102000','02109911','02109919','02109920','02109990',
  -- peixes frescos/refrigerados
  '03022100','03022200','03022300','03022400','03022900','03024100','03024210','03024290','03024300','03024400',
  '03024500','03024600','03024700','03024910','03024990','03025400','03025500','03025600','03025900','03027100',
  '03027210','03027290','03027300','03027400','03027900','03028100','03028200','03028310','03028320','03028400',
  '03028500','03028910','03028921','03028922','03028923','03028924','03028931','03028932','03028933','03028934',
  '03028935','03028936','03028937','03028938','03028941','03028942','03028943','03028944','03028945','03028990',
  -- peixes congelados
  '03032300','03032410','03032490','03032500','03032600','03032900','03033100','03033200','03033300','03033400',
  '03033900','03035100','03035300','03035400','03035500','03035600','03035700','03035910','03035920','03035990',
  '03036600','03036700','03036800','03036910','03036990','03038111','03038112','03038113','03038114','03038119',
  '03038190','03038200','03038311','03038319','03038321','03038329','03038400','03038910','03038920','03038932',
  '03038933','03038941','03038942','03038943','03038944','03038945','03038946','03038951','03038952','03038953',
  '03038954','03038955','03038956','03038961','03038962','03038963','03038964','03038965','03038990',
  -- filés
  '03043100','03043210','03043290','03043300','03043900','03046100','03046210','03046290','03046300','03046900',
  -- queijos, sal, mate
  '04061010','04061090','04062000','04069010','04069020','04069030',
  '25010020','25010090','09030010','09030090'
]) as n
on conflict (ncm) do nothing;

-- NCMs que só entram na cesta conforme a descrição do produto: revisar à mão
insert into public.fiscal_ibscbs_ncm (ncm, cst, cclasstrib, reducao_percentual, sugestao, descricao, base_legal, fonte) values
  ('19059090', null, null, 0, 'verificar', 'Só o pão francês está na Cesta Básica; demais produtos não', 'LC 214/2025, Anexo I', 'conferir'),
  ('21069090', null, null, 0, 'verificar', 'Só fórmulas infantis/dietoterápicas estão na Cesta Básica', 'LC 214/2025, Anexo I', 'conferir'),
  ('19019090', null, null, 0, 'verificar', 'Só farinha com baixo teor de proteína está na Cesta Básica', 'LC 214/2025, Anexo I', 'conferir')
on conflict (ncm) do nothing;


-- ---------------------------------------------------------------------
-- 3. Sugestão inicial nos produtos (só onde ainda está vazio)
-- ---------------------------------------------------------------------
update public.produtos_cadastrado p
set cst_ibscbs = case when r.sugestao = 'verificar' then null else coalesce(r.cst, '000') end,
    cclasstrib = case when r.sugestao = 'verificar' then null else coalesce(r.cclasstrib, '000001') end,
    ibscbs_sugestao = coalesce(r.sugestao, 'padrao')
from (
  select pc.id, n.cst, n.cclasstrib, n.sugestao
  from public.produtos_cadastrado pc
  left join public.fiscal_ibscbs_ncm n on n.ncm = regexp_replace(coalesce(pc.ncm, ''), '\D', '', 'g')
  where pc.cst_ibscbs is null and pc.ibscbs_sugestao is null
    and length(regexp_replace(coalesce(pc.ncm, ''), '\D', '', 'g')) = 8
) r
where p.id = r.id;


-- ---------------------------------------------------------------------
-- 4. Pendências fiscais de um produto (uma regra só para tudo)
-- ---------------------------------------------------------------------
create or replace function public.fiscal_pendencias_produto(p public.produtos_cadastrado)
returns text[]
language sql
immutable
set search_path = public
as $$
  select array_remove(array[
    case when length(regexp_replace(coalesce(p.ncm, ''), '\D', '', 'g')) <> 8 then 'NCM com 8 dígitos' end,
    case when length(regexp_replace(coalesce(p.cfop_padrao, ''), '\D', '', 'g')) <> 4 then 'CFOP com 4 dígitos' end,
    case when nullif(btrim(p.cst_icms), '') is null then 'CST/CSOSN ICMS' end,
    case when nullif(btrim(p.cst_pis), '') is null then 'CST PIS' end,
    case when nullif(btrim(p.cst_cofins), '') is null then 'CST COFINS' end,
    case when p.cst_ibscbs is null then 'CST IBS/CBS' end,
    case when p.cclasstrib is null then 'cClassTrib' end
  ], null);
$$;

-- Validação individual passa a exigir também IBS/CBS
create or replace function public.definir_status_fiscal_produto(p_produto_id uuid, p_status text)
 RETURNS TABLE(produto_id uuid, fiscal_status text, fiscal_validado_em timestamp with time zone, fiscal_validado_por uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_admin_id uuid;
  v_produto public.produtos_cadastrado%rowtype;
  v_pend text[];
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória';
  end if;

  if p_status not in ('pendente_revisao', 'em_revisao', 'validado', 'bloqueado') then
    raise exception 'Status fiscal inválido';
  end if;

  if not coalesce(public.can_manage_produtos(), false) then
    raise exception 'Usuário sem permissão para gerenciar produtos';
  end if;

  v_admin_id := public.get_user_admin_id();
  if v_admin_id is null then
    raise exception 'Usuário não vinculado a uma empresa';
  end if;

  select * into v_produto
  from public.produtos_cadastrado p
  where p.id = p_produto_id and p.administrador_id = v_admin_id
  for update;

  if not found then
    raise exception 'Produto não encontrado nesta empresa';
  end if;

  if p_status = 'validado' then
    v_pend := public.fiscal_pendencias_produto(v_produto);
    if array_length(v_pend, 1) > 0 then
      raise exception 'Antes de validar, preencha: %', array_to_string(v_pend, ', ');
    end if;
  end if;

  return query
  update public.produtos_cadastrado p
  set fiscal_status = p_status,
      fiscal_validado_em = case when p_status = 'validado' then now() else null end,
      fiscal_validado_por = case when p_status = 'validado' then auth.uid() else null end
  where p.id = p_produto_id and p.administrador_id = v_admin_id
  returning p.id, p.fiscal_status, p.fiscal_validado_em, p.fiscal_validado_por;
end;
$function$;


-- ---------------------------------------------------------------------
-- 5. Revisão em lote
--    p_campos: só as chaves enviadas mudam (string vazia = limpar).
--    p_validar: depois de aplicar, tenta validar cada produto; os que têm
--    pendência voltam na lista de erros e ficam pendentes.
-- ---------------------------------------------------------------------
create or replace function public.atualizar_fiscal_lote(p_ids uuid[], p_campos jsonb, p_validar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_permitidos text[] := array['ncm','cest','cfop_padrao','cst_icms','cst_pis','aliquota_pis','cst_cofins','aliquota_cofins','origem_mercadoria','cst_ibscbs','cclasstrib'];
  v_chave text;
  v_p public.produtos_cadastrado%rowtype;
  v_pend text[];
  v_atualizados integer := 0;
  v_validados integer := 0;
  v_erros jsonb := '[]'::jsonb;
  v_mudou_fiscal boolean;
  c jsonb := coalesce(p_campos, '{}'::jsonb);
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória' using errcode = '42501';
  end if;
  if not coalesce(public.can_manage_produtos(), false) then
    raise exception 'Sem permissão para revisar a parte fiscal dos produtos' using errcode = '42501';
  end if;
  v_admin := public.get_user_admin_id();
  if v_admin is null then
    raise exception 'Usuário não vinculado a uma empresa' using errcode = '42501';
  end if;
  if p_ids is null or array_length(p_ids, 1) is null then
    raise exception 'Selecione pelo menos 1 produto' using errcode = '22023';
  end if;
  if array_length(p_ids, 1) > 2000 then
    raise exception 'No máximo 2000 produtos por vez' using errcode = '22023';
  end if;

  for v_chave in select jsonb_object_keys(c) loop
    if not v_chave = any(v_permitidos) then
      raise exception 'Campo não permitido na revisão em lote: %', v_chave using errcode = '22023';
    end if;
  end loop;

  v_mudou_fiscal := c <> '{}'::jsonb;

  if v_mudou_fiscal then
    update public.produtos_cadastrado p set
      ncm               = case when c ? 'ncm' then nullif(regexp_replace(c->>'ncm', '\D', '', 'g'), '') else p.ncm end,
      cest              = case when c ? 'cest' then nullif(regexp_replace(c->>'cest', '\D', '', 'g'), '') else p.cest end,
      cfop_padrao       = case when c ? 'cfop_padrao' then nullif(regexp_replace(c->>'cfop_padrao', '\D', '', 'g'), '') else p.cfop_padrao end,
      cst_icms          = case when c ? 'cst_icms' then nullif(btrim(c->>'cst_icms'), '') else p.cst_icms end,
      cst_pis           = case when c ? 'cst_pis' then nullif(btrim(c->>'cst_pis'), '') else p.cst_pis end,
      aliquota_pis      = case when c ? 'aliquota_pis' then nullif(c->>'aliquota_pis', '')::numeric else p.aliquota_pis end,
      cst_cofins        = case when c ? 'cst_cofins' then nullif(btrim(c->>'cst_cofins'), '') else p.cst_cofins end,
      aliquota_cofins   = case when c ? 'aliquota_cofins' then nullif(c->>'aliquota_cofins', '')::numeric else p.aliquota_cofins end,
      origem_mercadoria = case when c ? 'origem_mercadoria' then nullif(c->>'origem_mercadoria', '')::smallint else p.origem_mercadoria end,
      cst_ibscbs        = case when c ? 'cst_ibscbs' then nullif(btrim(c->>'cst_ibscbs'), '') else p.cst_ibscbs end,
      cclasstrib        = case when c ? 'cclasstrib' then nullif(regexp_replace(c->>'cclasstrib', '\D', '', 'g'), '') else p.cclasstrib end,
      ibscbs_sugestao   = case when c ? 'cst_ibscbs' or c ? 'cclasstrib' then 'manual' else p.ibscbs_sugestao end,
      -- Mudou a parte fiscal: precisa ser validado de novo
      fiscal_status      = case when p.fiscal_status = 'validado' then 'pendente_revisao' else p.fiscal_status end,
      fiscal_validado_em = case when p.fiscal_status = 'validado' then null else p.fiscal_validado_em end,
      fiscal_validado_por= case when p.fiscal_status = 'validado' then null else p.fiscal_validado_por end,
      updated_at = now()
    where p.id = any(p_ids) and p.administrador_id = v_admin;
    get diagnostics v_atualizados = row_count;
  end if;

  if p_validar then
    for v_p in
      select * from public.produtos_cadastrado
      where id = any(p_ids) and administrador_id = v_admin
      for update
    loop
      v_pend := public.fiscal_pendencias_produto(v_p);
      if array_length(v_pend, 1) > 0 then
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
          'id', v_p.id, 'nome', v_p.produto_nome, 'faltando', to_jsonb(v_pend)));
      elsif v_p.fiscal_status is distinct from 'validado' then
        update public.produtos_cadastrado
           set fiscal_status = 'validado', fiscal_validado_em = now(), fiscal_validado_por = auth.uid()
         where id = v_p.id;
        v_validados := v_validados + 1;
      end if;
    end loop;
  end if;

  return jsonb_build_object('atualizados', v_atualizados, 'validados', v_validados, 'erros', v_erros);
end;
$$;

revoke all on function public.atualizar_fiscal_lote(uuid[], jsonb, boolean) from public, anon;
grant execute on function public.atualizar_fiscal_lote(uuid[], jsonb, boolean) to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 6. Bloco "ibscbs" do item da NF-e (Fiscal Contora)
--    Retorna null quando o grupo ainda não é exigido para o CRT da empresa.
--    Erro claro quando é exigido e falta algo (produto ou alíquota do ano).
-- ---------------------------------------------------------------------
create or replace function public.ibscbs_exigido(p_crt smallint, p_data date)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((select p_data >= v.exigido_a_partir from public.fiscal_ibscbs_vigencia v where v.crt = p_crt), true);
$$;

create or replace function public.ibscbs_item_payload(p_administrador_id uuid, p_produto_id uuid, p_data date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_crt smallint;
  v_p record;
  v_a record;
  v_red numeric := 0;
  v_fator numeric;
begin
  select coalesce(a.nfe_regime_tributario, 1)::smallint into v_crt
  from public.administradores a where a.id = p_administrador_id;
  if v_crt is null then
    raise exception 'Empresa não encontrada' using errcode = 'P0002';
  end if;

  if not public.ibscbs_exigido(v_crt, p_data) then
    return null;
  end if;

  select pc.produto_nome, pc.cst_ibscbs, pc.cclasstrib, pc.ncm into v_p
  from public.produtos_cadastrado pc
  where pc.id = p_produto_id and pc.administrador_id = p_administrador_id;
  if not found then
    raise exception 'Produto não encontrado nesta empresa' using errcode = 'P0002';
  end if;
  if v_p.cst_ibscbs is null or v_p.cclasstrib is null then
    raise exception 'IBS/CBS obrigatório: preencha CST IBS/CBS e cClassTrib de "%"', v_p.produto_nome using errcode = '22023';
  end if;

  -- CST 410 (imunidade/não incidência): só CST e classificação
  if v_p.cst_ibscbs = '410' then
    return jsonb_build_object('cst', v_p.cst_ibscbs, 'classification_code', v_p.cclasstrib);
  end if;

  select * into v_a from public.fiscal_ibscbs_aliquotas where ano = extract(year from p_data)::smallint;
  if not found then
    raise exception 'Alíquotas de IBS/CBS de % não cadastradas (conferir com o contador)', extract(year from p_data)::int
      using errcode = '22023';
  end if;

  -- Redução por NCM (ex.: Cesta Básica 100%) quando a classificação é a da tabela
  select coalesce(n.reducao_percentual, 0) into v_red
  from public.fiscal_ibscbs_ncm n
  where n.ncm = regexp_replace(coalesce(v_p.ncm, ''), '\D', '', 'g')
    and n.cclasstrib = v_p.cclasstrib;
  v_fator := 1 - coalesce(v_red, 0) / 100;

  return jsonb_build_object(
    'cst', v_p.cst_ibscbs,
    'classification_code', v_p.cclasstrib,
    'state_rate', round(v_a.ibs_uf * v_fator, 4),
    'municipal_rate', round(v_a.ibs_mun * v_fator, 4),
    'cbs_rate', round(v_a.cbs * v_fator, 4)
  );
end;
$$;

revoke all on function public.ibscbs_item_payload(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.ibscbs_item_payload(uuid, uuid, date) to service_role;
