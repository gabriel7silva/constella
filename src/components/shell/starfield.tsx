"use client";

import { useEffect, useRef } from "react";

/**
 * Animated themed background — stars, constellations & a black hole.
 * Ported from the prototype; reads the active theme from <html> class.
 * Sits behind all content (z-index 0); content surfaces are translucent.
 */
export function Starfield({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!enabled) return; // animations off → no canvas, no requestAnimationFrame loop (GPU savings)
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0, raf = 0;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    // Respect reduced-motion: dampen all movement/rotation/pulse to a near-still drift.
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const M = reduce ? 0.18 : 1; // global motion scale
    type Star = { x: number; y: number; r: number; tw: number; tws: number; vx: number; vy: number; hue: string };
    let stars: Star[] = [];

    const isLight = () => document.documentElement.classList.contains("theme-light");

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      cv!.width = W * DPR; cv!.height = H * DPR;
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      const count = Math.round((W * H) / 9000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        // brighter, slightly larger stars; wider twinkle-speed spread so some pulse fast, some slow.
        r: Math.random() * 1.6 + 0.4, tw: Math.random() * Math.PI * 2, tws: 0.4 + Math.random() * 2.6,
        vx: (Math.random() - 0.5) * 0.14, vy: (Math.random() - 0.5) * 0.14,
        hue: Math.random() < 0.25 ? "blue" : Math.random() < 0.15 ? "violet" : "white",
      }));
    }
    window.addEventListener("resize", resize);

    const bh = { fx: 0.82, fy: 0.22, R: 0 };

    function draw(t: number) {
      const light = isLight();
      bh.R = Math.min(W, H) * 0.13;
      const bx = W * bh.fx, by = H * bh.fy;
      const g = ctx!.createRadialGradient(bx, by, bh.R * 0.4, W * 0.4, H * 0.6, Math.max(W, H));
      if (light) { g.addColorStop(0, "#e7e2d5"); g.addColorStop(0.5, "#e9e4d8"); g.addColorStop(1, "#ded7c6"); }
      else { g.addColorStop(0, "#0a0f1e"); g.addColorStop(0.55, "#070a14"); g.addColorStop(1, "#05060d"); }
      ctx!.fillStyle = g; ctx!.fillRect(0, 0, W, H);

      const sa = light ? 0.34 : 0.95;
      for (const s of stars) {
        s.x += s.vx * M; s.y += s.vy * M;
        if (s.x < 0) s.x += W; else if (s.x > W) s.x -= W;
        if (s.y < 0) s.y += H; else if (s.y > H) s.y -= H;
        // faster twinkle base (0.0016 vs 0.001) × per-star speed; stronger pulse range.
        const tw = 0.5 + 0.5 * Math.sin(t * 0.0016 * (reduce ? 0.5 : 1) * s.tws + s.tw);
        const a = sa * (0.2 + 0.8 * tw);
        const col = light
          ? s.hue === "blue" ? "100,120,180" : s.hue === "violet" ? "130,110,180" : "90,95,120"
          : s.hue === "blue" ? "150,190,255" : s.hue === "violet" ? "190,160,255" : "230,238,255";
        // soft bloom on the brightest stars (pulsing glow) — a faint larger halo behind the core.
        if (!light && tw > 0.72) {
          ctx!.beginPath(); ctx!.fillStyle = `rgba(${col},${a * 0.22})`;
          ctx!.arc(s.x, s.y, s.r * (2.4 + tw), 0, Math.PI * 2); ctx!.fill();
        }
        ctx!.beginPath(); ctx!.fillStyle = `rgba(${col},${a})`;
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx!.fill();
      }

      ctx!.lineWidth = 1;
      const maxD2 = 118 * 118;
      for (let i = 0; i < stars.length; i++) for (let j = i + 1; j < stars.length; j++) {
        const dx = stars[i].x - stars[j].x, dy = stars[i].y - stars[j].y, d2 = dx * dx + dy * dy;
        if (d2 < maxD2) {
          const a = (1 - d2 / maxD2) * (light ? 0.06 : 0.14);
          ctx!.strokeStyle = light ? `rgba(90,100,140,${a})` : `rgba(120,150,230,${a})`;
          ctx!.beginPath(); ctx!.moveTo(stars[i].x, stars[i].y); ctx!.lineTo(stars[j].x, stars[j].y); ctx!.stroke();
        }
      }

      // ~3× faster spin; the accretion disk + halo "breathe" with a slow sine so it feels alive.
      const rot = t * 0.0005 * M;
      const breathe = 0.85 + 0.15 * Math.sin(t * 0.0011 * (reduce ? 0.4 : 1));
      const haloR = bh.R * 2.6 * breathe;
      const halo = ctx!.createRadialGradient(bx, by, bh.R * 0.5, bx, by, haloR);
      halo.addColorStop(0, light ? `rgba(120,90,200,${0.26 * breathe})` : `rgba(140,95,255,${0.34 * breathe})`);
      halo.addColorStop(0.5, light ? "rgba(90,120,200,0.11)" : "rgba(70,100,235,0.16)");
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = halo; ctx!.beginPath(); ctx!.arc(bx, by, haloR, 0, Math.PI * 2); ctx!.fill();

      ctx!.save(); ctx!.translate(bx, by); ctx!.rotate(-0.5); ctx!.scale(1, 0.34);
      for (let k = 0; k < 3; k++) {
        const rr = bh.R * (1.5 + k * 0.28);
        ctx!.lineWidth = bh.R * (0.3 - k * 0.07);
        const ga = (ctx as CanvasRenderingContext2D & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient }).createConicGradient?.(rot + k * 0.4, 0, 0);
        if (ga) {
          ga.addColorStop(0, "rgba(255,170,80,0)");
          ga.addColorStop(0.12, light ? "rgba(235,145,60,0.6)" : "rgba(255,190,100,0.98)");
          ga.addColorStop(0.28, light ? "rgba(190,125,235,0.5)" : "rgba(215,160,255,0.85)");
          ga.addColorStop(0.5, "rgba(120,140,255,0)");
          ga.addColorStop(0.72, light ? "rgba(120,160,230,0.45)" : "rgba(130,180,255,0.78)");
          ga.addColorStop(1, "rgba(255,170,80,0)");
          ctx!.strokeStyle = ga;
        } else ctx!.strokeStyle = light ? "rgba(200,150,255,0.4)" : "rgba(255,180,120,0.6)";
        ctx!.beginPath(); ctx!.arc(0, 0, rr, 0, Math.PI * 2); ctx!.stroke();
      }
      ctx!.restore();

      ctx!.beginPath(); ctx!.fillStyle = light ? "rgba(20,18,40,0.92)" : "#000";
      ctx!.arc(bx, by, bh.R, 0, Math.PI * 2); ctx!.fill();
      // event-horizon rim glows brighter on the breathe pulse.
      ctx!.lineWidth = 2.4; ctx!.strokeStyle = light ? `rgba(185,155,255,${0.55 + 0.35 * breathe})` : `rgba(205,185,255,${0.6 + 0.35 * breathe})`;
      ctx!.beginPath(); ctx!.arc(bx, by, bh.R * 1.02, 0, Math.PI * 2); ctx!.stroke();

      raf = requestAnimationFrame(draw);
    }

    resize();
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [enabled]);

  // Animations off → a cheap static background (no canvas, no requestAnimationFrame).
  if (!enabled) return <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "var(--bg-app)" }} />;
  return <canvas ref={ref} aria-hidden style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }} />;
}
