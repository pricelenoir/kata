/** Layered, slowly moving backdrop behind the landing hero: drifting color
 * fields, a streaked band of light rising from the horizon, and a faint
 * circuit board — packages, bused traces, parts — whose traces carry
 * signal pulses. Styles live in globals.css under "Hero backdrop". */

// ---- Circuit board ------------------------------------------------------------

// Drawn in a 1600×700 box anchored to the bottom of the hero; the main
// package sits on the horizon under the brightest part of the light.
const W = 1600;
const H = 700;

/** Deterministic pseudo-random numbers, so server and client render the
 * same board. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

interface Pkg {
  x: number; // center
  top: number; // y of the top edge
  w: number;
  h: number;
  buses: number;
  bga?: boolean;
}

// The main die sits at the center of the horizon, under the light's core;
// smaller packages spread the board to both edges.
const PACKAGES: Pkg[] = [
  { x: 800, top: 590, w: 320, h: 150, buses: 14 },
  { x: 150, top: 640, w: 150, h: 90, buses: 6, bga: true },
  { x: 470, top: 625, w: 150, h: 90, buses: 6, bga: true },
  { x: 1130, top: 625, w: 150, h: 90, buses: 6, bga: true },
  { x: 1450, top: 640, w: 150, h: 90, buses: 6, bga: true },
];

const SPACING = 6;
const CHAMFER = 22;

interface Line {
  d: string;
  end: [number, number];
}

interface Board {
  lines: Line[];
  signals: { d: string; duration: number; delay: number; warm: boolean }[];
  parts: [number, number, boolean][]; // x, y, vertical
  balls: [number, number][];
}

/** Parallel buses fanning out of each package's top edge: up, a 45° turn
 * toward the nearer side, a horizontal run, a second 45° turn, and a climb
 * up into the light, ending in a staggered row of vias. Outer buses turn
 * lower and sooner so no two buses cross. */
function buildBoard(): Board {
  const rand = rng(23);
  const board: Board = { lines: [], signals: [], parts: [], balls: [] };

  for (const pkg of PACKAGES) {
    const left = pkg.x - pkg.w / 2;
    const half = Math.ceil(pkg.buses / 2);
    for (let b = 0; b < pkg.buses; b++) {
      const m = 4 + Math.floor(rand() * 5); // traces in this bus
      const x0 = left + 16 + (b / Math.max(1, pkg.buses - 1)) * (pkg.w - 32 - m * SPACING);
      const toLeft = b < half;
      const dx = toLeft ? -1 : 1;
      const rank = toLeft ? b : pkg.buses - 1 - b; // 0 = outermost
      const y1 = pkg.top - 20 - rank * (m * SPACING + 12) - rand() * 8;
      const run = 40 + (half - rank) * 34 + rand() * 60;
      const climb = 120 + rand() * 300 + (half - rank) * 20;
      const maxO = (m - 1) * SPACING;
      const busLines: string[] = [];
      let topY = 0;
      for (let j = 0; j < m; j++) {
        const x = x0 + j * SPACING;
        // The trace on the outside of the first turn turns highest.
        const o = (toLeft ? j : m - 1 - j) * SPACING;
        const yTurn = y1 - o;
        const yRun = yTurn - CHAMFER;
        // ...and the lowest trace runs furthest before the second turn.
        const xTurn2 = x + dx * (CHAMFER + run + (maxO - o));
        const xUp = xTurn2 + dx * CHAMFER;
        const yEnd = yRun - CHAMFER - climb - (j % 2) * 10;
        const d = `M${x},${pkg.top} V${yTurn} L${x + dx * CHAMFER},${yRun} H${xTurn2} L${xUp},${yRun - CHAMFER} V${yEnd}`;
        board.lines.push({ d, end: [xUp, yEnd] });
        busLines.push(d);
        topY = Math.min(topY || yEnd, yEnd);
      }
      if (rand() < 0.5) {
        const px = x0 + dx * (CHAMFER * 2 + run + maxO + 30);
        board.parts.push([px, topY - 20 - rand() * 30, rand() < 0.5]);
      }
      for (const j of [Math.floor(rand() * m), ...(rand() < 0.5 ? [Math.floor(rand() * m)] : [])]) {
        board.signals.push({ d: busLines[j], duration: 4 + rand() * 6, delay: -rand() * 10, warm: rand() < 0.3 });
      }
    }
    if (pkg.bga) {
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 7; c++) {
          board.balls.push([left + 20 + c * ((pkg.w - 40) / 6), pkg.top + 18 + r * 16]);
        }
      }
    }
  }
  return board;
}

const BOARD = buildBoard();

function CircuitBoard() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="hero-circuit" fill="none">
      <g className="hero-circuit-traces">
        {BOARD.lines.map((l, i) => (
          <path key={i} d={l.d} />
        ))}
      </g>
      <g className="hero-circuit-vias">
        {BOARD.lines.map((l, i) => (
          <circle key={i} cx={l.end[0]} cy={l.end[1]} r={2.6} />
        ))}
      </g>
      <g className="hero-circuit-parts">
        {BOARD.parts.map(([x, y, vertical], i) =>
          vertical ? (
            <g key={i}>
              <rect x={x - 3} y={y - 9} width={6} height={6} />
              <rect x={x - 3} y={y + 3} width={6} height={6} />
            </g>
          ) : (
            <g key={i}>
              <rect x={x - 9} y={y - 3} width={6} height={6} />
              <rect x={x + 3} y={y - 3} width={6} height={6} />
            </g>
          ),
        )}
      </g>
      <g className="hero-circuit-packages">
        {PACKAGES.map((p) => (
          <g key={p.x}>
            <rect x={p.x - p.w / 2} y={p.top} width={p.w} height={p.h} rx={8} />
            {!p.bga && (
              <rect
                x={p.x - p.w * 0.28}
                y={p.top + p.h * 0.22}
                width={p.w * 0.56}
                height={p.h * 0.5}
                rx={3}
                className="hero-circuit-die"
              />
            )}
          </g>
        ))}
        {BOARD.balls.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} />
        ))}
      </g>
      {["hero-signal-glow", ""].map((extra) => (
        <g key={extra || "core"}>
          {BOARD.signals.map((t, i) => (
            <path
              key={i}
              d={t.d}
              pathLength={1000}
              className={`hero-signal ${t.warm ? "hero-signal-warm" : ""} ${extra}`}
              style={{ animationDuration: `${t.duration}s`, animationDelay: `${t.delay}s` }}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="hero-aurora">
        <span className="hero-blob hero-blob-1" />
        <span className="hero-blob hero-blob-2" />
        <span className="hero-blob hero-blob-3" />
        <span className="hero-blob hero-blob-4" />
      </div>
      <div className="hero-beam" />
      <div className="hero-streaks-mask">
        <div className="hero-streaks" />
      </div>
      <div className="hero-flare" />
      <div className="hero-scrim" />
      <CircuitBoard />
      <div className="hero-grain" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
