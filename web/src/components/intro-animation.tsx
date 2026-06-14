"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const LETTERS = ["O", "R", "C", "U", "S"];

const LETTER_IN_STAGGER  = 90;
const LETTER_IN_DUR      = 700;
const HOLD_DURATION      = 350;
const LETTERS_IN_TOTAL   = LETTER_IN_STAGGER * (LETTERS.length - 1) + LETTER_IN_DUR + HOLD_DURATION;

const LETTER_OUT_STAGGER = 55;
const LETTER_OUT_DUR     = 400;

const CURTAIN_DELAY    = LETTERS_IN_TOTAL + 80;
const CURTAIN_DURATION = 1200;
const ANIM_TOTAL       = CURTAIN_DELAY + LETTER_OUT_STAGGER * (LETTERS.length - 1) + LETTER_OUT_DUR + 1200;

export const INTRO_DURATION_MS = CURTAIN_DELAY + CURTAIN_DURATION;
export const HERO_REVEAL_MS    = CURTAIN_DELAY + CURTAIN_DURATION - 150;

type Phase = "idle" | "in" | "out" | "done";

export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const [phase, setPhase]       = useState<Phase>("idle");
  const [curtainUp, setCurtainUp] = useState(false);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => {
    setMounted(true);
    const t0 = setTimeout(() => setPhase("in"),       80);
    const t1 = setTimeout(() => setPhase("out"),      LETTERS_IN_TOTAL);
    const t2 = setTimeout(() => setCurtainUp(true),   CURTAIN_DELAY);
    const t3 = setTimeout(() => onDone(),             HERO_REVEAL_MS);
    const t4 = setTimeout(() => setPhase("done"),     ANIM_TOTAL);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onDone]);

  if (phase === "done" || !mounted) return null;

  // Portal to document.body so it escapes any parent transform/opacity stacking context
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      {/* Light curtain - retracts upward */}
      <div
        style={{
          position: "absolute",
          insetInline: 0,
          top: 0,
          bottom: curtainUp ? "100%" : "0%",
          transition: curtainUp ? `bottom ${CURTAIN_DURATION}ms cubic-bezier(0.76, 0, 0.24, 1)` : "none",
          background: "#F5F4F0",
          zIndex: 1,
        }}
      />

      {/* ORCUS letters */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", gap: "0.04em" }}>
          {LETTERS.map((letter, i) => {
            const inDelay  = i * LETTER_IN_STAGGER;
            const outDelay = i * LETTER_OUT_STAGGER;

            const isIdle = phase === "idle";
            const isIn   = phase === "in";
            const isOut  = phase === "out";

            const opacity    = isIdle ? 0 : isIn ? 1 : 0;
            const blur       = isIdle ? 32 : isIn ? 0 : 20;
            const translateY = isIdle ? 40 : isIn ? 0 : -16;

            const transition = isOut
              ? `opacity ${LETTER_OUT_DUR}ms cubic-bezier(0.4,0,1,1) ${outDelay}ms, filter ${LETTER_OUT_DUR}ms cubic-bezier(0.4,0,1,1) ${outDelay}ms, transform ${LETTER_OUT_DUR}ms cubic-bezier(0.4,0,1,1) ${outDelay}ms`
              : isIn
              ? `opacity ${LETTER_IN_DUR}ms cubic-bezier(0.16,1,0.3,1) ${inDelay}ms, filter ${LETTER_IN_DUR}ms cubic-bezier(0.16,1,0.3,1) ${inDelay}ms, transform ${LETTER_IN_DUR}ms cubic-bezier(0.16,1,0.3,1) ${inDelay}ms`
              : "none";

            return (
              <span
                key={i}
                style={{
                  fontSize: `calc(min(100vw - 64px, 560px) / ${LETTERS.length})`,
                  fontFamily: "var(--font-ibm-plex), var(--font-geist-sans), system-ui, sans-serif",
                  fontWeight: 300,
                  letterSpacing: "0.18em",
                  color: "#111111",
                  lineHeight: 1,
                  userSelect: "none",
                  opacity,
                  filter: `blur(${blur}px)`,
                  transform: `translateY(${translateY}px)`,
                  transition,
                  willChange: "opacity, filter, transform",
                }}
              >
                {letter}
              </span>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
