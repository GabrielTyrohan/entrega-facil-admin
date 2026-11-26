-- Valida o formato dos códigos fiscais antes de marcar o produto como validado.
--
-- Teste com a Contora em 26/11/2026: um produto validado tinha CSOSN '0500'
-- (origem grudada no código) e PIS/COFINS '1'. A regra antiga só conferia se
-- o campo estava preenchido, e a Contora recusou a NF-e
-- ("CSOSN '0500' não existe").
--
-- Agora fiscal_pendencias_produto (usada por definir_status_fiscal_produto e
-- atualizar_fiscal_lote) aceita só:
--   - ICMS: CSOSN do Simples (101, 102, 103, 201, 202, 203, 300, 400, 500, 900)
--     ou CST de 2 dígitos (00, 02, 10, 15, 20, 30, 40, 41, 50, 51, 53, 60, 61, 70, 90);
--   - PIS e COFINS: CST de 2 dígitos da tabela oficial.
-- Produtos já validados não mudam de status; a emissão (emitir-nfe-contora)
-- também confere o formato e mostra um erro claro.

create or replace function public.fiscal_pendencias_produto(p public.produtos_cadastrado)
returns text[]
language sql
immutable
set search_path = public
as $$
  select array_remove(array[
    case when length(regexp_replace(coalesce(p.ncm, ''), '\D', '', 'g')) <> 8 then 'NCM com 8 dígitos' end,
    case when length(regexp_replace(coalesce(p.cfop_padrao, ''), '\D', '', 'g')) <> 4 then 'CFOP com 4 dígitos' end,
    case
      when nullif(btrim(p.cst_icms), '') is null then 'CST/CSOSN ICMS'
      when btrim(p.cst_icms) not in (
        '101','102','103','201','202','203','300','400','500','900',
        '00','02','10','15','20','30','40','41','50','51','53','60','61','70','90'
      ) then 'CST/CSOSN ICMS válido (sem a origem na frente)'
    end,
    case
      when nullif(btrim(p.cst_pis), '') is null then 'CST PIS'
      when btrim(p.cst_pis) not in (
        '01','02','03','04','05','06','07','08','09',
        '49','50','51','52','53','54','55','56',
        '60','61','62','63','64','65','66','67',
        '70','71','72','73','74','75','98','99'
      ) then 'CST PIS válido (2 dígitos)'
    end,
    case
      when nullif(btrim(p.cst_cofins), '') is null then 'CST COFINS'
      when btrim(p.cst_cofins) not in (
        '01','02','03','04','05','06','07','08','09',
        '49','50','51','52','53','54','55','56',
        '60','61','62','63','64','65','66','67',
        '70','71','72','73','74','75','98','99'
      ) then 'CST COFINS válido (2 dígitos)'
    end,
    case when p.cst_ibscbs is null then 'CST IBS/CBS' end,
    case when p.cclasstrib is null then 'cClassTrib' end
  ], null);
$$;

revoke all on function public.fiscal_pendencias_produto(public.produtos_cadastrado) from public, anon;
grant execute on function public.fiscal_pendencias_produto(public.produtos_cadastrado) to authenticated, service_role;
