-- =====================================================================
-- Fase 6e — Fiscal Contora: webhook, consumo de notas e limpeza
--
-- * contora_webhook: o webhook da conta (um só), com o segredo usado para
--   conferir a assinatura HMAC. Só o servidor lê (RLS sem política).
-- * contora_webhook_eventos: cada entrega recebida, sem duplicar
--   (delivery_id), com o resultado do processamento.
-- * contora_consumo: último consumo lido da API por empresa (para o dono e
--   para o superadmin verem sem chamar a Contora toda hora).
-- * Limpeza: certificado antigo (Nuvem Fiscal) vencido marcado como
--   configurado e empresa em "producao" sem estar na Contora.
-- =====================================================================

create table if not exists public.contora_webhook (
  id smallint primary key default 1 check (id = 1),
  contora_endpoint_id text,
  url text not null,
  secret text not null,
  events text[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contora_webhook enable row level security;
-- Sem políticas: só service_role (Edge Functions) acessa o segredo.

create table if not exists public.contora_webhook_eventos (
  id bigint generated always as identity primary key,
  delivery_id text unique,
  evento text,
  documento_id text,
  company_id text,
  administrador_id uuid references public.administradores(id) on delete set null,
  payload jsonb,
  assinatura_ok boolean not null default false,
  processado boolean not null default false,
  erro text,
  recebido_em timestamptz not null default now()
);

create index if not exists idx_contora_webhook_eventos_doc on public.contora_webhook_eventos (documento_id);

alter table public.contora_webhook_eventos enable row level security;

drop policy if exists contora_webhook_eventos_leitura on public.contora_webhook_eventos;
create policy contora_webhook_eventos_leitura on public.contora_webhook_eventos for select to authenticated
  using (public.is_super_admin() or administrador_id = auth.uid());

create table if not exists public.contora_consumo (
  administrador_id uuid primary key references public.administradores(id) on delete cascade,
  limite integer,
  usados integer,
  restantes integer,
  uso_percentual numeric(6,2),
  aviso text,                 -- none | attention | critical | blocked
  saldo_carteira numeric(12,2),
  eventos_empresa integer,    -- eventos deste CNPJ (quando a API informa)
  detalhe jsonb,
  atualizado_em timestamptz not null default now()
);

alter table public.contora_consumo enable row level security;

drop policy if exists contora_consumo_leitura on public.contora_consumo;
create policy contora_consumo_leitura on public.contora_consumo for select to authenticated
  using (
    public.is_super_admin()
    or administrador_id = auth.uid()
    or exists (
      select 1 from public.funcionarios f
      where f.auth_user_id = auth.uid() and f.administrador_id = contora_consumo.administrador_id
        and f.ativo = true and coalesce(f.bloqueado, false) = false
    )
  );


-- ---------------------------------------------------------------------
-- Limpeza dos dados fiscais antigos
-- ---------------------------------------------------------------------
-- Certificado vencido que não está na Contora (era da Nuvem Fiscal)
update public.administradores
set nfe_certificado_configurado = false,
    nfe_certificado_validade = null,
    nfe_certificado_nome = null,
    nfe_certificado_documento = null
where coalesce(nfe_contora_has_certificate, false) = false
  and nfe_certificado_configurado = true
  and (nfe_certificado_validade is null or nfe_certificado_validade < current_date);

-- Nenhuma empresa está liberada para produção na Contora ainda
update public.administradores
set nfe_ambiente = 'homologacao'
where nfe_ambiente = 'producao'
  and nfe_contora_company_id is null;

-- Status coerente com o que existe de verdade
update public.administradores
set nfe_integracao_status = 'nao_configurada'
where nfe_contora_company_id is null
  and nfe_integracao_status is distinct from 'nao_configurada';
