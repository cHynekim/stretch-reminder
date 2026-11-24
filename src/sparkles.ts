/**
 * Pixel-art twinkling stars on a <canvas>. The canvas is drawn at low
 * resolution (one canvas pixel = PIXEL css px) and scaled up with
 * `image-rendering: pixelated`, so every star is made of crisp square pixels.
 */

const PIXEL = 3; // css px per art pixel
const FPS = 8; // low frame rate = steppy, retro twinkle
// Two colours max, so the effect stays calm.
// Light mode: terracotta (point colour) + white. Dark mode: main yellow + white.
const LIGHT_COLORS = ["#c86d51", "#ffffff"];
const DARK_COLORS = ["#ffeba8", "#ffffff"];

// Twinkle frames: each star cycles dot → plus → big star → plus → dot → off.
// Offsets are [dx, dy] from the star centre.
const DOT: [number, number][] = [[0, 0]];
const PLUS: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
const BIG: [number, number][] = [
  ...PLUS,
  [2, 0], [-2, 0], [0, 2], [0, -2],
  [1, 1], [-1, -1], [1, -1], [-1, 1],
];
const FRAMES = [DOT, PLUS, BIG, PLUS, DOT, [], [], []];

interface Star {
  x: number;
  y: number;
  color: string;
  phase: number;
  /** Some stars drift upward like rising glitter. */
  rise: number;
}

export function startSparkles(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d")!;
  const w = Math.max(1, Math.round(canvas.clientWidth / PIXEL));
  const h = Math.max(1, Math.round(canvas.clientHeight / PIXEL));
  canvas.width = w;
  canvas.height = h;
  ctx.imageSmoothingEnabled = false;

  // Text-safe zone: no stars in the middle band where the message sits.
  const zone = { x0: w * 0.08, x1: w * 0.92, y0: h * 0.3, y1: h * 0.72 };
  const inZone = (x: number, y: number) =>
    x >= zone.x0 - 2 && x <= zone.x1 + 2 && y >= zone.y0 - 2 && y <= zone.y1 + 2;
  const spot = (): [number, number] => {
    for (;;) {
      const x = Math.floor(Math.random() * w);
      const y = Math.floor(Math.random() * h);
      if (!inZone(x, y)) return [x, y];
    }
  };

  const COLORS = matchMedia("(prefers-color-scheme: dark)").matches ? DARK_COLORS : LIGHT_COLORS;

  // Sparse on purpose, so the background stays calm behind the text.
  const count = Math.round((w * h) / 260);
  const stars: Star[] = Array.from({ length: count }, () => {
    const [x, y] = spot();
    return {
      x,
      y,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      phase: Math.floor(Math.random() * FRAMES.length),
      rise: Math.random() < 0.3 ? 1 : 0,
    };
  });

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let frame = 0;

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      if (inZone(s.x, s.y)) continue; // rising stars vanish while crossing the text
      const shape = reduced ? PLUS : FRAMES[(s.phase + frame) % FRAMES.length];
      ctx.fillStyle = s.color;
      for (const [dx, dy] of shape) ctx.fillRect(s.x + dx, s.y + dy, 1, 1);
    }
  }

  function step() {
    frame++;
    for (const s of stars) {
      if (s.rise && frame % 2 === 0) {
        s.y -= 1;
        if (s.y < -3) {
          s.y = h + 2;
          s.x = Math.floor(Math.random() * w);
        }
      }
    }
    draw();
  }

  draw();
  if (reduced) return () => {};
  const timer = setInterval(step, 1000 / FPS);
  return () => clearInterval(timer);
}
