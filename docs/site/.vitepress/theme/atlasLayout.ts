import type { DocEdge, DocNode } from "./graph";

/**
 * The force layout behind the Docs Atlas.
 *
 * A small simulation rather than a graph library, for one reason: each section
 * has to be pulled towards its own corner of the canvas. An unseeded force
 * layout of forty-odd densely linked documents is an unreadable ball of string
 * — the usual way this kind of view dies — and sectional gravity is what turns
 * it into a map you can point at.
 *
 * It lives outside the component so it can be run without a browser.
 */

export const WIDTH = 1000;
export const HEIGHT = 800;

/** Enough ticks for this many nodes to settle; it runs once, synchronously. */
const TICKS = 520;
/** Pure label separation once the structure has stopped moving. */
const SETTLE_TICKS = 400;

/**
 * What a label costs, in the same user units the dots are placed in.
 *
 * Dots are 12 to 34 units across; the words under them are five times that. A
 * layout that only keeps circles apart is therefore still unreadable, because
 * what overlaps is never the circles. Everything below treats a document as the
 * box its title occupies, not as its dot.
 */
const LABEL_SIZE = 10;
const LABEL_GLYPH = LABEL_SIZE * 0.52;
const LABEL_MAX = 20;
/** Dot bottom to the baseline below it, plus room for the next dot's top. */
const LABEL_BAND = 22;
/** Clear air between two labels, so adjacent ones read as two words not one. */
const LABEL_GAP = 12;

/** A title short enough to be read at a glance, and to be laid out around. */
export function labelOf(title: string): string {
  return title.length > LABEL_MAX ? `${title.slice(0, LABEL_MAX - 1).trimEnd()}…` : title;
}

export interface PlacedNode extends DocNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** The title as drawn — truncated, and the thing the layout makes room for. */
  label: string;
  /** Half that label's width, in user units. */
  half: number;
}

/** Where each section is pulled towards, in fractions of the canvas. */
export const ANCHORS: Record<string, [number, number]> = {
  charter: [0.5, 0.1],
  domain: [0.16, 0.3],
  architecture: [0.82, 0.28],
  deployment: [0.93, 0.56],
  adr: [0.12, 0.72],
  development: [0.84, 0.78],
  // The orientation tier sits in the middle because that is what it is: the
  // layer that links into every section rather than belonging to one.
  index: [0.5, 0.5],
  guide: [0.5, 0.5],
};

function anchorFor(type: string): [number, number] {
  return ANCHORS[type] ?? [0.5, 0.5];
}

/**
 * A deterministic pseudo-random source. The Atlas must draw the same picture on
 * every visit and in every build — a graph that rearranges itself between
 * reloads cannot be referred to, and no screenshot of it would ever match.
 */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * The box the drawing actually occupies, padded and widened back to the
 * canvas's aspect ratio. Where the anchors happen to leave the graph is not
 * worth hand-tuning: framing it afterwards makes it fill the view whatever the
 * document mix turns out to be.
 */
export function boundsOf(placed: PlacedNode[], padding = 46) {
  if (placed.length === 0) return { x: 0, y: 0, w: WIDTH, h: HEIGHT };

  const left = Math.min(...placed.map((node) => node.x - node.radius)) - padding;
  const right = Math.max(...placed.map((node) => node.x + node.radius)) + padding;
  const top = Math.min(...placed.map((node) => node.y - node.radius)) - padding;
  // Labels hang below their dot, so the bottom needs more room than the top.
  const bottom = Math.max(...placed.map((node) => node.y + node.radius)) + padding + 12;

  const width = right - left;
  const height = bottom - top;
  const ratio = WIDTH / HEIGHT;

  if (width / height >= ratio) {
    const grown = width / ratio;
    return { x: left, y: top - (grown - height) / 2, w: width, h: grown };
  }
  const grown = height * ratio;
  return { x: left - (grown - width) / 2, y: top, w: grown, h: height };
}

export function layoutDocuments(nodes: DocNode[], edges: DocEdge[]): PlacedNode[] {
  const random = seeded(0x5eed);

  const placed: PlacedNode[] = nodes.map((node, index) => {
    const [ax, ay] = anchorFor(node.type);
    const angle = (index / nodes.length) * Math.PI * 2;
    const degree = node.inbound + node.outbound;
    const label = labelOf(node.title);
    return {
      ...node,
      x: ax * WIDTH + Math.cos(angle) * 40 + (random() - 0.5) * 30,
      y: ay * HEIGHT + Math.sin(angle) * 40 + (random() - 0.5) * 30,
      vx: 0,
      vy: 0,
      radius: 6 + Math.min(11, Math.sqrt(degree) * 3.1),
      label,
      half: (label.length * LABEL_GLYPH) / 2,
    };
  });

  const index = new Map(placed.map((node) => [node.id, node]));
  const springs = edges
    .map((edge) => ({ a: index.get(edge.source), b: index.get(edge.target) }))
    .filter((spring): spring is { a: PlacedNode; b: PlacedNode } => Boolean(spring.a && spring.b));

  for (let tick = 0; tick < TICKS; tick += 1) {
    const cooling = 1 - tick / TICKS;

    // Repulsion between every pair. Quadratic in the node count, which at this
    // size is cheaper than the quadtree that would replace it.
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i];
        const b = placed[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 0.01;
        const clearance = a.radius + b.radius + 30;
        const force = 7600 / (distance * distance) + (distance < clearance ? 3.2 : 0);
        dx /= distance;
        dy /= distance;
        a.vx -= dx * force;
        a.vy -= dy * force;
        b.vx += dx * force;
        b.vy += dy * force;
      }
    }

    // Springs along the links.
    for (const { a, b } of springs) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 0.01;
      const force = (distance - 150) * 0.011;
      const ux = (dx / distance) * force;
      const uy = (dy / distance) * force;
      a.vx += ux;
      a.vy += uy;
      b.vx -= ux;
      b.vy -= uy;
    }

    // Sectional gravity — what keeps the clusters legible.
    for (const node of placed) {
      const [ax, ay] = anchorFor(node.type);
      node.vx += (ax * WIDTH - node.x) * 0.014;
      node.vy += (ay * HEIGHT - node.y) * 0.014;

      node.vx *= 0.82 * cooling + 0.1;
      node.vy *= 0.82 * cooling + 0.1;
      node.x = Math.min(WIDTH - 34, Math.max(34, node.x + node.vx));
      node.y = Math.min(HEIGHT - 26, Math.max(26, node.y + node.vy));
    }

    // Room for the words, ramped in as the graph cools: the sections form
    // first, and only then does anything get pushed aside to be legible.
    separateLabels(placed, 0.35 + 0.45 * (1 - cooling));

    clampToCanvas(placed);
  }

  // A settling phase that does nothing but make room. By now the sections are
  // where they belong and the springs have said everything they have to say;
  // what is left is the last few dozen titles sitting on top of each other,
  // which the full simulation can never finish resolving because every push it
  // makes is half-undone by a spring on the next tick.
  for (let tick = 0; tick < SETTLE_TICKS; tick += 1) {
    separateLabels(placed, 1);
    clampToCanvas(placed);
  }

  return placed;
}

function clampToCanvas(placed: PlacedNode[]) {
  for (const node of placed) {
    node.x = Math.min(WIDTH - 34, Math.max(34, node.x));
    node.y = Math.min(HEIGHT - 26, Math.max(26, node.y));
  }
}

/**
 * Pushes apart every pair whose label boxes overlap, along whichever axis needs
 * the least movement — sideways where the words collide, downwards where the
 * lines do. Positions rather than velocities, so the correction cannot be
 * cancelled out by the spring it is arguing with.
 */
function separateLabels(placed: PlacedNode[], strength: number) {
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const a = placed[i];
      const b = placed[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;

      const overlapX = a.half + b.half + LABEL_GAP - Math.abs(dx);
      if (overlapX <= 0) continue;
      const overlapY = a.radius + b.radius + LABEL_BAND - Math.abs(dy);
      if (overlapY <= 0) continue;

      if (overlapX < overlapY * 2) {
        const push = ((dx < 0 ? -1 : 1) * overlapX * strength) / 2;
        a.x -= push;
        b.x += push;
      } else {
        const push = ((dy < 0 ? -1 : 1) * overlapY * strength) / 2;
        a.y -= push;
        b.y += push;
      }
    }
  }
}
