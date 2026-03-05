import { useEffect, useRef } from 'react';

interface WaveCanvasProps {
  className?: string;
  lineCount?: number;
  opacity?: number;
  speed?: number;
  color?: string;
}

export function WaveCanvas({
  className = '',
  lineCount = 5,
  opacity = 0.08,
  speed = 0.003,
  color = '38, 38, 38',
}: WaveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < lineCount; i++) {
        const baseY = h * (0.2 + (i * 0.6) / lineCount);
        const amplitude = 20 + i * 8;
        const frequency = 0.008 + i * 0.002;
        const phase = time * (1 + i * 0.3);

        ctx.beginPath();
        ctx.strokeStyle = `rgba(${color}, ${opacity - i * 0.01})`;
        ctx.lineWidth = 1;

        for (let x = 0; x < w; x++) {
          const y =
            baseY +
            Math.sin(x * frequency + phase) * amplitude +
            Math.sin(x * frequency * 2.3 + phase * 0.7) * (amplitude * 0.3) +
            Math.cos(x * frequency * 0.5 + phase * 1.3) * (amplitude * 0.2);

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
      }

      time += speed;
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [lineCount, opacity, speed, color]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  );
}
