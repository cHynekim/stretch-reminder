/**
 * Tiny pixel-art sprites. Each sprite is a grid of characters; each character
 * maps to a colour in PALETTE ('.' is transparent). Rendered as crisp SVG rects.
 */

const PALETTE: Record<string, string> = {
  k: "#2b2118", // ink
  y: "#ffd23f", // sunny yellow
  o: "#ff9f1c", // orange
  p: "#ff8fab", // pink
  w: "#ffffff",
  g: "#5cc56e", // leaf green
  d: "#2e8a45", // dark green
  b: "#5ab8f0", // water blue
};

export const SPRITES = {
  /** A yellow blob doing a big overhead stretch. */
  blob: [
    "kk..........kk",
    "kk..........kk",
    ".k..........k.",
    ".k...kkkk...k.",
    ".kk.kyyyyk.kk.",
    "..kkyyyyyykk..",
    "...kykyykyk...",
    "...kyyyyyyk...",
    "...kpyyyypk...",
    "...kyykkyyk...",
    "....kyyyyk....",
    "....kk..kk....",
    "....kk..kk....",
  ],
  heart: [
    ".kk.kk.",
    "kppkppk",
    "kpwpppk",
    ".kpppk.",
    "..kpk..",
    "...k...",
  ],
  sprout: [
    "gg...gg",
    "ggg.ggg",
    ".ggdgg.",
    "...d...",
    "...d...",
    ".ooooo.",
    "..ooo..",
  ],
  drop: [
    "...k...",
    "..kbk..",
    "..kbk..",
    ".kbbbk.",
    "kbwbbbk",
    "kbwbbbk",
    "kbbbbbk",
    ".kkkkk.",
  ],
} satisfies Record<string, string[]>;

export type SpriteName = keyof typeof SPRITES;

/** Returns an inline SVG string. `px` is the on-screen size of one pixel. */
export function spriteSvg(name: SpriteName, px = 3, label = ""): string {
  const rows = SPRITES[name];
  const w = rows[0].length;
  const h = rows.length;
  let rects = "";
  rows.forEach((row, y) => {
    // Merge horizontal runs of the same colour into one rect.
    let x = 0;
    while (x < w) {
      const c = row[x];
      let run = 1;
      while (x + run < w && row[x + run] === c) run++;
      if (c !== "." && PALETTE[c]) {
        rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${PALETTE[c]}"/>`;
      }
      x += run;
    }
  });
  const a11y = label ? `role="img" aria-label="${label}"` : `aria-hidden="true"`;
  return `<svg class="sprite-svg" ${a11y} viewBox="0 0 ${w} ${h}" width="${w * px}" height="${h * px}" shape-rendering="crispEdges">${rects}</svg>`;
}

/** Replace every `<i data-sprite="name" data-px="3">` placeholder in the document. */
export function hydrateSprites(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>("[data-sprite]").forEach((el) => {
    const name = el.dataset.sprite as SpriteName;
    if (name in SPRITES) el.innerHTML = spriteSvg(name, Number(el.dataset.px ?? 3));
  });
}
