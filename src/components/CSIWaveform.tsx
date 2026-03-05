/*
 * CSI Waveform Visualization — Oscilloscope-style real-time display
 * Design: Dark background, light gray grid, white signal lines
 * No shadows, no gradients, no color — pure grayscale
 */

import { useEffect, useRef, useCallback } from 'react';
import type { CSIFrame } from '../utils/csiSimulator';

interface CSIWaveformProps {
  frames: CSIFrame[];
  width?: number;
  height?: number;
  className?: string;
}

export function CSIWaveform({ frames, className = '' }: CSIWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Background
    ctx.fillStyle = 'oklch(0.12 0 0)';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 0.5;

    const gridSpacingX = w / 16;
    const gridSpacingY = h / 8;

    for (let x = gridSpacingX; x < w; x += gridSpacingX) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = gridSpacingY; y < h; y += gridSpacingY) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    if (frames.length === 0) return;

    // Draw subcarrier lines (show last 5 frames as overlapping traces)
    const displayFrames = frames.slice(-8);
    
    displayFrames.forEach((frame, fi) => {
      const alpha = 0.1 + (fi / displayFrames.length) * 0.5;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = fi === displayFrames.length - 1 ? 1.5 : 0.8;

      ctx.beginPath();
      const subcarriers = frame.subcarriers;
      const step = w / (subcarriers.length - 1);

      for (let i = 0; i < subcarriers.length; i++) {
        const x = i * step;
        const y = h * (1 - subcarriers[i]) * 0.8 + h * 0.1;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          // Smooth curve
          const prevX = (i - 1) * step;
          const prevY = h * (1 - subcarriers[i - 1]) * 0.8 + h * 0.1;
          const cpX = (prevX + x) / 2;
          ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
        }
      }
      ctx.stroke();
    });

    // Axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('Subcarrier Index', w / 2 - 40, h - 6);
    
    ctx.save();
    ctx.translate(12, h / 2 + 20);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Amplitude', 0, 0);
    ctx.restore();

    // Subcarrier index markers
    for (let i = 0; i <= 64; i += 16) {
      const x = (i / 64) * w;
      ctx.fillText(String(i), x + 2, h - 16);
    }

  }, [frames]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ display: 'block' }}
    />
  );
}
