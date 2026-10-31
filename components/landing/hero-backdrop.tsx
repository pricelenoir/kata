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

const PACKAGES: Pkg[] = [
  { x: 960, top: 600, w: 300, h: 140, buses: 12 },
  { x: 250, top: 640, w: 170, h: 100, buses: 5, bga: true },
  { x: 1480, top: 630, w: 170, h: 100, buses: 5, bga: true },
];

const SPACING = 6;
const CHAMFER = 26;

interface Line {
  d: string;
  end: [number, number];
}

interface Board {
  lines: Line[];
  signals: { d: string; duration: number; delay: number; warm: boolean }[];
  pins: [number, number, number][]; // x1, x2, y
  parts: [number, number, boolean][]; // x, y, vertical
  balls: [number, number][];
}

/** Parallel buses fanning out of each package's top edge: up, a 45° turn
 * toward the nearer side, a long horizontal run, and a staggered row of
 * vias. Buses nearer the package's edge turn lower so none of them cross. */
function buildBoard(): Board {
  const rand = rng(11);
  const board: Board = { lines: [], signals: [], pins: [], parts: [], balls: [] };

  for (const pkg of PACKAGES) {
    const left = pkg.x - pkg.w / 2;
    const half = Math.ceil(pkg.buses / 2);
    for (let b = 0; b < pkg.buses; b++) {
      const m = 4 + Math.floor(rand() * 5); // traces in this bus
      const x0 = left + 18 + (b / Math.max(1, pkg.buses - 1)) * (pkg.w - 36 - m * SPACING);
      const toLeft = b < half;
      const dx = toLeft ? -1 : 1;
      const rank = toLeft ? b : pkg.buses - 1 - b; // 0 = outermost
      const y1 = pkg.top - 24 - rank * (m * SPACING + 16) - rand() * 10;
      const run = 120 + rand() * 360 + (half - rank) * 30;
      const busLines: string[] = [];
      for (let j = 0; j < m; j++) {
        const x = x0 + j * SPACING;
        // The trace on the outside of the turn turns highest.
        const o = (toLeft ? j : m - 1 - j) * SPACING;
        const yTurn = y1 - o;
        const yRun = yTurn - CHAMFER;
        const xEnd = x + dx * (CHAMFER + run + (j % 2) * 12);
        const d = `M${x},${pkg.top} V${yTurn} L${x + dx * CHAMFER},${yRun} H${xEnd}`;
        board.lines.push({ d, end: [xEnd, yRun] });
        board.pins.push([x, x, pkg.top]);
        busLines.push(d);
      }
      // A part or two sits beyond the end of some buses.
      if (rand() < 0.6) {
        const lastY = y1 - (m - 1) * SPACING - CHAMFER;
        board.parts.push([x0 + dx * (CHAMFER + run + 40), lastY + rand() * 20, rand() < 0.4]);
      }
      // One or two traces per bus carry a signal.
      for (const j of [Math.floor(rand() * m), ...(rand() < 0.5 ? [Math.floor(rand() * m)] : [])]) {
        board.signals.push({
          d: busLines[j],
          duration: 4 + rand() * 6,
          delay: -rand() * 10,
          warm: rand() < 0.3,
        });
      }
    }
    if (pkg.bga) {
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 8; c++) {
          board.balls.push([left + 22 + c * ((pkg.w - 44) / 7), pkg.top + 22 + r * 18]);
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
