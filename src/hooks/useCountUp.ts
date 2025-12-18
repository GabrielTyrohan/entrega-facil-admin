import { useEffect, useState } from 'react';

interface UseCountUpOptions {
  end: number;
  duration?: number;
  decimals?: number;
  start?: number;
}

export const useCountUp = ({
  end,
  duration = 2000,
  decimals = 2,
  start = 0,
}: UseCountUpOptions) => {
  const [count, setCount] = useState(start);
  const frameRate = 1000 / 60; // 60 FPS
  const totalFrames = Math.round(duration / frameRate);

  useEffect(() => {
    let frame = 0;
    // Se end for 0 ou undefined, não anima ou anima para 0
    const finalEnd = end || 0;
    
    if (start === finalEnd) {
        setCount(finalEnd);
        return;
    }

    const counter = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;

      // Easing suave (desacelera no final)
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const newValue = start + (finalEnd - start) * easedProgress;

      setCount(newValue);

      if (frame >= totalFrames) {
        clearInterval(counter);
        setCount(finalEnd); // Garante valor exato
      }
    }, frameRate);

    return () => clearInterval(counter);
  }, [end, duration, start, decimals, totalFrames]);

  return count.toFixed(decimals);
};
