/** Layered, slowly moving backdrop behind the landing hero: drifting color
 * fields, a streaked band of light rising from the horizon, and a faint
 * circuit board whose traces carry signal pulses up from the horizon. Styles live in globals.css under "Hero backdrop". */

// ---- Circuit traces ---------------------------------------------------------

// The SVG is 1600×700 and anchored to the bottom of the hero. Traces fan
// out from a bus of pins on the horizon, under the brightest light.
const W = 1600;
const H = 700;
const CHIP = { x: 960, y: 640, w: 150, h: 70 };

/** Deterministic pseudo-random numbers, so server and client render the
 * same board. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

interface Trace {
  d: string;
  end: [number, number];
  duration: number;
  delay: number;
  warm: boolean;
}

/** PCB-style routes: up out of a pin, a 45° bend, then a long horizontal run
 * out toward the edge, ending in a via. */
function buildTraces(): Trace[] {
  const rand = rng(7);
  const traces: Trace[] = [];
  const pins = 12;
  for (let i = 0; i < pins; i++) {
    const t = (i + 0.5) / pins;
    const x0 = CHIP.x - CHIP.w / 2 + t * CHIP.w;
    const y0 = CHIP.y - CHIP.h / 2;
    const left = t < 0.5;
    const rise = 40 + Math.abs(t - 0.5) * 2 * 260 + rand() * 90;
    const y1 = y0 - rise;
    const bend = 30 + rand() * 50;
    const dx = left ? -1 : 1;
    const run = 180 + rand() * 520 + Math.abs(t - 0.5) * 300;
    const x2 = x0 + dx * (bend + run);
    const y2 = y1 - bend;
    // Some traces take a second turn upward near the end.
    const turn = rand() < 0.45;
    const y3 = turn ? y2 - (60 + rand() * 140) : y2;
    const x3 = turn ? x2 + dx * 40 : x2;
    const d = turn
      ? `M${x0},${y0} V${y1} L${x0 + dx * bend},${y2} H${x2 - dx * 40} L${x3},${y2 - 40} V${y3}`
      : `M${x0},${y0} V${y1} L${x0 + dx * bend},${y2} H${x2}`;
    traces.push({
      d,
      end: [x3, y3],
      duration: 5 + rand() * 6,
      delay: -rand() * 10,
      warm: rand() < 0.35,
    });
  }
  return traces;
}

const TRACES = buildTraces();

function CircuitBoard() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      className="hero-circuit"
      fill="none"
    >
      <g className="hero-circuit-traces">
        {TRACES.map((t, i) => (
          <path key={i} d={t.d} />
        ))}
        {TRACES.map((t, i) => (
          <circle key={i} cx={t.end[0]} cy={t.end[1]} r={4} />
        ))}
      </g>
      <g>
        {TRACES.map((t, i) => (
          <path
            key={i}
            d={t.d}
            pathLength={1000}
            className={t.warm ? "hero-signal hero-signal-warm" : "hero-signal"}
            style={{ animationDuration: `${t.duration}s`, animationDelay: `${t.delay}s` }}
          />
        ))}
      </g>
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
      <div className="hero-flare" />
      <div className="hero-scrim" />
      <CircuitBoard />
      <div className="hero-grain" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
