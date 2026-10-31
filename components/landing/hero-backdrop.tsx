"use client";

import { useEffect, useRef } from "react";

/** Layered, slowly moving gradient behind the landing hero: drifting color
 * fields, faint light streaks, a spotlight that follows the pointer, and
 * fine grain to keep the gradients from banding. Styles live in
 * globals.css under "Hero backdrop". */
export function HeroBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="hero-backdrop pointer-events-none absolute inset-0 overflow-hidden">
      <div className="hero-aurora">
        <span className="hero-blob hero-blob-1" />
        <span className="hero-blob hero-blob-2" />
        <span className="hero-blob hero-blob-3" />
        <span className="hero-blob hero-blob-4" />
      </div>
      <div className="hero-streaks" />
      <div className="hero-spotlight" />
      <div className="hero-grain" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
