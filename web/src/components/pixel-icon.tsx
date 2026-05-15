"use client";

import { useEffect, useRef } from "react";

type IconType = "platform" | "agents" | "workflow" | "integrations" | "pricing" | "security" | "devex";

interface PixelIconProps {
  type: IconType;
  size?: number;
}

function drawPlatform(ctx: CanvasRenderingContext2D, W: number, t: number) {
  const cx = W / 2, cy = W / 2;
  const r  = W * 0.36;
  const ps = W / 12;

  const pulse = 0.6 + 0.4 * Math.sin(t * 0.003);
  ctx.fillStyle = `rgba(0,0,0,${pulse})`;
  const cs = ps * 1.4;
  ctx.fillRect(cx - cs / 2, cy - cs / 2, cs, cs);

  const nodeCount = 6;
  for (let i = 0; i < nodeCount; i++) {
    const angle = (i / nodeCount) * Math.PI * 2 + t * 0.0015;
    const nx = cx + Math.cos(angle) * r;
    const ny = cy + Math.sin(angle) * r;
    const opacity = 0.3 + 0.5 * ((Math.sin(angle * 2 + t * 0.002) + 1) / 2);
    ctx.fillStyle = `rgba(0,0,0,${opacity})`;
    ctx.fillRect(Math.round(nx / ps) * ps - ps / 2, Math.round(ny / ps) * ps - ps / 2, ps, ps);

    const steps = 5;
    for (let s = 1; s < steps; s++) {
      const lx = cx + (nx - cx) * (s / steps);
      const ly = cy + (ny - cy) * (s / steps);
      const lo = (0.06 + 0.1 * (s / steps)) * pulse;
      ctx.fillStyle = `rgba(0,0,0,${lo})`;
      ctx.fillRect(Math.round(lx / ps) * ps, Math.round(ly / ps) * ps, ps * 0.7, ps * 0.7);
    }
  }
}

const AGENT_FRAMES: number[][][] = [
  [
    [0,0,1,1,1,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,0,0,1,1,0],
    [0,1,1,0,0,1,1,0],
    [0,0,1,0,0,1,0,0],
    [0,0,1,0,0,1,0,0],
  ],
  [
    [0,0,1,1,1,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,0,1,1,1,0,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,1,0],
  ],
  [
    [0,0,1,1,1,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,0,0,1,1,0],
    [0,1,1,0,0,1,1,0],
    [0,0,1,0,0,1,0,0],
    [0,0,1,0,0,1,0,0],
  ],
  [
    [0,0,1,1,1,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,0,0,1,1,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,1,0],
  ],
];

function drawAgents(ctx: CanvasRenderingContext2D, W: number, t: number) {
  const fps      = 6;
  const frameIdx = Math.floor(t / (1000 / fps)) % AGENT_FRAMES.length;
  const frame    = AGENT_FRAMES[frameIdx];
  const rows     = frame.length;
  const cols     = frame[0].length;
  const ps       = Math.floor(W / cols);
  const offX     = Math.floor((W - cols * ps) / 2);
  const offY     = Math.floor((W - rows * ps) / 2);
  const bobY     = Math.sin(t * 0.012) * ps * 0.4;

  frame.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell) return;
      const opacity = 0.5 + 0.5 * Math.sin(t * 0.001 + r * 0.3);
      ctx.fillStyle = `rgba(0,0,0,${opacity})`;
      ctx.fillRect(offX + c * ps, offY + r * ps + bobY, ps - 1, ps - 1);
    });
  });
}

function drawWorkflow(ctx: CanvasRenderingContext2D, W: number, t: number) {
  const ps   = Math.floor(W / 12);
  const cx   = W / 2;
  const cy   = W / 2;

  const shape = [
    [1,1,1,1,1,1,1],
    [0,1,1,1,1,1,0],
    [0,0,1,1,1,0,0],
    [0,0,0,1,0,0,0],
    [0,0,1,1,1,0,0],
    [0,1,1,1,1,1,0],
    [1,1,1,1,1,1,1],
  ];

  const rows = shape.length;
  const cols = shape[0].length;
  const offX = cx - (cols * ps) / 2;
  const offY = cy - (rows * ps) / 2;

  const period = 2400;
  const fill   = (t % period) / period;

  shape.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell) return;
      const isTopHalf = r < rows / 2;
      const isMid     = r === Math.floor(rows / 2);
      let sandAlpha: number;

      if (isTopHalf) {
        const rowFill = 1 - Math.min(1, fill * rows * 1.4 - r);
        sandAlpha = Math.max(0, rowFill);
      } else if (isMid) {
        sandAlpha = 0.5 + 0.4 * Math.sin(t * 0.008);
      } else {
        const rowFromCenter = r - Math.floor(rows / 2);
        const rowFill = Math.min(1, fill * rows * 1.4 - rowFromCenter);
        sandAlpha = Math.max(0, rowFill);
      }

      const baseAlpha = 0.12;
      const alpha = Math.max(baseAlpha, sandAlpha * 0.85);
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(offX + c * ps, offY + r * ps, ps - 1, ps - 1);
    });
  });
}

function drawIntegrations(ctx: CanvasRenderingContext2D, W: number, t: number) {
  const cols = 5, rows = 4;
  const ps   = Math.floor(W / (cols + 1));
  const gap  = 2;
  const offX = Math.floor((W - cols * (ps + gap)) / 2);
  const offY = Math.floor((W - rows * (ps + gap)) / 2);
  const total = cols * rows;
  const wave = (t * 0.0008);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx   = r * cols + c;
      const phase = idx / total * Math.PI * 2;
      const alpha = 0.1 + 0.65 * ((Math.sin(wave + phase) + 1) / 2);
      const x     = offX + c * (ps + gap);
      const y     = offY + r * (ps + gap);
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(x, y, ps, ps);
    }
  }
}

function drawSecurity(ctx: CanvasRenderingContext2D, W: number, t: number) {
  const ps = Math.floor(W / 9);
  const pulse = 0.45 + 0.55 * Math.sin(t * 0.0018);
  const ripple = 0.15 + 0.15 * Math.sin(t * 0.003);

  const shield = [
    [0,0,1,1,1,0,0],
    [0,1,1,1,1,1,0],
    [0,1,1,1,1,1,0],
    [0,1,1,0,1,1,0],
    [0,0,1,0,1,0,0],
    [0,0,0,1,0,0,0],
    [0,0,0,0,0,0,0],
  ];
  const rows = shield.length;
  const cols = shield[0].length;
  const offX = Math.floor((W - cols * ps) / 2);
  const offY = Math.floor((W - rows * ps) / 2) - ps;

  shield.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell) return;
      const alpha = ripple + pulse * 0.75;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(offX + c * ps, offY + r * ps, ps - 1, ps - 1);
    });
  });

  // keyhole dot
  const kx = offX + 3 * ps;
  const ky = offY + 3 * ps;
  ctx.fillStyle = `rgba(0,0,0,${pulse})`;
  ctx.fillRect(kx, ky, ps - 1, ps - 1);
}

function drawDevEx(ctx: CanvasRenderingContext2D, W: number, t: number) {
  const ps = Math.floor(W / 14);
  const lineH = Math.floor(ps * 2);
  const lines = [
    { len: 7, indent: 0 },
    { len: 4, indent: 2 },
    { len: 9, indent: 0 },
    { len: 3, indent: 2 },
    { len: 6, indent: 1 },
  ];

  const totalH = lines.length * lineH;
  const offY = Math.floor((W - totalH) / 2);
  const scanX = ((t * 0.04) % (W * 1.2)) - W * 0.1;

  lines.forEach((line, r) => {
    const y = offY + r * lineH;
    const startX = ps * (1 + line.indent);
    for (let c = 0; c < line.len; c++) {
      const px = startX + c * (ps + 1);
      const dist = Math.abs(px - scanX);
      const glow = Math.max(0, 1 - dist / (W * 0.35));
      const alpha = 0.1 + 0.75 * glow;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(px, y, ps, Math.floor(ps * 0.55));
    }
  });
}

function drawPricing(ctx: CanvasRenderingContext2D, W: number, t: number) {
  const ps    = Math.floor(W / 12);
  const bars  = 3;
  const bw    = ps * 2;
  const gap   = ps;
  const total = bars * bw + (bars - 1) * gap;
  const offX  = Math.floor((W - total) / 2);
  const maxH  = W * 0.7;
  const heights = [0.45, 0.75, 0.55];
  const wave = Math.sin(t * 0.0015) * 0.12;

  heights.forEach((h, i) => {
    const animated = Math.max(0.1, h + wave * (i % 2 === 0 ? 1 : -1));
    const bh = animated * maxH;
    const x  = offX + i * (bw + gap);
    const y  = W - bh - ps;
    const rowCount = Math.floor(bh / ps);
    for (let row = 0; row < rowCount; row++) {
      const progress = 1 - row / rowCount;
      const alpha    = 0.15 + progress * 0.7;
      ctx.fillStyle  = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(x, y + row * ps, bw, ps - 1);
    }
  });
}

export function PixelIcon({ type, size = 40 }: PixelIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = size * dpr;
      canvas.height = size * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;

      switch (type) {
        case "platform":     drawPlatform(ctx, size, t);     break;
        case "agents":       drawAgents(ctx, size, t);       break;
        case "workflow":     drawWorkflow(ctx, size, t);     break;
        case "integrations": drawIntegrations(ctx, size, t); break;
        case "pricing":      drawPricing(ctx, size, t);      break;
        case "security":     drawSecurity(ctx, size, t);     break;
        case "devex":        drawDevEx(ctx, size, t);         break;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [type, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, imageRendering: "pixelated", display: "block", flexShrink: 0 }}
    />
  );
}
