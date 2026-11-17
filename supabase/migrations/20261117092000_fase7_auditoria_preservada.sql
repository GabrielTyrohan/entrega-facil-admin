-- =====================================================================
-- Fase 7 — Apagar uma empresa não apaga o histórico de auditoria dela
-- A chave auditoria_acoes.administrador_id era ON DELETE CASCADE.
-- =====================================================================

alter table public.auditoria_acoes alter column administrador_id drop not null;
alter table public.auditoria_acoes drop constraint if exists auditoria_acoes_administrador_id_fkey;
alter table public.auditoria_acoes add constraint auditoria_acoes_administrador_id_fkey
  foreign key (administrador_id) references public.administradores(id) on delete set null;
