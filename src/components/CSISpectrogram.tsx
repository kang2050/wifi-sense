/*
 * CSI Spectrogram — Heatmap-style visualization of CSI data over time
 * X-axis: time, Y-axis: subcarrier index, Color: amplitude (grayscale)
 */

import { useEffect, useRef, useCallback } from 'react';
import type { CSIFrame } from '../utils/csiSimulator';

interface CSISpectrogramProps {
  frames: CSIFrame[];
  maxFrames?: number;
  className?: string;
}

export function CSISpectrogram({ frames, maxFrames = 100, className = '' }: CSISpectrogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    if (frames.length === 0) return;

    const displayFrames = frames.slice(-maxFrames);
    const cellW = w / maxFrames;
    const cellH = h / 64;

    displayFrames.forEach((frame, fi) => {
      const x = fi * cellW;
      frame.subcarriers.forEach((amp, si) => {
        const y = si * cellH;
        const brightness = Math.floor(amp * 255);
        ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
        ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);
      });
    });

    // Grid overlay
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('Time →', w - 50, h - 6);
    
    ctx.save();
    ctx.translate(12, h / 2 + 30);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Subcarrier ↑', 0, 0);
    ctx.restore();

  }, [frames, maxFrames]);

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
