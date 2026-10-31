"use client";

import { useEffect, useState } from "react";

// A tiny ASCII karateka running through a kata. Every frame is the same
// size, so the figure moves in place without the layout shifting.

const FRAMES = {
  bow: [
    "               ",
    "      __O      ",
    "        |\\     ",
    "        |      ",
    "       / \\     ",
    "      /   \\    ",
  ],
  ready: [
    "       O       ",
    "      /|\\      ",
    "     o | o     ",
    "       |       ",
    "      / \\      ",
    "     /   \\     ",
  ],
  block: [
    "    o  O       ",
    "     \\/|\\      ",
    "       | o     ",
    "       |       ",
    "      / \\      ",
    "     /   \\     ",
  ],
  punch: [
    "       O       ",
    "      /|_____o ",
    "     o |       ",
    "       |       ",
    "      / \\      ",
    "     /   \\     ",
  ],
  chamber: [
    "       O       ",
    "     o/|\\o     ",
    "       |__     ",
    "       |  |    ",
    "       |       ",
    "      /        ",
  ],
  kick: [
    "       O       ",
    "     o/|\\o     ",
    "       |       ",
    "       |\\____o ",
    "       |       ",
    "      /        ",
  ],
} as const;

type Pose = keyof typeof FRAMES;

/** [pose, milliseconds to hold it] */
const SEQUENCE: [Pose, number][] = [
  ["bow", 1400],
  ["ready", 900],
  ["block", 450],
  ["punch", 600],
  ["ready", 500],
  ["chamber", 350],
  ["kick", 650],
  ["chamber", 300],
  ["ready", 500],
  ["punch", 600],
  ["ready", 1200],
];

const GROUND = "  ___________  ";

export function KataFigure({ className }: { className?: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

    let timer: ReturnType<typeof setTimeout>;
    let current = 0;
    const advance = () => {
      timer = setTimeout(() => {
        // Don't animate a tab nobody is looking at.
        if (!document.hidden) {
          current = (current + 1) % SEQUENCE.length;
          setStep(current);
        }
        advance();
      }, SEQUENCE[current][1]);
    };
    advance();
    return () => clearTimeout(timer);
  }, []);

  const pose = SEQUENCE[step][0];
  return (
    <pre
      role="img"
      aria-label="An ASCII martial artist practicing a kata"
      className={className}
    >
      {[...FRAMES[pose], GROUND].join("\n")}
    </pre>
  );
}
