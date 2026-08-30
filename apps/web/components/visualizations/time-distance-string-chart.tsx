'use client';
import React, { useRef, useEffect } from 'react';

export function TimeDistanceStringChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background
    ctx.fillStyle = '#0f172a'; // dark slate
    ctx.fillRect(0, 0, width, height);

    // Draw Grid Lines (Time X-axis, Distance Y-axis)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 24; i++) {
      const x = (i / 24) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      const y = (i / 5) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw a mock block
    ctx.fillStyle = 'rgba(244, 63, 94, 0.2)'; // Rose-500 transparent
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    // from 10:00 to 14:00, station 1 to 2
    const startX = (10 / 24) * width;
    const endX = (14 / 24) * width;
    const startY = (1 / 5) * height;
    const endY = (2 / 5) * height;
    ctx.fillRect(startX, startY, endX - startX, endY - startY);
    ctx.strokeRect(startX, startY, endX - startX, endY - startY);

    // Draw mock train paths (Strings)
    ctx.strokeStyle = '#3b82f6'; // Blue for express
    ctx.beginPath();
    ctx.moveTo((8 / 24) * width, 0);
    ctx.lineTo((12 / 24) * width, height);
    ctx.stroke();

    ctx.strokeStyle = '#94a3b8'; // Slate for freight
    ctx.beginPath();
    ctx.moveTo((13 / 24) * width, height);
    ctx.lineTo((18 / 24) * width, 0);
    ctx.stroke();
  }, []);

  return (
    <div className="flex-1 w-full relative overflow-hidden bg-slate-900 flex flex-col p-4">
      <div className="absolute left-4 top-4 text-xs font-mono text-muted-foreground flex flex-col justify-between h-[calc(100%-2rem)]">
        <span>Station A (0km)</span>
        <span>Station B (50km)</span>
        <span>Station C (100km)</span>
        <span>Station D (150km)</span>
        <span>Station E (200km)</span>
        <span>Station F (250km)</span>
      </div>
      <div className="ml-32 flex-1 border border-slate-700 bg-slate-900 rounded relative">
        <canvas
          ref={canvasRef}
          width={1200}
          height={600}
          className="w-full h-full block"
        />
      </div>
      <div className="ml-32 mt-2 text-xs font-mono text-muted-foreground flex justify-between px-2">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}
