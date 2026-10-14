/**
 * Group frames: a rectangle drawn behind some nodes. Which nodes belong is
 * stored on the nodes (`data.group`), the frame only records where it sits.
 */

export const GROUP_PAD = 36;
/** Extra room along the top for the frame's name tab. */
export const GROUP_TOP = 30;

export interface Size {
  w: number;
  h: number;
}

export interface GNode {
  id: string;
  position: { x: number; y: number };
  data: { kind: string; group?: string; w?: number; h?: number; [k: string]: unknown };
}

type SizeOf = (n: GNode) => Size;

function bounds(items: { x: number; y: number; w: number; h: number }[]) {
  const x0 = Math.min(...items.map((i) => i.x));
  const y0 = Math.min(...items.map((i) => i.y));
  const x1 = Math.max(...items.map((i) => i.x + i.w));
  const y1 = Math.max(...items.map((i) => i.y + i.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const rect = (n: GNode, sizeOf: SizeOf) => ({
  x: n.position.x,
  y: n.position.y,
  ...sizeOf(n),
});

/** The frame position and size that holds `members` with room to spare. */
export function frameAround(members: GNode[], sizeOf: SizeOf) {
  const b = bounds(members.map((m) => rect(m, sizeOf)));
  return {
    position: { x: b.x - GROUP_PAD, y: b.y - GROUP_PAD - GROUP_TOP },
    w: Math.round(b.w + GROUP_PAD * 2),
    h: Math.round(b.h + GROUP_PAD * 2 + GROUP_TOP),
  };
}

/** Nodes inside group `id`. */
export const membersOf = <T extends GNode>(nodes: T[], id: string): T[] =>
  nodes.filter((n) => n.data.group === id);

/**
 * Re-fit every frame to its nodes after they moved or were rearranged. A frame
 * with no nodes is left where it is.
 */
export function refitGroups<T extends GNode>(nodes: T[], sizeOf: SizeOf): T[] {
  return nodes.map((n) => {
    if (n.data.kind !== "group") return n;
    const members = membersOf(nodes, n.id).filter((m) => m.data.kind !== "group");
    if (!members.length) return n;
    const f = frameAround(members, sizeOf);
    return { ...n, position: f.position, data: { ...n.data, w: f.w, h: f.h } };
  });
}

/**
 * The frame a node was dropped into: the smallest frame holding its centre,
 * so a node inside a small group inside a large one joins the small one.
 */
export function frameAt<T extends GNode>(
  node: T,
  nodes: T[],
  sizeOf: SizeOf,
): string | undefined {
  const s = sizeOf(node);
  const cx = node.position.x + s.w / 2;
  const cy = node.position.y + s.h / 2;
  let best: { id: string; area: number } | undefined;
  for (const g of nodes) {
    if (g.data.kind !== "group" || g.id === node.id) continue;
    const w = g.data.w ?? 0;
    const h = g.data.h ?? 0;
    const inside =
      cx >= g.position.x && cx <= g.position.x + w && cy >= g.position.y && cy <= g.position.y + h;
    if (inside && (!best || w * h < best.area)) best = { id: g.id, area: w * h };
  }
  return best?.id;
}

/** Shift a frame's nodes by (dx, dy), except those already moving with it. */
export function moveMembers<T extends GNode>(
  nodes: T[],
  groupId: string,
  dx: number,
  dy: number,
  alreadyMoving: Set<string> = new Set(),
): T[] {
  return nodes.map((n) =>
    n.data.group === groupId && !alreadyMoving.has(n.id)
      ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
      : n,
  );
}
