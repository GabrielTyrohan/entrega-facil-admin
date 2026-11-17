-- =====================================================================
-- Fase 7 — Auditoria só de leitura para quem está logado
--
-- As políticas antigas de auditoria_acoes eram "FOR ALL": o dono (e o dev)
-- podiam alterar ou apagar o próprio histórico. Toda gravação legítima já
-- passa por funções SECURITY DEFINER (registrar_auditoria,
-- dev_registrar_auditoria, excluir_entrega_segura, importação fiscal), que
-- não dependem dessas políticas. Agora: só SELECT para os usuários.
-- =====================================================================

drop policy if exists "Admin acessa auditoria do proprio dominio" on public.auditoria_acoes;
drop policy if exists "Acesso unificado auditoria" on public.auditoria_acoes;
drop policy if exists superadmin_all on public.auditoria_acoes;

drop policy if exists auditoria_leitura_empresa on public.auditoria_acoes;
create policy auditoria_leitura_empresa on public.auditoria_acoes for select to authenticated
  using (administrador_id = auth.uid() or administrador_id = public.get_user_admin_id());

drop policy if exists auditoria_leitura_dev on public.auditoria_acoes;
create policy auditoria_leitura_dev on public.auditoria_acoes for select to authenticated
  using (public.is_super_admin());

revoke insert, update, delete, truncate on public.auditoria_acoes from anon, authenticated;
