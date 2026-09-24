import { useEffect, useRef } from 'react';

/**
 * Foco inicial + restauração para modais (sem focus trap).
 *
 * Ao abrir: move o foco para o primeiro campo/botão do painel ou,
 * na ausência destes, para o próprio painel (que deve ter tabIndex={-1}).
 * Ao fechar: devolve o foco ao elemento que abriu o modal, se ainda
 * estiver no documento.
 */
export function useModalFocus<T extends HTMLElement>(isOpen: boolean) {
  const panelRef = useRef<T | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    if (!panel) return;

    const firstFocusable = panel.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
    );

    const timer = window.setTimeout(() => {
      (firstFocusable ?? panel).focus({ preventScroll: true });
    }, 30);

    return () => {
      window.clearTimeout(timer);
      const opener = openerRef.current;
      if (opener && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  return panelRef;
}
