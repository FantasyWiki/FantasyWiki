import graph from "@generated/graph.json";

export interface DocNode {
  id: string;
  url: string;
  source: string;
  title: string;
  type: string;
  tags: string[];
  section: string;
  tier: "canonical" | "site";
  summary: string;
  words: number;
  updated?: string;
  inbound: number;
  outbound: number;
}

export interface DocEdge {
  source: string;
  target: string;
  /** True when the link came from the document's closing `## Related` list. */
  related: boolean;
}

export const nodes = graph.nodes as DocNode[];
export const edges = graph.edges as DocEdge[];
export const stats = graph.stats as {
  documents: number;
  edges: number;
  curated: number;
  words: number;
  orphans: string[];
  hubs: { id: string; title: string; url: string; degree: number }[];
};

const byId = new Map(nodes.map((node) => [node.id, node]));
const byUrl = new Map(nodes.map((node) => [node.url, node]));

export function nodeById(id: string): DocNode | undefined {
  return byId.get(id);
}

/**
 * VitePress hands components the page path without `base` and with a leading
 * slash — the same shape `urlFor` produced when the graph was built, so the
 * lookup is a plain map hit rather than a normalisation exercise.
 */
export function nodeForPath(path: string): DocNode | undefined {
  return byUrl.get(path) ?? byUrl.get(path.replace(/index\.html$/, ""));
}

export interface Neighbour {
  node: DocNode;
  /** How the edge was made, from the perspective of the page being viewed. */
  direction: "out" | "in";
  related: boolean;
}

/**
 * The documents on either end of a page's edges.
 *
 * Outgoing edges a reader can already see — they are links in the prose. The
 * incoming ones are the half of the graph that is invisible on GitHub, and the
 * reason this panel exists: knowing which rules depend on the page you are
 * reading is what turns a tree of files into a map.
 */
export function neighboursOf(id: string): Neighbour[] {
  const seen = new Map<string, Neighbour>();

  for (const edge of edges) {
    if (edge.source === id) {
      const node = byId.get(edge.target);
      if (node) seen.set(`out:${node.id}`, { node, direction: "out", related: edge.related });
    } else if (edge.target === id) {
      const node = byId.get(edge.source);
      if (node) seen.set(`in:${node.id}`, { node, direction: "in", related: edge.related });
    }
  }

  return [...seen.values()].sort((a, b) => {
    if (a.direction !== b.direction) return a.direction === "out" ? -1 : 1;
    if (a.related !== b.related) return a.related ? -1 : 1;
    return a.node.title.localeCompare(b.node.title, "en");
  });
}

/** The palette token a section is drawn in, everywhere it appears. */
export function colourFor(type: string): string {
  const known = [
    "domain",
    "architecture",
    "adr",
    "development",
    "deployment",
    "agents",
    "charter",
    "guide",
    "index",
  ];
  return `var(--fw-type-${known.includes(type) ? type : "guide"})`;
}

export const TYPE_LABELS: Record<string, string> = {
  domain: "Domain",
  architecture: "Architecture",
  adr: "Decision",
  development: "Development",
  deployment: "Deployment",
  agents: "Agents",
  charter: "Charter",
  guide: "Guide",
  index: "Index",
};

export function labelFor(type: string): string {
  return TYPE_LABELS[type] ?? type;
}
