import { useEffect, useRef, useState } from 'react';

interface UseCountUpOptions {
  target: number;       // valor final
  duration?: number;    // duração em ms (padrão 1200)
  enabled?: boolean;    // se false, retorna target direto sem animar
}

export function useCountUp({ target, duration = 1200, enabled = true }: UseCountUpOptions): number {
  const [current, setCurrent] = useState(enabled ? 0 : target);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Se animação desabilitada ou target ainda não chegou, retorna direto
    if (!enabled || target === 0) {
      setCurrent(target);
      return;
    }

    // Easing easeOutQuart — acelerado no início, suave no final
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);

      setCurrent(Math.round(target * easedProgress));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setCurrent(target); // garante valor exato no final
      }
    };

    startTimeRef.current = null;
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, enabled]);

  return current;
}

// Controla se a animação já foi exibida nesta sessão de login.
// Usa uma variável de módulo (não localStorage) para persistir apenas
// enquanto a aba estiver aberta. Ao fechar/relogar, reseta automaticamente.
let _animationPlayedThisSession = false;

export function useDashboardAnimationFlag() {
  const shouldAnimate = !_animationPlayedThisSession;

  function markAsPlayed() {
    _animationPlayedThisSession = true;
  }

  return { shouldAnimate, markAsPlayed };
}
